const mongoose = require('mongoose');
const { RealtimeProfile } = require('./models');
const { runPool } = require('./pool');

/**
 * Google reviews, kept current in the review collections.
 *
 * Writes the two collections the dashboard already reads, keeping the document shape they
 * were first built with so anything else reading them is unaffected:
 *
 *   overallmanipalgmbreview                - one document per review, rolling window
 *   overallmanipalgmbreview_profile_stats  - one document per listing
 *
 * The sync is incremental by design. Google returns reviews newest-first by updateTime, and
 * `locations:batchGetReviews` merges up to ten listings into one stream in that order - so a
 * run reads pages only until it reaches a review that every listing in the batch has already
 * seen, then stops. Ordering by updateTime rather than createTime also means a reply added to
 * an old review is picked up, which is what the reply-rate figures need.
 *
 * What a run therefore costs is driven by how many reviews are new, not by how many exist:
 * about 325 batch calls over the whole estate, plus one small call per listing that actually
 * changed (to read the lifetime rating and count, which the batch response does not carry).
 */

/** Months of reviews kept: the current one plus the three before it. */
const REVIEW_MONTHS = 4;
/** Google's documented ceiling for locations:batchGetReviews. */
const BATCH_LOCATIONS = 10;
const PAGE_SIZE = 50;

const STAR_NUM = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

/**
 * Both collections predate this module and carry fields it does not write (`email`,
 * `copiedAt`), so the schemas stay open and every write is an explicit $set. The stats
 * collection is keyed by the Google location name, which has to be declared or Mongoose
 * casts it to an ObjectId.
 */
const Review = mongoose.model(
  'RealtimeReview',
  new mongoose.Schema({}, { collection: 'overallmanipalgmbreview', strict: false, versionKey: false })
);

const ReviewStat = mongoose.model(
  'RealtimeReviewStat',
  new mongoose.Schema(
    { _id: String },
    { collection: 'overallmanipalgmbreview_profile_stats', strict: false, versionKey: false }
  )
);

/* ──────────────────────────── helpers ──────────────────────────── */

/** First day of the oldest month the rolling window keeps. */
const windowStart = (now = new Date()) =>
  new Date(now.getFullYear(), now.getMonth() - (REVIEW_MONTHS - 1), 1);

/** "accounts/123/locations/456" -> "456"; the stored documents hold the bare ids. */
const bare = (name) => String(name || '').split('/').pop();

const accountOf = (locationName) => String(locationName || '').split('/locations/')[0];

const round2 = (n) => Math.round(n * 100) / 100;

const reviewFields = (review, locationName, profile) => ({
  reviewId: review.reviewId,
  name: review.name,
  location: locationName,
  locationId: bare(locationName),
  locationTitle: profile.title || '',
  accountId: bare(accountOf(locationName)),
  accountName: profile.accountName || '',
  cluster: profile.cluster || 'Unassigned',
  folders: profile.folders || [],
  mapsUri: profile.mapsUri || '',
  comment: review.comment || '',
  reviewer: review.reviewer || {},
  starRating: review.starRating || '',
  starRatingNum: STAR_NUM[review.starRating] || 0,
  createTime: review.createTime,
  createTimeDt: new Date(review.createTime),
  updateTime: review.updateTime || review.createTime,
  updateTimeDt: new Date(review.updateTime || review.createTime),
  lastSyncedAt: new Date(),
});

/**
 * Window statistics for one listing, recomputed from the reviews actually stored.
 *
 * The lifetime fields are a different thing and are not touched here: `repliedCount`,
 * `unrepliedCount` and `starBreakdown` count every review a listing has ever had, which the
 * window cannot see, so the `window*` fields carry the window's own figures alongside them.
 * `lifetimeReviewCount` and `lifetimeAverageRating` do get refreshed, because Google hands
 * them back with every reviews response.
 */
