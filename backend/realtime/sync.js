const mongoose = require('mongoose');
const { GoogleClient } = require('./google');
const { RealtimeProfile, RealtimeMetric, RealtimeSetting, getSettings, METRIC_KEYS } = require('./models');

/**
 * Pulls Google Business Profile data into the two realtime collections.
 *
 *   profiles     - every location of every account the connected mailbox can see
 *   performance  - daily metrics, rolled into one document per location per month
 *
 * A "full" run covers the last 6 months; the twice-daily scheduled run only re-reads the
 * trailing window (Google keeps revising the most recent days), which keeps each run to one
 * Performance API call per location.
 */

const PERFORMANCE_MONTHS = 6;
const INCREMENTAL_DAYS = 10;
const CONCURRENCY = Number(process.env.REALTIME_SYNC_CONCURRENCY || 8);
// One extra call per listing; set to false to shorten each run at the cost of the
// "Google updates" count going stale.
const FETCH_GOOGLE_UPDATES = process.env.REALTIME_FETCH_GOOGLE_UPDATES !== 'false';
// Keep listings that no folder lists as a member (there is normally about one).
const ALLOW_REACHABLE_FALLBACK = true;

let running = false;

/* ───────────────────────────── helpers ───────────────────────────── */

const normalise = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '');

const ymOf = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const runPool = async (items, worker, concurrency, onProgress) => {
  let index = 0;
  let done = 0;
  const run = async () => {
    while (index < items.length) {
      const i = index++;
      try {
        await worker(items[i], i);
      } catch (err) {
        console.error('[realtime] item failed:', err.message);
      }
      done += 1;
      if (onProgress && done % 25 === 0) await onProgress(done);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length || 1) }, run));
  if (onProgress) await onProgress(done);
};

/**
 * Cluster / unit for a Google location, taken from the data the dashboard already has so the
 * realtime view groups exactly like the monthly one. Match on business name, then on store code.
 */
const buildUnitMap = async () => {
  const byName = new Map();
  const byBranch = new Map();
  try {
    const rows = await mongoose.connection
      .collection('manipalinsightsdatas')
      .find({}, { projection: { 'Business name': 1, Branch: 1, Cluster: 1, Department: 1 } })
      .toArray();
    for (const row of rows) {
      const entry = {
        unitName: row.Branch || 'Unassigned',
        cluster: row.Cluster || 'Unassigned',
        department: row.Department || 'GMB',
      };
      const key = normalise(row['Business name']);
      if (key && !byName.has(key)) byName.set(key, entry);
      const branchKey = normalise(row.Branch);
      if (branchKey && !byBranch.has(branchKey)) byBranch.set(branchKey, entry);
    }
  } catch (err) {
    console.error('[realtime] could not build unit map:', err.message);
  }
  byName.byBranch = byBranch;
  return byName;
};

/** "MH - Old Airport" / "MHBBS - MH- Bhubaneswar" -> "Old Airport" (for the cluster lookup). */
const stripAccountPrefix = (accountName) =>
  String(accountName || '')
    .replace(/^\s*MH[A-Z]*\s*-\s*/i, '')
    .replace(/^\s*MH\s*-\s*/i, '')
    .trim();

/**
 * Title patterns used by the Manipal listings, e.g.
 * "Dr. Someone - Cardiologist - Manipal Hospital Old Airport Road".
 */
/**
 * The unit is the Google folder (location group) the listing sits in - that is what the
 * dashboard's unit column shows. The cluster comes from the data the dashboard already has,
 * matched on the folder name first, then on the listing title.
 */
const resolveUnit = (unitMap, location, accountName) => {
  const byTitle = matchUnit(unitMap, location);
  const byBranch = unitMap.byBranch?.get(normalise(stripAccountPrefix(accountName)));
  const cluster =
    (byBranch && byBranch.cluster !== 'Unassigned' && byBranch.cluster) ||
    (byTitle.cluster !== 'Unassigned' && byTitle.cluster) ||
    'Unassigned';
  return {
    unitName: accountName || byTitle.unitName || 'Unassigned',
    cluster,
    department: byTitle.department || 'GMB',
  };
};

const matchUnit = (unitMap, location) => {
  const title = location.title || '';
  const direct = unitMap.get(normalise(title));
  if (direct) return direct;

  const tail = title.split(/\s[-–|]\s/).pop();
  const byTail = unitMap.get(normalise(tail));
  if (byTail) return byTail;

  // Longest known unit name contained in the title wins.
  const normalisedTitle = normalise(title);
  let best = null;
  let bestLen = 0;
  for (const [key, value] of unitMap) {
    if (key.length > bestLen && key.length >= 6 && normalisedTitle.includes(key)) {
      best = value;
      bestLen = key.length;
    }
  }
  return best || { unitName: 'Unassigned', cluster: 'Unassigned', department: 'GMB' };
};

