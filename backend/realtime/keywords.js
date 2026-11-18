const mongoose = require('mongoose');
const { RealtimeProfile } = require('./models');
const { runPool } = require('./pool');

/**
 * Search terms that brought Manipal listings up on Google - the "search preference" data,
 * collected per month into realtimeKeywords for whatever wants to read it.
 *
 * Google publishes these per listing and per month, so a faithful roll-up means one call per
 * listing per month - far too much to repeat on every sync. Two things keep it affordable:
 * a month is only ever read once (the figures for a closed month do not change), and the
 * rows are aggregated as they arrive, so what is stored is one document per keyword per
 * month rather than one per listing.
 *
 * Low-volume terms come back as a threshold band ("fewer than N") rather than a number.
 * Those are counted separately and left out of the impression totals, because adding a band
 * to a sum would invent volume that Google did not report.
 */

const KEYWORD_PAGES = Number(process.env.REALTIME_KEYWORD_PAGES || 2);
const PAGE_SIZE = 100;

/**
 * How long after a month ends its figures are treated as final.
 *
 * Google publishes this data with a lag and fills a month in over several days, so a month
 * read the day after it closed can be short. Until it is this old it is re-read on each
 * daily run; after that it is never read again. Nothing is published as final that Google
 * might still be adding to.
 */
const SETTLE_DAYS = Number(process.env.REALTIME_KEYWORD_SETTLE_DAYS || 10);

const RealtimeKeywordSchema = new mongoose.Schema(
  {
    // "2026-10"
    ym: { type: String, required: true },
    keyword: { type: String, required: true },

    /** Impressions Google reported as a number, summed over the listings that returned it. */
    impressions: { type: Number, default: 0 },
    /** Listings the keyword surfaced, whether as a number or as a threshold. */
    profiles: { type: Number, default: 0 },
    /**
     * Listings where Google only gave a threshold band. `impressions` excludes them, so a
     * keyword with a high threshold share is under-counted, and a reader comparing the two
     * counts can see by how much.
     */
    thresholdProfiles: { type: Number, default: 0 },
    /** The largest band Google quoted, so the under-count has a known ceiling. */
    thresholdCeiling: { type: Number, default: 0 },

    /** Same two figures split by cluster, for the per-cluster best/weakest tables. */
    byCluster: { type: Map, of: Number, default: () => new Map() },
    clusterProfiles: { type: Map, of: Number, default: () => new Map() },

    lastSyncedAt: Date,
  },
  { collection: 'realtimeKeywords', timestamps: true }
);

RealtimeKeywordSchema.index({ ym: 1, keyword: 1 }, { unique: true });
RealtimeKeywordSchema.index({ ym: 1, impressions: -1 });

/** One document per month synced, so a month is never read twice. */
const RealtimeKeywordMonthSchema = new mongoose.Schema(
  {
    _id: String, // "2026-10"
    year: Number,
    month: Number,
    /** Listings called, and how many answered with at least one keyword. */
    locationsCalled: { type: Number, default: 0 },
    locationsWithData: { type: Number, default: 0 },
    keywords: { type: Number, default: 0 },
    impressions: { type: Number, default: 0 },
    /** False while Google is still filling the month in, so a reader can label it. */
    complete: { type: Boolean, default: false },
    syncedAt: Date,
  },
  { collection: 'realtimeKeywordMonths', _id: false, timestamps: true }
);

const RealtimeKeyword = mongoose.model('RealtimeKeyword', RealtimeKeywordSchema);
const RealtimeKeywordMonth = mongoose.model('RealtimeKeywordMonth', RealtimeKeywordMonthSchema);

/* ──────────────────────────── helpers ──────────────────────────── */

const ymOf = (year, month) => `${year}-${String(month).padStart(2, '0')}`;

/** When a month stops being re-read: SETTLE_DAYS after the month itself ended. */
const settledAt = (month) =>
  new Date(month.year, month.month, 1).getTime() + SETTLE_DAYS * 86400000;

/**
 * The last `count` closed months, oldest first.
 *
 * Never the current one: Google publishes nothing for a month in progress (a request for it
 * comes back empty), so asking for it would be one wasted call per listing per day.
 */
const recentMonths = (count) => {
  const out = [];
  const now = new Date();
  for (let i = count; i >= 1; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ year: d.getFullYear(), month: d.getMonth() + 1, ym: ymOf(d.getFullYear(), d.getMonth() + 1) });
  }
  return out;
};

/* ──────────────────────────── the sync ──────────────────────────── */

/**
 * @param months  which months to read; defaults to any of the last `lookback` complete
 *                months that has not been stored yet.
 * @param force   re-read months already stored (after a mapping change, say).
 * @param maxMonths  how many missing months one run may read. The daily sync uses a small
 *                   number so a cold start catches up over a few days instead of making
 *                   tens of thousands of calls in a single run.
 * @param locationIds  restricts the run to these listings, for trying a month out before
 *                     spending a call on every listing in the estate.
 */
