const crypto = require('crypto');
const express = require('express');
const google = require('./google');
const { CLUSTERS, clustersOf, clusterFilter } = require('./cluster-folders');
const { RealtimeProfile, RealtimeMetric, getSettings, METRIC_KEYS } = require('./models');
const { runSync, isRunning, PERFORMANCE_MONTHS } = require('./sync');

const router = express.Router();

/* ───────────────────────────── cache ───────────────────────────── */

// The dashboard reads the same few roll-ups on every page view; Mongo only sees them once a
// minute. Cleared as soon as a sync writes new data.
const CACHE_TTL_MS = 30 * 1000;
const cache = new Map();

const cached = async (key, producer) => {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  const value = await producer();
  cache.set(key, { at: Date.now(), value });
  return value;
};

const clearCache = () => cache.clear();

/* ──────────────────────────── helpers ──────────────────────────── */

const sumStage = () =>
  METRIC_KEYS.reduce((acc, key) => ({ ...acc, [key]: { $sum: `$totals.${key}` } }), {});

const emptyTotals = () => METRIC_KEYS.reduce((acc, key) => ({ ...acc, [key]: 0 }), {});

const withDerived = (totals) => {
  const row = { ...emptyTotals(), ...totals };
  row.totalSearches = row.desktopSearch + row.mobileSearch;
  row.totalMaps = row.desktopMaps + row.mobileMaps;
  row.totalImpressions = row.totalSearches + row.totalMaps;
  row.totalInteractions = row.callClicks + row.websiteClicks + row.directionRequests;
  return row;
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const labelFor = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTH_LABELS[m - 1]} ${y}`;
};

/** The months the realtime window covers, oldest first. */
const windowMonths = (count = PERFORMANCE_MONTHS) => {
  const months = [];
  const cursor = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
};

const listParam = (value) =>
  String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const pad = (n) => String(n).padStart(2, '0');
const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * The window the page asked for. `from`/`to` (YYYY-MM-DD) win; otherwise the last N months.
 * Day-level filtering happens inside the aggregation, since metrics are stored per month.
 */
const rangeOf = (req) => {
  const parse = (value) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  };

  let from = parse(req.query.from);
  let to = parse(req.query.to);
  if (from && to && from > to) [from, to] = [to, from];

  if (!from || !to) {
    const months = windowMonths(Number(req.query.months) || PERFORMANCE_MONTHS);
    const [fy, fm] = months[0].split('-').map(Number);
    from = new Date(fy, fm - 1, 1);
    to = new Date();
  }
  return { from, to, fromIso: isoOf(from), toIso: isoOf(to) };
};

/**
 * Cluster and folder, with cluster as the parent: a folder is narrower than the cluster it
 * belongs to, so when both are given the folder decides. Which folders a cluster holds comes
 * from the allocation sheet, not from the `cluster` field on each listing.
 */
const folderScope = (req) => {
  const clusters = listParam(req.query.cluster);
  const units = listParam(req.query.unit);
  if (units.length) return { folders: { $in: units } };
  if (clusters.length) return clusterFilter(clusters);
  return null;
};

const metricMatch = async (req) => {
  const match = {};
  const scope = folderScope(req);
  // Metrics are stored per listing and month and carry no folder list, so the folder scope is
  // turned into the listings it covers before the metrics are queried.
  if (scope) match.locationId = { $in: await RealtimeProfile.distinct('locationId', scope) };

  const range = rangeOf(req);
  // Narrow by month first so the unwind only touches the months in range.
  match.ym = { $gte: `${range.from.getFullYear()}-${pad(range.from.getMonth() + 1)}`, $lte: `${range.to.getFullYear()}-${pad(range.to.getMonth() + 1)}` };
  return { match, range };
};

const profileMatch = (req) => {
  // Folder membership, not the single primary folder, so picking a cluster or one of its
  // folders returns every listing Google shows inside it.
  return { ...(folderScope(req) || {}) };
};

/**
 * Which verification tiles a listing belongs to, using the SAME conditions as the counters in
 * /verification - so an export can always be reconciled against the tiles on screen. A
 * listing can be in several at once (a verified profile with Google updates, say), which is
 * why these are flags and not one value.
 */
const tileFlags = (p) => ({
  verified: p.hasVoiceOfMerchant === true,
  // Google's own Unverified filter: everything without Voice of Merchant, duplicates and
  // suspended listings included. The single label below splits those out.
  unverified: p.hasVoiceOfMerchant !== true,
  duplicate: p.duplicateOf != null,
  suspended: p.statusType === 'Suspended' || p.statusType === 'Disabled',
  pendingReview: p.statusType === 'Pending Verification',
  googleUpdates: p.hasGoogleUpdates === true,
  temporarilyClosed: p.openStatus === 'CLOSED_TEMPORARILY' || p.googleOpenStatus === 'CLOSED_TEMPORARILY',
  permanentlyClosed: p.openStatus === 'CLOSED_PERMANENTLY' || p.googleOpenStatus === 'CLOSED_PERMANENTLY',
  missingStoreCode: p.missingStoreCode === true,
});

/**
 * One verification status per listing, in the vocabulary the dashboard note uses: the five
 * unverified labels add up to the Unverified tile, and with Verified they add up to Total.
 */
const verificationLabel = (p) => {
  if (p.duplicateOf != null) return 'Duplicate';
  if (p.hasVoiceOfMerchant === true) return 'Verified';
  if (p.statusType === 'Suspended' || p.statusType === 'Disabled') return p.statusType;
  if (p.statusType === 'Pending Verification') return 'Pending Review';
  if (p.statusType === 'Ownership Conflict') return 'Ownership Conflict';
  return 'Need to verify';
};

/** The tile filters, shared by /profiles and /export so both always agree. */
const withStatus = (match, value) => {
  const status = String(value || '').trim();
  if (status === 'verified') match.hasVoiceOfMerchant = true;
  else if (status === 'unverified') match.hasVoiceOfMerchant = false;
  // Unverified with the two groups that have their own tiles taken out, so the three lists
  // add back up to Unverified without a profile appearing twice.
  else if (status === 'need-to-verify') {
    match.hasVoiceOfMerchant = false;
    match.duplicateOf = null;
    match.statusType = { $nin: ['Suspended', 'Disabled'] };
  }
  else if (status === 'duplicate') match.duplicateOf = { $ne: null };
  else if (status === 'suspended') match.statusType = { $in: ['Suspended', 'Disabled'] };
  else if (status === 'closed') match.$or = [{ openStatus: 'CLOSED_PERMANENTLY' }, { googleOpenStatus: 'CLOSED_PERMANENTLY' }];
  else if (status === 'temporarily-closed') match.$or = [{ openStatus: 'CLOSED_TEMPORARILY' }, { googleOpenStatus: 'CLOSED_TEMPORARILY' }];
  else if (status === 'pending-review') match.statusType = 'Pending Verification';
  else if (status === 'google-updates') match.hasGoogleUpdates = true;
  else if (status === 'missing-store-code') match.missingStoreCode = true;
  return match;
};

const publicSettings = (doc) => ({
  connected: !!doc.connected,
  email: doc.email || null,
  name: doc.name || null,
  picture: doc.picture || null,
  connectedAt: doc.connectedAt || null,
  connectedBy: doc.connectedBy || null,
  accounts: (doc.accounts || []).map((a) => ({ name: a.name, accountName: a.accountName })),
  configured: google.isConfigured(),
  redirectUri: google.redirectUri(),
  sync: {
    status: isRunning() ? 'running' : doc.sync?.status || 'idle',
    failedAccounts: doc.sync?.failedAccounts || [],
    mode: doc.sync?.mode || null,
    phase: doc.sync?.phase || null,
    startedAt: doc.sync?.startedAt || null,
    finishedAt: doc.sync?.finishedAt || null,
    processed: doc.sync?.processed || 0,
    total: doc.sync?.total || 0,
    profilesSynced: doc.sync?.profilesSynced || 0,
    lastSuccessAt: doc.sync?.lastSuccessAt || null,
    lastFullSyncAt: doc.sync?.lastFullSyncAt || null,
    error: doc.sync?.error || null,
  },
});

/* ───────────────────────── OAuth endpoints ───────────────────────── */

const stateSecret = () => process.env.GOOGLE_OAUTH_CLIENT_SECRET || 'manipal-realtime-state';

const signState = (payload) => {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', stateSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
};

const readState = (state) => {
  const [body, sig] = String(state || '').split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', stateSecret()).update(body).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (Date.now() - payload.t > 10 * 60 * 1000) return null; // 10 minute window
    return payload;
  } catch {
    return null;
  }
};

const frontendBase = (origin) =>
  origin || process.env.REALTIME_FRONTEND_URL || 'http://localhost:8080';

router.get('/google/status', async (req, res) => {
  try {
    const settings = await getSettings();
    const [profiles, metrics] = await Promise.all([
      RealtimeProfile.estimatedDocumentCount(),
      RealtimeMetric.estimatedDocumentCount(),
    ]);
    res.json({ success: true, data: { ...publicSettings(settings), counts: { profiles, metrics } } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Starts the consent flow. Only one mailbox may be connected, so this replaces any existing one. */
router.get('/google/connect', async (req, res) => {
  if (!google.isConfigured()) {
    return res.status(400).json({
      success: false,
      error: 'Google OAuth is not configured on the server (GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET).',
    });
  }
  const state = signState({
    t: Date.now(),
    n: crypto.randomBytes(8).toString('hex'),
    origin: req.query.origin || '',
    user: req.query.user || '',
  });
  res.redirect(google.authorizationUrl(state));
});

router.get('/google/callback', async (req, res) => {
  const payload = readState(req.query.state);
  const back = (status, detail) => {
    const base = frontendBase(payload?.origin);
    const params = new URLSearchParams({ google: status });
    if (detail) params.set('message', detail);
    return res.redirect(`${base.replace(/\/$/, '')}/#/settings?${params.toString()}`);
  };

  if (!payload) return back('error', 'The sign-in link expired. Please try connecting again.');
  if (req.query.error) return back('error', String(req.query.error));
  if (!req.query.code) return back('error', 'Google did not return an authorisation code.');

  try {
    const tokens = await google.exchangeCode(String(req.query.code));
    if (!tokens.refresh_token) {
      return back('error', 'Google did not return a refresh token. Remove the app at myaccount.google.com and reconnect.');
    }
    const profile = await google.fetchUserInfo(tokens.access_token);

    const settings = await getSettings();
    settings.connected = true;
    settings.email = (profile.email || '').toLowerCase();
    settings.name = profile.name || '';
    settings.picture = profile.picture || '';
    settings.googleSub = profile.sub;
    settings.scopes = String(tokens.scope || '').split(' ').filter(Boolean);
    settings.connectedAt = new Date();
    settings.connectedBy = payload.user || '';
    settings.accessTokenEnc = google.encrypt(tokens.access_token);
    settings.refreshTokenEnc = google.encrypt(tokens.refresh_token);
    settings.accessTokenExpiresAt = new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000);
    settings.sync = { ...(settings.sync?.toObject?.() || {}), status: 'idle', error: null };
    await settings.save();

    clearCache();
    // First connect: pull the whole 6-month window straight away.
    runSync({ mode: 'full', trigger: 'connect' }).catch((err) => console.error('[realtime]', err));

    return back('connected');
  } catch (error) {
    console.error('[realtime] OAuth callback failed:', error.message);
    return back('error', error.message);
  }
});