const refreshStats = async (profile, locationName, lifetime, from, watermark) => {
  const rows = await Review.find(
    { location: locationName },
    { starRatingNum: 1, createTimeDt: 1, reviewReply: 1, _id: 0 }
  ).lean();

  const rated = rows.filter((r) => r.starRatingNum > 0);
  const replied = rows.filter((r) => r.reviewReply).length;
  const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  rated.forEach((r) => { breakdown[r.starRatingNum] += 1; });
  const lastReviewAt = rows.reduce(
    (max, r) => (r.createTimeDt && (!max || r.createTimeDt > max) ? r.createTimeDt : max),
    null
  );

  const set = {
    location: locationName,
    locationId: bare(locationName),
    locationTitle: profile.title || '',
    accountId: bare(accountOf(locationName)),
    accountName: profile.accountName || '',
    cluster: profile.cluster || 'Unassigned',
    folders: profile.folders || [],
    mapsUri: profile.mapsUri || '',

    last3MonthsFrom: from,
    last3MonthsReviewCount: rows.length,
    last3MonthsAverageRating: rated.length ? round2(rated.reduce((s, r) => s + r.starRatingNum, 0) / rated.length) : 0,
    windowRepliedCount: replied,
    windowUnrepliedCount: rows.length - replied,
    windowStarBreakdown: breakdown,

    syncWatermark: watermark,
    reviewsSyncedAt: new Date(),
    updatedAt: new Date(),
  };
  if (lastReviewAt) set.lastReviewAt = lastReviewAt;
  if (lifetime) {
    const avg = Number(lifetime.averageRating);
    const total = Number(lifetime.totalReviewCount);
    if (Number.isFinite(avg)) {
      set.googleAverageRating = avg;
      set.lifetimeAverageRating = round2(avg);
    }
    if (Number.isFinite(total)) {
      set.googleTotalReviewCount = total;
      set.lifetimeReviewCount = total;
    }
  }

  await ReviewStat.updateOne(
    { _id: locationName },
    { $set: set, $setOnInsert: { firstReviewAt: lastReviewAt || null } },
    { upsert: true }
  );
};

/* ──────────────────────────── the sync ──────────────────────────── */

/**
 * @param mode         'full' re-reads the whole window for every listing; 'incremental'
 *                     reads only what changed since each listing's watermark.
 * @param locationIds  restricts the run to these listings - for resyncing one listing, or
 *                     for trying a change out before letting it near the whole estate.
 */
