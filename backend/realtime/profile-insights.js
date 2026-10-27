const { RealtimeMetric } = require('./models');

/**
 * Overlays the last months of a profile's monthly insights with the live Google figures.
 *
 * Only those months are touched - everything older stays exactly as it was loaded from
 * manipalinsightsdatas, and the shape of each row is unchanged, so callers and the frontend
 * see the same fields they always did (plus `realtime: true` on the rows that came from the
 * API, which existing code simply ignores).
 *
 * Profiles are matched on the Google location id: manipalfinaldatas stores
 * "accounts/<accountId>/locations/<locationId>", and the realtime collections are keyed on
 * the "locations/<locationId>" part alone.
 */

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const REALTIME_MONTHS = 6;

/** "accounts/123/locations/456" -> "locations/456" */
const locationIdFrom = (account) => {
  const match = /(locations\/[^/\s]+)\s*$/.exec(String(account || '').trim());
  return match ? match[1] : null;
};

/** The last `count` months, most recent last, as "YYYY-MM". */
const recentYms = (count = REALTIME_MONTHS) => {
  const out = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
};

const plain = (doc) => (doc && typeof doc.toObject === 'function' ? doc.toObject() : { ...doc });

/** One monthly insight row built from a realtime metric document. */
const rowFrom = (metric, existing, profile) => {
  const totals = metric.totals || {};
  const base = existing || {
    'Business name': profile?.business_name || '',
    Cluster: profile?.Cluster || '',
    Branch: profile?.Branch || '',
    Department: '',
    Speciality: '',
    Phone: profile?.phone || '',
    Review: profile?.totalReviewCount ?? 0,
    Rating: profile?.averageRating ?? 0,
  };

  return {
    ...base,
    Month: MONTH_NAMES[metric.month - 1],
    Year: metric.year,
    Date: base.Date || `01-${String(metric.month).padStart(2, '0')}-${metric.year}`,
    'Google Search - Mobile': totals.mobileSearch || 0,
    'Google Search - Desktop': totals.desktopSearch || 0,
    'Google Maps - Mobile': totals.mobileMaps || 0,
    'Google Maps - Desktop': totals.desktopMaps || 0,
    Directions: totals.directionRequests || 0,
    'Website clicks': totals.websiteClicks || 0,
    Calls: totals.callClicks || 0,
    realtime: true,
  };
};

/**
 * @param profile         a manipalfinaldatas document (needs `account`)
 * @param monthlyInsights the rows already loaded from manipalinsightsdatas
 */
const overlayRealtimeMonths = async (profile, monthlyInsights, { months = REALTIME_MONTHS } = {}) => {
  const rows = (monthlyInsights || []).map(plain);
  const locationId = locationIdFrom(profile?.account);
  if (!locationId) return rows;

  let metrics;
  try {
    metrics = await RealtimeMetric.find({ locationId, ym: { $in: recentYms(months) } }).lean();
  } catch (err) {
    console.error('[realtime] could not overlay profile insights:', err.message);
    return rows;
  }
  if (!metrics.length) return rows;

  const metricByYm = new Map(metrics.map((metric) => [metric.ym, metric]));

  /** "Sep" + 2026 -> "2026-09", so a row can be lined up with a realtime month. */
  const ymOf = (row) => {
    const index = MONTH_NAMES.indexOf(row.Month);
    if (index < 0 || !row.Year) return null;
    return `${Number(row.Year)}-${String(index + 1).padStart(2, '0')}`;
  };

  // A row is only dropped when realtime data exists for that exact month. Everything else is
  // passed through untouched - including months that legitimately have several rows, which
  // would otherwise be silently merged into one.
  const untouched = [];
  const templateByYm = new Map();

  for (const row of rows) {
    const ym = ymOf(row);
    if (ym && metricByYm.has(ym)) {
      if (!templateByYm.has(ym)) templateByYm.set(ym, row);
      continue;
    }
    untouched.push(row);
  }

  const replaced = [...metricByYm.values()].map((metric) => rowFrom(metric, templateByYm.get(metric.ym), profile));

  // Same ordering the endpoint used before: by month, left as it was.
  return [...untouched, ...replaced].sort((a, b) => MONTH_NAMES.indexOf(a.Month) - MONTH_NAMES.indexOf(b.Month));
};

module.exports = { overlayRealtimeMonths, locationIdFrom, recentYms, REALTIME_MONTHS };