/** One label per profile, matching the buckets the dashboard counts. */
const deriveStatus = (profile, vom) => {
  if (profile.duplicateOf) return { statusType: 'Duplicate', verificationState: 'unverified', publishStatus: 'duplicate' };
  if (profile.hasVoiceOfMerchant) return { statusType: 'Verified', verificationState: 'verified', publishStatus: 'published' };
  if (!vom) return { statusType: 'Unverified', verificationState: 'unverified', publishStatus: 'pending' };

  if (vom.complyWithGuidelines) {
    const disabled = vom.complyWithGuidelines.recommendationReason === 'BUSINESS_LOCATION_DISABLED';
    return {
      statusType: disabled ? 'Disabled' : 'Suspended',
      verificationState: vom.hasBusinessAuthority ? 'verified' : 'unverified',
      publishStatus: disabled ? 'disabled' : 'suspended',
    };
  }
  if (vom.resolveOwnershipConflict) return { statusType: 'Ownership Conflict', verificationState: 'ownership_conflict', publishStatus: 'pending' };
  if (vom.waitForVoiceOfMerchant || vom.verify?.hasPendingVerification) return { statusType: 'Pending Verification', verificationState: 'pending', publishStatus: 'pending' };
  return { statusType: 'Unverified', verificationState: 'unverified', publishStatus: 'pending' };
};

/* ────────────────────────── profile sync ────────────────────────── */

const progress = (fields) => RealtimeSetting.updateOne({ _id: 'primary' }, { $set: fields }).catch(() => {});

/** Unit folders (0) are read before the cluster and organisation-level ones (1). */
const rank = (accountName) => (/cluster|hospitals$|^MHHS|^Dashboard/i.test(String(accountName || '')) ? 1 : 0);