router.post('/google/disconnect', async (req, res) => {
  try {
    const settings = await getSettings();
    const refresh = google.decrypt(settings.refreshTokenEnc);
    if (refresh) await google.revokeToken(refresh);

    settings.connected = false;
    settings.email = null;
    settings.name = null;
    settings.picture = null;
    settings.googleSub = null;
    settings.scopes = [];
    settings.accessTokenEnc = null;
    settings.refreshTokenEnc = null;
    settings.accessTokenExpiresAt = null;
    settings.accounts = [];
    settings.connectedAt = null;
    await settings.save();

    clearCache();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ───────────────────────── sync endpoints ───────────────────────── */

router.post('/sync/run', async (req, res) => {
  try {
    const requested = req.body?.mode;
    const mode = ['full', 'incremental', 'profiles', 'counts'].includes(requested) ? requested : 'incremental';
    const result = await runSync({ mode, trigger: 'manual' });
    clearCache();
    if (!result.started) return res.status(409).json({ success: false, error: result.reason });
    res.json({ success: true, data: { started: true, mode } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/sync/status', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json({ success: true, data: publicSettings(settings).sync });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ──────────────────────── dashboard endpoints ──────────────────────── */

/** Filter options plus connection freshness - one small call the page makes first. */
router.get('/meta', async (req, res) => {
  try {
    const data = await cached('meta', async () => {
      const [units, settings] = await Promise.all([
        // Every Google folder, not just the primary one per listing, so the picker offers the
        // same folders the status table shows.
        RealtimeProfile.distinct('folders'),
        getSettings(),
      ]);
      const folders = units.filter(Boolean).sort();
      return {
        // The allocation sheet's clusters, and its folder assignment: the folder picker
        // offers only the folders of the chosen cluster, and anything the sheet leaves out
        // is reachable under Others.
        clusters: CLUSTERS,
        units: folders,
        unitClusters: Object.fromEntries(folders.map((folder) => [folder, clustersOf(folder)])),
        months: windowMonths().map((ym) => ({ ym, label: labelFor(ym) })),
        lastSyncAt: settings.sync?.lastSuccessAt || null,
        connected: !!settings.connected,
        email: settings.email || null,
      };
    });
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Performance roll-ups for the selected folder and date range: headline totals, the trend
 * series, and the per-unit and per-profile tables.
 *
 * Metrics are stored one document per location per month with a day array, so the range is
 * applied by unwinding those days - one pass, split into facets.
 */
router.get('/overview', async (req, res) => {
  try {
    const { match, range } = await metricMatch(req);
    const key = `overview:${JSON.stringify({ match, from: range.fromIso, to: range.toIso })}`;

    const data = await cached(key, async () => {
      // Day buckets for a short window, month buckets for a long one.
      const spanDays = Math.round((range.to - range.from) / 86400000) + 1;
      const byDay = spanDays <= 62;

      const daySum = (key) => ({ $sum: `$days.${key}` });
      const sumDays = () => METRIC_KEYS.reduce((acc, k) => ({ ...acc, [k]: daySum(k) }), {});

      const pipeline = [
        { $match: match },
        { $unwind: '$days' },
        {
          $addFields: {
            dateKey: {
              $concat: [
                { $toString: '$year' },
                '-',
                { $cond: [{ $lt: ['$month', 10] }, { $concat: ['0', { $toString: '$month' }] }, { $toString: '$month' }] },
                '-',
                { $cond: [{ $lt: ['$days.day', 10] }, { $concat: ['0', { $toString: '$days.day' }] }, { $toString: '$days.day' }] },
              ],
            },
          },
        },
        { $match: { dateKey: { $gte: range.fromIso, $lte: range.toIso } } },
        {
          $facet: {
            series: [
              { $group: { _id: byDay ? '$dateKey' : '$ym', ...sumDays() } },
              { $sort: { _id: 1 } },
            ],
            units: [
              {
                $group: {
                  _id: { unitName: '$unitName', cluster: '$cluster' },
                  ...sumDays(),
                  profiles: { $addToSet: '$locationId' },
                },
              },
              { $addFields: { profiles: { $size: '$profiles' } } },
            ],
            profiles: [
              { $group: { _id: { locationId: '$locationId', title: '$title', unitName: '$unitName' }, ...sumDays() } },
              { $addFields: { impressions: { $add: ['$desktopSearch', '$mobileSearch', '$desktopMaps', '$mobileMaps'] } } },
              { $sort: { impressions: -1 } },
              { $limit: 10 },
            ],
          },
        },
      ];

      const [result] = await RealtimeMetric.aggregate(pipeline).allowDiskUse(true);
      const rows = result || { series: [], units: [], profiles: [] };

      const pick = (row) => METRIC_KEYS.reduce((acc, k) => ({ ...acc, [k]: row[k] || 0 }), {});

      const series = rows.series.map((row) => ({
        key: row._id,
        label: byDay ? row._id.slice(8) + ' ' + labelFor(row._id.slice(0, 7)).slice(0, 3) : labelFor(row._id),
        ...withDerived(pick(row)),
      }));

      const totals = withDerived(
        rows.series.reduce((acc, row) => {
          METRIC_KEYS.forEach((k) => {
            acc[k] = (acc[k] || 0) + (row[k] || 0);
          });
          return acc;
        }, {})
      );

      // Trend arrows compare the last two buckets in view.
      const current = series[series.length - 1] || withDerived({});
      const previous = series[series.length - 2] || withDerived({});

      const units = rows.units
        .map((row) => ({
          unitName: row._id.unitName,
          cluster: row._id.cluster,
          profiles: row.profiles,
          ...withDerived(pick(row)),
        }))
        .sort((a, b) => b.totalImpressions - a.totalImpressions);

      return {
        range: { from: range.fromIso, to: range.toIso, granularity: byDay ? 'day' : 'month' },
        totals,
        current: { label: current.label || null, ...withDerived(current) },
        previous: { label: previous.label || null, ...withDerived(previous) },
        series,
        monthly: series, // kept so existing callers keep working
        units,
        topProfiles: rows.profiles.map((row) => ({
          locationId: row._id.locationId,
          title: row._id.title,
          unitName: row._id.unitName,
          ...withDerived(pick(row)),
        })),
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Profile Verification Status, live from Google.
 * Total = Verified + Unverified. Suspended and Duplicates are counted inside Unverified, the
 * same way the monthly dashboard reads these numbers.
 */
router.get('/verification', async (req, res) => {
  try {
    const match = profileMatch(req);
    const key = `verification:${JSON.stringify(match)}`;

    const data = await cached(key, async () => {
      // Counting stage, shared by the per-folder rows and the de-duplicated totals.
      const counters = {
            total: { $sum: 1 },
            // Google's own "verified" signal, which is what the UI's Verified filter counts.
            verified: { $sum: { $cond: ['$hasVoiceOfMerchant', 1, 0] } },
            duplicates: { $sum: { $cond: [{ $ne: ['$duplicateOf', null] }, 1, 0] } },
            suspended: { $sum: { $cond: [{ $in: ['$statusType', ['Suspended', 'Disabled']] }, 1, 0] } },
            // Unverified minus the duplicates and suspended listings, counted in one pass so a
            // profile that is both is removed once rather than subtracted twice.
            needToVerify: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $not: ['$hasVoiceOfMerchant'] },
                      { $eq: ['$duplicateOf', null] },
                      { $not: [{ $in: ['$statusType', ['Suspended', 'Disabled']] }] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            // Either the owner-set status or the one Google reports - the UI counts both.
            permanentlyClosed: {
              $sum: { $cond: [{ $or: [{ $eq: ['$openStatus', 'CLOSED_PERMANENTLY'] }, { $eq: ['$googleOpenStatus', 'CLOSED_PERMANENTLY'] }] }, 1, 0] },
            },
            temporarilyClosed: {
              $sum: { $cond: [{ $or: [{ $eq: ['$openStatus', 'CLOSED_TEMPORARILY'] }, { $eq: ['$googleOpenStatus', 'CLOSED_TEMPORARILY'] }] }, 1, 0] },
            },
            pendingReview: { $sum: { $cond: [{ $eq: ['$statusType', 'Pending Verification'] }, 1, 0] } },
            googleUpdates: { $sum: { $cond: ['$hasGoogleUpdates', 1, 0] } },
            missingStoreCodes: { $sum: { $cond: ['$missingStoreCode', 1, 0] } },
      };

      const [rows, [distinct] = []] = await Promise.all([
        // One row per Google folder. A listing in both a unit folder and its cluster folder is
        // counted in each, exactly as Business Profile Manager shows it.
        RealtimeProfile.aggregate([
          { $match: match },
          { $unwind: { path: '$folders', preserveNullAndEmptyArrays: true } },
          // Grouped by folder ALONE. Including the cluster here split one folder into a row
          // per cluster, so a folder's count arrived cut into pieces.
          {
            $group: {
              _id: { $ifNull: ['$folders', '$unitName'] },
              ...counters,
              clusters: { $addToSet: '$cluster' },
            },
          },
          { $sort: { total: -1 } },
        ]),
        // Headline tiles count each listing once, however many folders it sits in.
        RealtimeProfile.aggregate([{ $match: match }, { $group: { _id: null, ...counters } }]),
      ]);

      const units = rows.map((row) => ({
        unitName: row._id,
        cluster: (row.clusters || []).filter((c) => c && c !== 'Unassigned').sort()[0] || 'Unassigned',
        total: row.total,
        verified: row.verified,
        unverified: row.total - row.verified,
        needToVerify: row.needToVerify,
        duplicates: row.duplicates,
        suspended: row.suspended,
        permanentlyClosed: row.permanentlyClosed,
        temporarilyClosed: row.temporarilyClosed,
        pendingReview: row.pendingReview,
        googleUpdates: row.googleUpdates,
        missingStoreCodes: row.missingStoreCodes,
        verificationRate: row.total ? Math.round((row.verified / row.total) * 100) : 0,
      }));

      const COUNT_KEYS = [
        'total',
        'verified',
        'unverified',
        'needToVerify',
        'duplicates',
        'suspended',
        'permanentlyClosed',
        'temporarilyClosed',
        'pendingReview',
        'googleUpdates',
        'missingStoreCodes',
      ];
      const totals = COUNT_KEYS.reduce(
        (acc, k) => ({ ...acc, [k]: k === 'unverified' ? 0 : (distinct?.[k] ?? 0) }),
        {}
      );
      totals.unverified = totals.total - totals.verified;
      totals.needAction = totals.unverified + totals.missingStoreCodes;
      totals.verificationRate = totals.total ? Math.round((totals.verified / totals.total) * 100) : 0;

      return { totals, units };
    });

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** The profile list behind the status tiles - paged, and used for the Excel export. */
router.get('/profiles', async (req, res) => {
  try {
    const match = withStatus(profileMatch(req), req.query.status);

    const search = String(req.query.q || '').trim();
    if (search) match.title = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };

    const limit = Math.min(Number(req.query.limit) || 100, 5000);
    const page = Math.max(Number(req.query.page) || 1, 1);

    const [items, total] = await Promise.all([
      RealtimeProfile.find(match, {
        locationId: 1,
        title: 1,
        storeCode: 1,
        unitName: 1,
        cluster: 1,
        phone: 1,
        website: 1,
        address: 1,
        statusType: 1,
        openStatus: 1,
        hasVoiceOfMerchant: 1,
        duplicateOf: 1,
        missingStoreCode: 1,
        mapsUri: 1,
        hasGoogleUpdates: 1,
        googleUpdateFields: 1,
        googleOpenStatus: 1,
      })
        .sort({ title: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      RealtimeProfile.countDocuments(match),
    ]);

    res.json({ success: true, data: { items, total, page, limit } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Everything the realtime collections hold about the selected profiles.
 *
 * `insights=0` returns the profile records alone - what the tiles with no performance of their
 * own (duplicates, closed, missing store codes) export. Otherwise performance is included for
 * `months=1|3|6`, or for an explicit `from`/`to` range, or - with neither - the whole stored
 * history. Day-level filtering is the same the charts use, so an export can always be
 * reconciled against what is on screen.
 */
router.get('/export', async (req, res) => {
  try {
    const match = withStatus(profileMatch(req), req.query.status);
    const wantsInsights = String(req.query.insights ?? '1') !== '0';
    const hasRange = !!((req.query.from && req.query.to) || req.query.months);
    const range = wantsInsights && hasRange ? rangeOf(req) : null;

    const profiles = await RealtimeProfile.find(match).sort({ unitName: 1, title: 1 }).lean();
    const emptyPayload = {
      insights: wantsInsights,
      overall: wantsInsights && !hasRange,
      range: range ? { from: range.fromIso, to: range.toIso } : null,
      monthsCovered: null,
      generatedAt: new Date(),
      rows: [],
    };
    if (!profiles.length) return res.json({ success: true, data: emptyPayload });

    // Business details only: no month aggregation at all, so these exports stay instant.
    if (!wantsInsights) {
      return res.json({
        success: true,
        data: {
          ...emptyPayload,
          rows: profiles.map((profile) => ({
            ...profile,
            verificationStatus: verificationLabel(profile),
            tiles: tileFlags(profile),
          })),
        },
      });
    }

    const locationIds = profiles.map((p) => p.locationId);
    const metricMatchStage = { locationId: { $in: locationIds } };
    if (range) {
      metricMatchStage.ym = {
        $gte: `${range.from.getFullYear()}-${pad(range.from.getMonth() + 1)}`,
        $lte: `${range.to.getFullYear()}-${pad(range.to.getMonth() + 1)}`,
      };
    }

    const daySum = (key) => ({ $sum: `$days.${key}` });
    const sumDays = () => METRIC_KEYS.reduce((acc, k) => ({ ...acc, [k]: daySum(k) }), {});

    const pipeline = [
      { $match: metricMatchStage },
      { $unwind: '$days' },
    ];
    if (range) {
      pipeline.push(
        {
          $addFields: {
            dateKey: {
              $concat: [
                { $toString: '$year' },
                '-',
                { $cond: [{ $lt: ['$month', 10] }, { $concat: ['0', { $toString: '$month' }] }, { $toString: '$month' }] },
                '-',
                { $cond: [{ $lt: ['$days.day', 10] }, { $concat: ['0', { $toString: '$days.day' }] }, { $toString: '$days.day' }] },
              ],
            },
          },
        },
        { $match: { dateKey: { $gte: range.fromIso, $lte: range.toIso } } }
      );
    }
    pipeline.push(
      { $group: { _id: { locationId: '$locationId', ym: '$ym' }, ...sumDays() } },
      { $sort: { '_id.ym': 1 } }
    );

    const monthRows = await RealtimeMetric.aggregate(pipeline).allowDiskUse(true);

    const byLocation = new Map();
    for (const row of monthRows) {
      const list = byLocation.get(row._id.locationId) || [];
      list.push({ ym: row._id.ym, label: labelFor(row._id.ym), ...withDerived(row) });
      byLocation.set(row._id.locationId, list);
    }

    const rows = profiles.map((profile) => {
      const months = byLocation.get(profile.locationId) || [];
      const summed = months.reduce((acc, month) => {
        METRIC_KEYS.forEach((k) => { acc[k] = (acc[k] || 0) + (month[k] || 0); });
        return acc;
      }, {});
      return {
        ...profile,
        verificationStatus: verificationLabel(profile),
        tiles: tileFlags(profile),
        performance: withDerived(summed),
        monthsCovered: months.length,
        months,
      };
    });

    // Every month the window spans, so month-by-month columns line up across profiles even
    // where one of them has no data for a month.
    const covered = monthRows.map((r) => r._id.ym).sort();
    const spanned = new Set(covered);
    if (range) {
      const cursor = new Date(range.from.getFullYear(), range.from.getMonth(), 1);
      const last = new Date(range.to.getFullYear(), range.to.getMonth(), 1);
      while (cursor <= last) {
        spanned.add(`${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`);
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }
    const window = [...spanned].sort().map((ym) => ({ ym, label: labelFor(ym) }));

    res.json({
      success: true,
      data: {
        insights: true,
        window,
        overall: !hasRange,
        range: range ? { from: range.fromIso, to: range.toIso } : null,
        monthsCovered: covered.length ? { first: covered[0], last: covered[covered.length - 1] } : null,
        generatedAt: new Date(),
        rows,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ───────────────────────── optimization report ───────────────────────── */

/**
 * The nine content checks, in the order the report lists them.
 *
 * `done` is the pass/fail; `detail` is what the sheet shows next to it, so a gap can be acted
 * on without opening Google. Cover photo and logo are one check, as both belong to the same
 * piece of work, but the sheet still names which of the two is missing.
 *
 * Phone, website and the review link come from the listing itself, so they are always current.
 * WhatsApp, the appointment link, the cover photo and the logo come from the two per-listing
 * calls in the optimization phase of the sync, which refreshes a listing once a day.
 */
const OPTIMIZATION_CHECKS = [
  {
    id: 'coverLogo',
    label: 'Cover Photo & Logo',
    done: (p) => p.optimization?.coverPhoto === true && p.optimization?.logo === true,
    detail: (p) => {
      const logoLabel = p.optimization?.legacyLogo && !p.optimization?.profilePhoto ? 'Logo' : 'Logo (profile photo)';
      const have = [p.optimization?.coverPhoto && 'Cover photo', p.optimization?.logo && logoLabel].filter(Boolean);
      const photos = p.optimization?.photoCount || 0;
      const count = `${photos} photo${photos === 1 ? '' : 's'}`;
      if (have.length === 2) return `Both set (${count})`;
      if (have.length === 1) return `${have[0]} only (${count})`;
      return photos ? `Neither set (${count})` : 'No photos';
    },
  },
  {
    id: 'description',
    label: 'Business Description',
    done: (p) => (p.optimization?.descriptionLength || 0) > 0,
    detail: (p) => {
      const length = p.optimization?.descriptionLength || 0;
      return length ? `${length} characters` : 'Empty';
    },
  },
  {
    id: 'hours',
    label: 'Working Hours',
    done: (p) => (p.optimization?.hourPeriods || 0) > 0,
    detail: (p) => {
      const periods = p.optimization?.hourPeriods || 0;
      return periods ? `${periods} opening period${periods === 1 ? '' : 's'}` : 'Not set';
    },
  },
  {
    id: 'services',
    label: 'Services',
    done: (p) => (p.optimization?.serviceCount || 0) > 0,
    detail: (p) => {
      const count = p.optimization?.serviceCount || 0;
      return count ? `${count} service${count === 1 ? '' : 's'}` : 'None listed';
    },
  },
  {
    id: 'phone',
    label: 'Phone Number',
    done: (p) => (p.phone || '').trim().length > 0,
    detail: (p) => (p.phone || '').trim() || 'Not set',
  },
  {
    id: 'website',
    label: 'Website',
    done: (p) => (p.website || '').trim().length > 0,
    detail: (p) => (p.website || '').trim() || 'Not set',
  },
  {
    id: 'whatsapp',
    label: 'Whatsapp Chat',
    done: (p) => (p.optimization?.whatsapp || '').trim().length > 0,
    detail: (p) => (p.optimization?.whatsapp || '').trim() || 'Not set',
  },
  {
    id: 'appointment',
    label: 'Appointment Link',
    done: (p) => (p.optimization?.appointment || '').trim().length > 0,
    detail: (p) => (p.optimization?.appointment || '').trim() || 'Not set',
  },
  {
    id: 'review',
    label: 'Review Links',
    done: (p) => (p.optimization?.reviewLink || '').trim().length > 0,
    detail: (p) => (p.optimization?.reviewLink || '').trim() || 'Not set',
  },
];

/**
 * Who may read the report. Mirrors src/lib/optimizationAccess.ts - the sidebar there decides
 * what is shown, this decides what is served. Override with REALTIME_OPTIMIZATION_EMAILS
 * (comma separated) to add or move the mailbox without a code change.
 *
 * The caller identifies itself with the x-user-email header, which useRealtimeData.ts attaches
 * to every realtime request. Note what this is and is not: the dashboard keeps its signed-in
 * user in localStorage and the API has no session of its own, so this check keeps the section
 * out of every other account's dashboard, but it cannot stop someone who writes the header by
 * hand. Real enforcement needs a server-side session, which this app does not yet have.
 */
const OPTIMIZATION_EMAILS = (process.env.REALTIME_OPTIMIZATION_EMAILS || 'harsh@multipliersolutions.com')
  .split(',')
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean);

const optimizationCaller = (req) =>
  String(req.headers['x-user-email'] || req.query.email || '').trim().toLowerCase();

/**
 * Completeness of every listing's content against the nine checks, with the per-check totals
 * the card on screen shows and the rows the downloaded report is built from.
 */
router.get('/optimization', async (req, res) => {
  try {
    const caller = optimizationCaller(req);
    if (!caller || !OPTIMIZATION_EMAILS.includes(caller)) {
      // Logged so a genuine access problem is distinguishable from an empty report.
      console.warn(`[optimization] refused for ${caller || '(no email sent)'}`);
      return res.status(403).json({ success: false, error: 'This section is restricted.' });
    }

    const match = withStatus(profileMatch(req), req.query.status);
    // Only the fields the nine checks and the report columns need. The description text is
    // deliberately left out - descriptionLength is all the report shows, and the full text for
    // 3k listings is most of what this query would otherwise transfer. Halves the query time.
    const projection = {
      _id: 0,
      locationId: 1, title: 1, storeCode: 1, unitName: 1, cluster: 1, department: 1,
      primaryCategory: 1, folders: 1, mapsUri: 1, phone: 1, website: 1,
      duplicateOf: 1, hasVoiceOfMerchant: 1, statusType: 1,
      'optimization.descriptionLength': 1,
      'optimization.hourPeriods': 1,
      'optimization.serviceCount': 1,
      'optimization.reviewLink': 1,
      'optimization.whatsapp': 1,
      'optimization.appointment': 1,
      'optimization.coverPhoto': 1,
      'optimization.logo': 1,
      'optimization.profilePhoto': 1,
      'optimization.legacyLogo': 1,
      'optimization.photoCount': 1,
      'optimization.checkedAt': 1,
      'optimization.error': 1,
    };
    const key = `optimization:${JSON.stringify(match)}`;
    const profiles = await cached(key, () =>
      RealtimeProfile.find(match, projection).sort({ unitName: 1, title: 1 }).lean()
    );

    const tally = OPTIMIZATION_CHECKS.map((check) => ({ id: check.id, label: check.label, complete: 0 }));
    // A listing the optimization phase has never managed to read would otherwise look like
    // four genuine gaps, so the report says how many listings are actually covered.
    let awaitingFirstCheck = 0;

    const rows = profiles.map((p) => {
      const checks = {};
      const details = {};
      let score = 0;
      OPTIMIZATION_CHECKS.forEach((check, i) => {
        const ok = check.done(p);
        checks[check.id] = ok;
        details[check.id] = check.detail(p);
        if (ok) {
          score += 1;
          tally[i].complete += 1;
        }
      });
      if (!p.optimization?.checkedAt) awaitingFirstCheck += 1;

      return {
        locationId: p.locationId,
        title: p.title || '',
        storeCode: p.storeCode || '',
        unitName: p.unitName || '',
        cluster: p.cluster || '',
        department: p.department || '',
        primaryCategory: p.primaryCategory || '',
        folders: p.folders || [],
        mapsUri: p.mapsUri || '',
        verificationStatus: verificationLabel(p),
        checks,
        details,
        score,
        total: OPTIMIZATION_CHECKS.length,
        checkedAt: p.optimization?.checkedAt || null,
        error: p.optimization?.error || '',
      };
    });

    const totalScore = rows.reduce((sum, r) => sum + r.score, 0);

    res.json({
      success: true,
      data: {
        total: profiles.length,
        checks: tally.map((t) => ({
          ...t,
          missing: profiles.length - t.complete,
          percent: profiles.length ? Math.round((t.complete / profiles.length) * 1000) / 10 : 0,
        })),
        averageScore: profiles.length ? Math.round((totalScore / profiles.length) * 100) / 100 : 0,
        maxScore: OPTIMIZATION_CHECKS.length,
        fullyOptimized: rows.filter((r) => r.score === OPTIMIZATION_CHECKS.length).length,
        awaitingFirstCheck,
        generatedAt: new Date(),
        rows,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = { router, clearCache };