const syncKeywords = async (
  client,
  { months, lookback = 12, force = false, maxMonths = 0, concurrency = 8, onProgress, onPhase, locationIds } = {}
) => {
  const wanted = months || recentMonths(lookback);
  const done = force ? [] : await RealtimeKeywordMonth.find({ complete: true }, { _id: 1 }).lean();
  const skip = new Set(done.map((d) => d._id));
  // Newest first: the month just gone is the one most likely to be wanted, so a run that is
  // only allowed a couple of months spends them there rather than on the oldest history.
  const pending = wanted.filter((m) => !skip.has(m.ym)).reverse();
  const todo = maxMonths > 0 ? pending.slice(0, maxMonths) : pending;
  if (!todo.length) return { months: [], keywords: 0, pending: 0 };

  // Google answers 403 for listings with no performance access, exactly as it does for the
  // daily metrics, so the same filter saves the same wasted calls.
  const profiles = await RealtimeProfile.find(
    {
      duplicateOf: null,
      openStatus: { $ne: 'CLOSED_PERMANENTLY' },
      hasVoiceOfMerchant: true,
      ...(locationIds?.length ? { locationId: { $in: locationIds } } : {}),
    },
    { locationId: 1, cluster: 1, _id: 0 }
  ).lean();

  const written = [];

  // One listing per month is one unit of work; counted across every month so a two-month run
  // fills the caller's bar once rather than twice.
  onPhase?.('keywords', todo.length * profiles.length);

  for (const [monthIndex, month] of todo.entries()) {
    /** keyword -> running totals, accumulated in memory and written once per month. */
    const totals = new Map();
    let locationsWithData = 0;

    const add = (keyword, cluster, value, threshold) => {
      let row = totals.get(keyword);
      if (!row) {
        row = { impressions: 0, profiles: 0, thresholdProfiles: 0, thresholdCeiling: 0, byCluster: {}, clusterProfiles: {} };
        totals.set(keyword, row);
      }
      row.profiles += 1;
      row.clusterProfiles[cluster] = (row.clusterProfiles[cluster] || 0) + 1;
      if (threshold) {
        row.thresholdProfiles += 1;
        row.thresholdCeiling = Math.max(row.thresholdCeiling, threshold);
        return;
      }
      row.impressions += value;
      row.byCluster[cluster] = (row.byCluster[cluster] || 0) + value;
    };

    await runPool(
      profiles,
      async (profile) => {
        let pageToken;
        let pages = 0;
        let any = false;
        do {
          let data;
          try {
            data = await client.searchKeywords(profile.locationId, month.year, month.month, {
              pageSize: PAGE_SIZE,
              pageToken,
            });
          } catch (err) {
            if (err.status === 403 || err.status === 404) return; // no keyword access
            throw err;
          }
          const rows = data.searchKeywordsCounts || [];
          const cluster = profile.cluster || 'Unassigned';
          for (const row of rows) {
            const keyword = String(row.searchKeyword || '').trim().toLowerCase();
            if (!keyword) continue;
            const value = Number(row.insightsValue?.value);
            const threshold = Number(row.insightsValue?.threshold);
            if (Number.isFinite(value)) add(keyword, cluster, value, 0);
            else if (Number.isFinite(threshold)) add(keyword, cluster, 0, threshold);
          }
          if (rows.length) any = true;
          pages += 1;
          pageToken = data.nextPageToken;
        } while (pageToken && pages < KEYWORD_PAGES);
        if (any) locationsWithData += 1;
      },
      concurrency,
      onProgress ? (done) => onProgress(monthIndex * profiles.length + done) : undefined
    );

    const ops = [...totals.entries()].map(([keyword, row]) => ({
      updateOne: {
        filter: { ym: month.ym, keyword },
        update: { $set: { ym: month.ym, keyword, ...row, lastSyncedAt: new Date() } },
        upsert: true,
      },
    }));
    // Rows from a previous partial run would otherwise survive alongside the new ones.
    if (!locationIds?.length) await RealtimeKeyword.deleteMany({ ym: month.ym });
    for (let i = 0; i < ops.length; i += 500) {
      await RealtimeKeyword.bulkWrite(ops.slice(i, i + 500), { ordered: false });
    }

    const impressions = [...totals.values()].reduce((sum, r) => sum + r.impressions, 0);
    written.push({ ym: month.ym, keywords: totals.size, impressions, locationsWithData });

    // A scoped run read a handful of listings, so it must not mark the month done - the next
    // full run would skip it and the month would stay as four listings' worth of data.
    if (locationIds?.length) continue;

    await RealtimeKeywordMonth.updateOne(
      { _id: month.ym },
      {
        $set: {
          year: month.year,
          month: month.month,
          locationsCalled: profiles.length,
          locationsWithData,
          keywords: totals.size,
          impressions,
          // Finished only when Google returned something AND the month is old enough that it
          // is no longer being filled in. A month with nothing in it, or one read too soon
          // after it closed, stays eligible for the next daily run rather than being marked
          // done and skipped forever at whatever Google had published that day.
          complete: totals.size > 0 && Date.now() >= settledAt(month),
          syncedAt: new Date(),
        },
      },
      { upsert: true }
    );
  }

  return {
    months: written,
    keywords: written.reduce((s, m) => s + m.keywords, 0),
    // Months still waiting on a later run, so the caller can say how far behind it is.
    pending: Math.max(0, pending.length - todo.length),
  };
};

module.exports = {
  syncKeywords,
  recentMonths,
  settledAt,
  RealtimeKeyword,
  RealtimeKeywordMonth,
  KEYWORD_PAGES,
  SETTLE_DAYS,
};