const syncProfiles = async (client, settings, { fetchUpdates = true } = {}) => {
  const unitMap = await buildUnitMap();
  const accounts = await client.listAccounts();
  await progress({ accounts: accounts.map((a) => ({ name: a.name, accountName: a.accountName, type: a.type })) });

  const seen = [];

  const needsVom = [];
  let ops = [];

  // A listing can show up under several accounts (a unit folder and the cluster folder above
  // it). Unit folders are read first and keep the listing, so it is counted once, in the
  // folder the dashboard expects.
  const ordered = [...accounts].sort((a, b) => rank(a.accountName) - rank(b.accountName));

  // Folder membership comes from the UNFILTERED listing, which is what Business Profile
  // Manager shows for a group. The filtered listing also returns listings that are merely
  // reachable from a folder but belong to another one, so it is used only as a safety net for
  // listings that would otherwise have no folder at all.
  const byLocation = new Map();

  const readLocation = (loc, account) => {
    const meta = loc.metadata || {};
    const unit = resolveUnit(unitMap, loc, account.accountName);
    return {
      locationId: loc.name,
      accountId: account.name,
      accountName: account.accountName,
      title: loc.title || '',
      storeCode: loc.storeCode || '',
      phone: loc.phoneNumbers?.primaryPhone || '',
      website: loc.websiteUri || '',
      address: (loc.storefrontAddress?.addressLines || []).concat(loc.storefrontAddress?.locality || []).filter(Boolean).join(', '),
      primaryCategory: loc.categories?.primaryCategory?.displayName || '',
      labels: loc.labels || [],
      mapsUri: meta.mapsUri || '',
      cluster: unit.cluster,
      unitName: unit.unitName,
      department: unit.department,
      openStatus: loc.openInfo?.status || 'OPEN',
      hasVoiceOfMerchant: meta.hasVoiceOfMerchant === true,
      duplicateOf: meta.duplicateLocation || null,
      missingStoreCode: !loc.storeCode,
      lastSyncedAt: new Date(),
    };
  };

  const collect = async (account, membership) => {
    let pageToken;
    do {
      const page = await client.listLocationsPage(account.name, pageToken, { membership });
      for (const loc of page.locations || []) {
        const existing = byLocation.get(loc.name);
        if (existing) {
          // Only a membership listing may add a folder; the reachable listing must not.
          if (membership) existing.folders.add(account.accountName);
          continue;
        }
        if (!membership && !ALLOW_REACHABLE_FALLBACK) continue;
        const base = readLocation(loc, account);
        if (!membership) {
          // No folder lists this one as a member, so it must not be added to any folder's
          // count - it goes to its own bucket and still counts in the headline total.
          base.unitName = 'Unassigned';
          byLocation.set(loc.name, { base, folders: new Set(['Unassigned']) });
          continue;
        }
        byLocation.set(loc.name, { base, folders: new Set([account.accountName]) });
      }
      await progress({ 'sync.profilesSynced': byLocation.size });
      pageToken = page.nextPageToken;
    } while (pageToken);
  };

  for (const account of ordered) await collect(account, true);
  // Second pass: anything no folder claims as a member still gets recorded, so the total
  // stays complete.
  for (const account of ordered) await collect(account, false);

  for (const { base, folders } of byLocation.values()) {
    const status = deriveStatus(base, null);
    if (!base.hasVoiceOfMerchant && !base.duplicateOf) needsVom.push(base.locationId);
    seen.push(base.locationId);
    ops.push({
      updateOne: {
        filter: { locationId: base.locationId },
        update: { $set: { ...base, ...status, folders: [...folders] } },
        upsert: true,
      },
    });
    if (ops.length >= 500) {
      await RealtimeProfile.bulkWrite(ops, { ordered: false });
      ops = [];
    }
  }
  if (ops.length) await RealtimeProfile.bulkWrite(ops, { ordered: false });


  // Unverified listings only: one extra call each tells suspended apart from pending.
  await progress({ 'sync.phase': 'verification', 'sync.total': needsVom.length, 'sync.processed': 0 });
  await runPool(
    needsVom,
    async (locationId) => {
      let vom = null;
      try {
        vom = await client.voiceOfMerchantState(locationId);
      } catch (err) {
        if (err.status === 404 || err.status === 403) return;
        throw err;
      }
      const hasVoiceOfMerchant = vom.hasVoiceOfMerchant === true;
      await RealtimeProfile.updateOne(
        { locationId },
        { $set: { hasVoiceOfMerchant, ...deriveStatus({ duplicateOf: null, hasVoiceOfMerchant }, vom) } }
      );
    },
    CONCURRENCY,
    (done) => progress({ 'sync.processed': done })
  );

  // Google's suggested edits - one call per listing, so it can be switched off.
  if (FETCH_GOOGLE_UPDATES && fetchUpdates) {
    await progress({ 'sync.phase': 'updates', 'sync.total': seen.length, 'sync.processed': 0 });
    await runPool(
      seen,
      async (locationId) => {
        let res = null;
        try {
          res = await client.googleUpdated(locationId);
        } catch (err) {
          if (err.status === 404 || err.status === 403) return; // nothing suggested, or no access
          throw err;
        }
        const fields = String(res?.diffMask || '').split(',').map((f) => f.trim()).filter(Boolean);
        await RealtimeProfile.updateOne(
          { locationId },
          {
            $set: {
              hasGoogleUpdates: fields.length > 0,
              googleUpdateFields: fields,
              googleOpenStatus: res?.location?.openInfo?.status || null,
            },
          }
        );
      },
      CONCURRENCY,
      (done) => progress({ 'sync.processed': done })
    );
  }

  // Listings that disappeared from Google (removed or access lost).
  if (seen.length) await RealtimeProfile.deleteMany({ locationId: { $nin: seen } });

  return seen.length;
};

/* ──────────────────────── performance sync ──────────────────────── */

const windowFor = (mode) => {
  const end = new Date();
  end.setDate(end.getDate() - 1); // Google has no data for today
  const start = new Date(end);
  if (mode === 'full') {
    start.setMonth(start.getMonth() - (PERFORMANCE_MONTHS - 1));
    start.setDate(1);
  } else {
    start.setDate(start.getDate() - INCREMENTAL_DAYS);
  }
  return { start, end };
};

