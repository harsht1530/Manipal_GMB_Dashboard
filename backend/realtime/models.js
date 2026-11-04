const mongoose = require('mongoose');

/**
 * Realtime (Google API) storage.
 *
 * Two data collections only:
 *   realtimeProfiles  - one document per Google Business Profile location (status view)
 *   realtimeMetrics   - one document per location per month (performance view)
 * Plus realtimeSettings, a single-document collection holding the one allowed Google
 * connection and the state of the last sync run.
 *
 * Nothing here touches the manually maintained collections used by the existing dashboard.
 */

const METRIC_KEYS = [
  'desktopSearch',
  'mobileSearch',
  'desktopMaps',
  'mobileMaps',
  'callClicks',
  'websiteClicks',
  'directionRequests',
];

const zeroTotals = () => METRIC_KEYS.reduce((acc, k) => ({ ...acc, [k]: 0 }), {});

/**
 * The nine completeness checks behind the optimization report. Phone and website are not
 * repeated here - the report reads those from the profile's own fields.
 *
 * Everything is stored as what Google returned, not as a pass/fail: the thresholds belong to
 * the report, so they can be changed without a resync. Mongoose would silently drop any of
 * these that the schema did not declare, which is why they are spelled out.
 */
const OptimizationSchema = new mongoose.Schema(
  {
    // From the listing itself - no extra API call.
    description: { type: String, default: '' },
    // Stored alongside the text so the report can project the length without pulling every
    // description: 3k descriptions are most of this collection's bulk, and all the report
    // shows is how long each one is.
    descriptionLength: { type: Number, default: 0 },
    hourPeriods: { type: Number, default: 0 },
    serviceCount: { type: Number, default: 0 },
    reviewLink: { type: String, default: '' },

    // From locations/*/attributes - one call per listing.
    whatsapp: { type: String, default: '' },
    appointment: { type: String, default: '' },

    // From the v4 media list - one call per listing.
    coverPhoto: { type: Boolean, default: false },
    // True when the listing has the image the Business Profile UI calls the logo. Google stores
    // that image under the PROFILE category; LOGO is a legacy category almost no listing uses,
    // so both count (see readMediaOptimization in sync.js).
    logo: { type: Boolean, default: false },
    // Which of the two categories actually supplied it, kept so the report can say so.
    profilePhoto: { type: Boolean, default: false },
    legacyLogo: { type: Boolean, default: false },
    photoCount: { type: Number, default: 0 },

    // When the two per-listing calls last succeeded, and why they did not.
    checkedAt: Date,
    error: { type: String, default: '' },
  },
  { _id: false }
);

const RealtimeProfileSchema = new mongoose.Schema(
  {
    // "locations/12345678901234567890"
    locationId: { type: String, required: true, unique: true },
    accountId: String,
    accountName: String,

    title: String,
    storeCode: String,
    phone: String,
    website: String,
    address: String,
    primaryCategory: String,
    labels: [String],
    mapsUri: String,

    // Mapped onto the dashboard's own hierarchy so both views group the same way.
    cluster: { type: String, default: 'Unassigned' },
    unitName: { type: String, default: 'Unassigned' },
    department: { type: String, default: 'GMB' },

    // Every Google folder this listing appears in. A listing can sit in a unit folder and in
    // the cluster folder above it, and GBP Manager counts it in both - so folder counts are
    // aggregated over this array, while unitName stays the single most specific folder.
    folders: { type: [String], default: [] },

    // openInfo.status: OPEN | CLOSED_PERMANENTLY | CLOSED_TEMPORARILY
    openStatus: { type: String, default: 'OPEN' },
    hasVoiceOfMerchant: { type: Boolean, default: false },
    duplicateOf: { type: String, default: null },

    // verified | pending | unverified | ownership_conflict
    verificationState: { type: String, default: 'unverified' },
    // published | pending | suspended | disabled | duplicate
    publishStatus: { type: String, default: 'pending' },
    // Single label the UI buckets on (see sync.js -> deriveStatus)
    statusType: { type: String, default: 'Unverified' },

    missingStoreCode: { type: Boolean, default: false },

    // Google has suggested edits for this listing (the "Google updates" filter in GBP Manager).
    hasGoogleUpdates: { type: Boolean, default: false },
    googleUpdateFields: [String],
    // Open status as Google itself reports it. GBP Manager's "Temporarily/Permanently closed"
    // filters follow this, not the owner-set openInfo, which can still say OPEN.
    googleOpenStatus: { type: String, default: null },

    // Completeness of the listing's content, for the optimization report.
    optimization: { type: OptimizationSchema, default: () => ({}) },

    lastSyncedAt: Date,
  },
  { collection: 'realtimeProfiles', timestamps: true }
);