const syncReviews = async (client, { mode = 'incremental', concurrency = 8, onProgress, locationIds } = {}) => {
  const from = windowStart();
  const fromMs = from.getTime();

  const profiles = await RealtimeProfile.find(
    {
      duplicateOf: null,
      accountId: { $nin: [null, ''] },
      ...(locationIds?.length ? { locationId: { $in: locationIds } } : {}),
    },
    { locationId: 1, accountId: 1, accountName: 1, title: 1, cluster: 1, folders: 1, mapsUri: 1, _id: 0 }
  ).lean();

  const stored = await ReviewStat.find({}, { _id: 1, syncWatermark: 1 }).lean();
  const watermarks = new Map(
    stored.map((s) => [s._id, s.syncWatermark ? new Date(s.syncWatermark).getTime() : 0])
  );

  // Batches never span accounts: batchGetReviews is an account-level call.
  const byAccount = new Map();
  for (const profile of profiles) {
    if (!byAccount.has(profile.accountId)) byAccount.set(profile.accountId, []);
    byAccount.get(profile.accountId).push(profile);
  }
  const batches = [];
  for (const [accountId, list] of byAccount) {
    for (let i = 0; i < list.length; i += BATCH_LOCATIONS) {
      batches.push({ accountId, profiles: list.slice(i, i + BATCH_LOCATIONS) });
    }
  }

  let written = 0;
  const changed = new Map(); // location name -> profile

  await runPool(
    batches,
    async ({ accountId, profiles: group }) => {
      const nameOf = (p) => `${p.accountId}/${p.locationId}`;
      const byName = new Map(group.map((p) => [nameOf(p), p]));

      // Where to stop reading. Incrementally that is the oldest watermark in the batch, since
      // the stream is ordered across all ten listings: once a review is older than every
      // watermark, nothing newer is left. A listing the window has never covered pulls the
      // whole batch back to the window start, and nothing is ever read past it.
      const oldest = Math.min(...group.map((p) => watermarks.get(nameOf(p)) || 0));
      const stopAt = mode === 'full' ? fromMs : Math.max(oldest, fromMs);

      const seenMax = new Map();
      const ops = [];
      let pageToken;
      let exhausted = false;

      do {
        const data = await client.batchReviews(accountId, [...byName.keys()], {
          pageSize: PAGE_SIZE,
          pageToken,
        });
        const rows = data.locationReviews || [];
        if (!rows.length) break;

        for (const row of rows) {
          const review = row.review || {};
          const updated = Date.parse(review.updateTime || review.createTime || '');
          if (!Number.isFinite(updated) || updated <= stopAt) {
            exhausted = true;
            break;
          }
          const profile = byName.get(row.name);
          if (!profile) continue;

          // Tracked before the window test: a review posted before the window but replied to
          // last week still moves the watermark, and without this it would be re-read forever.
          const previous = seenMax.get(row.name) || 0;
          if (updated > previous) seenMax.set(row.name, updated);

          const created = Date.parse(review.createTime || '');
          if (!Number.isFinite(created) || created < fromMs) continue;

          const update = { $set: reviewFields(review, row.name, profile), $setOnInsert: { firstSeenAt: new Date() } };
          // A reply that was withdrawn has to come off the document, or the reply rate keeps
          // counting it.
          if (review.reviewReply) update.$set.reviewReply = review.reviewReply;
          else update.$unset = { reviewReply: '' };

          ops.push({ updateOne: { filter: { reviewId: review.reviewId }, update, upsert: true } });
          changed.set(row.name, profile);
        }

        pageToken = exhausted ? null : data.nextPageToken;
      } while (pageToken);

      if (ops.length) {
        await Review.bulkWrite(ops, { ordered: false });
        written += ops.length;
      }

      // A listing with nothing new keeps its watermark; one that was read moves to the newest
      // updateTime this run actually saw.
      for (const [name, max] of seenMax) {
        const profile = byName.get(name);
        if (profile) changed.set(name, profile);
        watermarks.set(name, Math.max(watermarks.get(name) || 0, max));
      }
    },
    concurrency,
    onProgress
  );

  const byLocation = new Map(profiles.map((p) => [`${p.accountId}/${p.locationId}`, p]));

  // Reviews that have aged out of the window. Their listings need their statistics redone,
  // or the window counts keep including reviews that are no longer stored. A run scoped to
  // some listings prunes only those, so a trial run cannot touch anything it did not read.
  const aged = {
    createTimeDt: { $lt: from },
    ...(locationIds?.length ? { location: { $in: [...byLocation.keys()] } } : {}),
  };
  const stale = await Review.distinct('location', aged);
  if (stale.length) await Review.deleteMany(aged);

  const toRefresh = mode === 'full' ? [...byLocation.keys()] : [...new Set([...changed.keys(), ...stale])];

  await runPool(
    toRefresh,
    async (locationName) => {
      const profile = byLocation.get(locationName);
      if (!profile) return;
      // The lifetime rating and count ride along with any reviews response, so one page of
      // one review is the cheapest way to read them - and only listings that changed need it.
      let lifetime = null;
      try {
        lifetime = await client.locationReviews(profile.accountId, profile.locationId, { pageSize: 1 });
      } catch (err) {
        // 403/404 means the listing has no reviews surface; its stored totals stay as they are.
        if (err.status !== 403 && err.status !== 404) throw err;
      }
      const watermark = watermarks.get(locationName);
      await refreshStats(profile, locationName, lifetime, from, watermark ? new Date(watermark) : null);
    },
    concurrency
  );

  return {
    written,
    locations: toRefresh.length,
    pruned: stale.length,
    from,
  };
};

module.exports = { syncReviews, windowStart, Review, ReviewStat, REVIEW_MONTHS };