const syncPerformance = async (client, settings, mode, onProgress) => {
  const { start, end } = windowFor(mode);
  // Google has no performance data for unverified, duplicate or closed listings (the API
  // answers 403), so only verified ones are worth a call - about 650 fewer calls per run.
  const profiles = await RealtimeProfile.find(
    { duplicateOf: null, openStatus: { $ne: 'CLOSED_PERMANENTLY' }, hasVoiceOfMerchant: true },
    { locationId: 1, title: 1, unitName: 1, cluster: 1 }
  ).lean();

  await progress({ 'sync.total': profiles.length, 'sync.processed': 0 });

  let written = 0;
  let ops = [];
  const flush = async () => {
    if (!ops.length) return;
    await RealtimeMetric.bulkWrite(ops, { ordered: false });
    written += ops.length;
    ops = [];
  };

  await runPool(
    profiles,
    async (profile) => {
      const byDate = await client.dailyMetrics(profile.locationId, start, end);
      if (!byDate.size) return;

      // date -> month bucket
      const months = new Map();
      for (const [dateKey, values] of byDate) {
        const [y, m, d] = dateKey.split('-').map(Number);
        const ym = `${y}-${String(m).padStart(2, '0')}`;
        if (!months.has(ym)) months.set(ym, { year: y, month: m, days: new Map() });
        months.get(ym).days.set(d, values);
      }

      // An incremental run only re-reads recent days, so merge onto what is already stored.
      const existing = mode === 'full'
        ? []
        : await RealtimeMetric.find({ locationId: profile.locationId, ym: { $in: [...months.keys()] } }, { ym: 1, days: 1 }).lean();
      const existingByYm = new Map(existing.map((doc) => [doc.ym, doc.days || []]));

      for (const [ym, bucket] of months) {
        const merged = new Map();
        for (const day of existingByYm.get(ym) || []) merged.set(day.day, day);
        for (const [day, values] of bucket.days) {
          merged.set(day, { day, ...METRIC_KEYS.reduce((acc, k) => ({ ...acc, [k]: Number(values[k] || 0) }), {}) });
        }

        const days = [...merged.values()].sort((a, b) => a.day - b.day);
        const totals = METRIC_KEYS.reduce((acc, k) => ({ ...acc, [k]: days.reduce((sum, day) => sum + Number(day[k] || 0), 0) }), {});

        ops.push({
          updateOne: {
            filter: { locationId: profile.locationId, ym },
            update: {
              $set: {
                locationId: profile.locationId,
                ym,
                year: bucket.year,
                month: bucket.month,
                title: profile.title,
                unitName: profile.unitName,
                cluster: profile.cluster,
                totals,
                days,
                lastSyncedAt: new Date(),
              },
            },
            upsert: true,
          },
        });
      }
      if (ops.length >= 400) await flush();
    },
    CONCURRENCY,
    onProgress
  );

  await flush();

  // Months that have rolled out of the 6-month window.
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - PERFORMANCE_MONTHS);
  await RealtimeMetric.deleteMany({ ym: { $lt: ymOf(cutoff) } });

  return written;
};

/* ────────────────────────────── run ────────────────────────────── */

const runSync = async ({ mode = 'incremental', trigger = 'manual' } = {}) => {
  if (running) return { started: false, reason: 'A sync is already running.' };

  const settings = await getSettings();
  if (!settings.connected || !settings.refreshTokenEnc) {
    return { started: false, reason: 'No Google account is connected.' };
  }

  running = true;
  await progress({
    'sync.status': 'running',
    'sync.mode': mode,
    'sync.trigger': trigger,
    'sync.phase': 'profiles',
    'sync.startedAt': new Date(),
    'sync.finishedAt': null,
    'sync.processed': 0,
    'sync.total': 0,
    'sync.profilesSynced': 0,
    'sync.error': null,
  });

  // Deliberately not awaited by the caller: a full run takes minutes.
  (async () => {
    try {
      const client = new GoogleClient(settings);

      // Neither 'profiles' nor 'counts' touches the Performance API.
      //   profiles - listing + verification status only, the quick re-check (~5 min)
      //   counts    - the above plus Google's suggested edits, so every status count is current
      const profilesOnly = mode === 'profiles' || mode === 'counts';
      const profilesSynced = await syncProfiles(client, settings, { fetchUpdates: mode !== 'profiles' });
      await progress({ 'sync.profilesSynced': profilesSynced, 'sync.phase': profilesOnly ? 'done' : 'performance' });

      if (profilesOnly) {
        await progress({
          'sync.status': 'idle',
          'sync.phase': 'done',
          'sync.finishedAt': new Date(),
          'sync.lastSuccessAt': new Date(),
        });
        console.log(`[realtime] profiles sync finished: ${profilesSynced} profiles.`);
        running = false;
        return;
      }

      // Progress comes from parallel workers, so it is written with updateOne rather than save().
      const metricsSynced = await syncPerformance(client, settings, mode, (processed) =>
        RealtimeSetting.updateOne({ _id: 'primary' }, { $set: { 'sync.processed': processed } })
      );

      // Terminal state goes through updateOne: a full save() can fail on an unrelated field and
      // would then leave the run looking stuck at "running" forever.
      await progress({
        'sync.metricsSynced': metricsSynced,
        'sync.status': 'idle',
        'sync.phase': 'done',
        'sync.finishedAt': new Date(),
        'sync.lastSuccessAt': new Date(),
        ...(mode === 'full' ? { 'sync.lastFullSyncAt': new Date() } : {}),
      });
      console.log(`[realtime] ${mode} sync finished: ${profilesSynced} profiles, ${metricsSynced} metric documents.`);
    } catch (err) {
      console.error('[realtime] sync failed:', err);
      await progress({ 'sync.status': 'error', 'sync.error': err.message, 'sync.finishedAt': new Date() });
    } finally {
      running = false;
    }
  })();

  return { started: true, mode };
};

const isRunning = () => running;

module.exports = { runSync, isRunning, buildUnitMap, matchUnit, resolveUnit, deriveStatus, PERFORMANCE_MONTHS };