RealtimeProfileSchema.index({ unitName: 1 });
RealtimeProfileSchema.index({ cluster: 1 });
RealtimeProfileSchema.index({ statusType: 1 });
RealtimeProfileSchema.index({ unitName: 1, statusType: 1 });
RealtimeProfileSchema.index({ unitName: 1, openStatus: 1 });
RealtimeProfileSchema.index({ folders: 1 });
// The optimization phase picks up whatever was checked least recently.
RealtimeProfileSchema.index({ 'optimization.checkedAt': 1 });

const DaySchema = new mongoose.Schema(
  {
    day: Number,
    desktopSearch: { type: Number, default: 0 },
    mobileSearch: { type: Number, default: 0 },
    desktopMaps: { type: Number, default: 0 },
    mobileMaps: { type: Number, default: 0 },
    callClicks: { type: Number, default: 0 },
    websiteClicks: { type: Number, default: 0 },
    directionRequests: { type: Number, default: 0 },
  },
  { _id: false }
);

const RealtimeMetricSchema = new mongoose.Schema(
  {
    locationId: { type: String, required: true },
    // "2026-10"
    ym: { type: String, required: true },
    year: Number,
    month: Number,

    // Denormalised so unit/cluster roll-ups never need a join.
    title: String,
    unitName: { type: String, default: 'Unassigned' },
    cluster: { type: String, default: 'Unassigned' },

    totals: {
      desktopSearch: { type: Number, default: 0 },
      mobileSearch: { type: Number, default: 0 },
      desktopMaps: { type: Number, default: 0 },
      mobileMaps: { type: Number, default: 0 },
      callClicks: { type: Number, default: 0 },
      websiteClicks: { type: Number, default: 0 },
      directionRequests: { type: Number, default: 0 },
    },
    days: [DaySchema],

    lastSyncedAt: Date,
  },
  { collection: 'realtimeMetrics', timestamps: true }
);

RealtimeMetricSchema.index({ locationId: 1, ym: 1 }, { unique: true });
RealtimeMetricSchema.index({ ym: 1 });
RealtimeMetricSchema.index({ unitName: 1, ym: 1 });
RealtimeMetricSchema.index({ cluster: 1, ym: 1 });

/**
 * Exactly one document (_id: "primary"). Only one Google mailbox may be connected at a
 * time - connecting another replaces this document.
 */
const RealtimeSettingSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'primary' },

    connected: { type: Boolean, default: false },
    email: String,
    name: String,
    picture: String,
    googleSub: String,
    scopes: [String],
    connectedAt: Date,
    connectedBy: String,

    // AES-256-GCM payloads, never the raw tokens.
    accessTokenEnc: String,
    refreshTokenEnc: String,
    accessTokenExpiresAt: Date,

    // `type` must be wrapped: a bare `type: String` here would make Mongoose read the whole
    // element as a type declaration and cast each account object to a string.
    accounts: [new mongoose.Schema({ name: String, accountName: String, type: { type: String } }, { _id: false })],

    sync: {
      status: { type: String, default: 'idle' }, // idle | running | partial | error
      mode: String, // full | incremental
      // Folders Google could not list on the last run; their listings kept the previous data.
      failedAccounts: { type: [String], default: [] },
      phase: String, // profiles | performance | done
      startedAt: Date,
      finishedAt: Date,
      processed: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
      profilesSynced: { type: Number, default: 0 },
      metricsSynced: { type: Number, default: 0 },
      error: String,
      lastSuccessAt: Date,
      lastFullSyncAt: Date,
      trigger: String, // schedule | manual | connect
    },
  },
  { collection: 'realtimeSettings', timestamps: true, _id: false }
);

const RealtimeProfile = mongoose.model('RealtimeProfile', RealtimeProfileSchema);
const RealtimeMetric = mongoose.model('RealtimeMetric', RealtimeMetricSchema);
const RealtimeSetting = mongoose.model('RealtimeSetting', RealtimeSettingSchema);

const getSettings = async () => {
  let doc = await RealtimeSetting.findById('primary');
  if (!doc) doc = await RealtimeSetting.create({ _id: 'primary' });
  return doc;
};

module.exports = {
  RealtimeProfile,
  RealtimeMetric,
  RealtimeSetting,
  getSettings,
  METRIC_KEYS,
  zeroTotals,
};
