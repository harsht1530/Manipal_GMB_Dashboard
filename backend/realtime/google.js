const crypto = require('crypto');
const axios = require('axios');

/**
 * Google Business Profile access for the realtime dashboard.
 *
 * Same OAuth client as GMB_Multiplier (GOOGLE_OAUTH_CLIENT_ID / _SECRET) - the redirect URI
 * below must also be added to that client in the Google Cloud console.
 */

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/business.manage',
];

const OAUTH = {
  authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
  token: 'https://oauth2.googleapis.com/token',
  revoke: 'https://oauth2.googleapis.com/revoke',
  userinfo: 'https://openidconnect.googleapis.com/v1/userinfo',
};

const API = {
  accounts: 'https://mybusinessaccountmanagement.googleapis.com/v1',
  business: 'https://mybusinessbusinessinformation.googleapis.com/v1',
  verifications: 'https://mybusinessverifications.googleapis.com/v1',
  performance: 'https://businessprofileperformance.googleapis.com/v1',
};

const LOCATION_READ_MASK = [
  'name',
  'storeCode',
  'title',
  'phoneNumbers',
  'categories',
  'storefrontAddress',
  'websiteUri',
  'labels',
  'openInfo',
  'metadata',
].join(',');

const DAILY_METRICS = {
  BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: 'desktopSearch',
  BUSINESS_IMPRESSIONS_MOBILE_SEARCH: 'mobileSearch',
  BUSINESS_IMPRESSIONS_DESKTOP_MAPS: 'desktopMaps',
  BUSINESS_IMPRESSIONS_MOBILE_MAPS: 'mobileMaps',
  CALL_CLICKS: 'callClicks',
  WEBSITE_CLICKS: 'websiteClicks',
  BUSINESS_DIRECTION_REQUESTS: 'directionRequests',
};

const clientId = () => process.env.GOOGLE_OAUTH_CLIENT_ID || '';
const clientSecret = () => process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';
const redirectUri = () =>
  process.env.REALTIME_GOOGLE_REDIRECT_URI ||
  'http://localhost:5000/api/realtime/google/callback';
const isConfigured = () => !!clientId() && !!clientSecret();

/* ────────────────────────── token encryption ────────────────────────── */

// REALTIME_TOKEN_KEY (base64, 32 bytes) when set; otherwise derived from the OAuth client
// secret so tokens are never written to Mongo in the clear.
const encryptionKey = () => {
  const configured = process.env.REALTIME_TOKEN_KEY;
  if (configured) {
    const buf = Buffer.from(configured, 'base64');
    if (buf.length === 32) return buf;
  }
  return crypto.scryptSync(clientSecret() || 'manipal-realtime', 'manipal-realtime-v1', 32);
};

const encrypt = (plain) => {
  if (!plain) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join('.');
};

const decrypt = (payload) => {
  if (!payload) return null;
  try {
    const [iv, tag, data] = String(payload).split('.');
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  } catch (err) {
    console.error('[realtime] could not decrypt stored Google token:', err.message);
    return null;
  }
};

/* ────────────────────────────── OAuth ────────────────────────────── */

const authorizationUrl = (state) => {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent', // always returns a refresh token
    include_granted_scopes: 'true',
    state,
  });
  return `${OAUTH.authorize}?${params.toString()}`;
};

const exchangeCode = async (code) => {
  const { data } = await axios.post(
    OAUTH.token,
    new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20000 }
  );
  return data;
};

const refreshAccessToken = async (refreshToken) => {
  const { data } = await axios.post(
    OAUTH.token,
    new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId(),
      client_secret: clientSecret(),
      grant_type: 'refresh_token',
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20000 }
  );
  return data;
};

const revokeToken = async (token) => {
  try {
    await axios.post(OAUTH.revoke, new URLSearchParams({ token }).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000,
    });
    return true;
  } catch (err) {
    return false; // a failed revoke must never block a disconnect
  }
};

const fetchUserInfo = async (accessToken) => {
  const { data } = await axios.get(OAUTH.userinfo, {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 15000,
  });
  return data;
};

/* ─────────────────────────── API client ─────────────────────────── */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Google enforces a per-minute request quota per API per Cloud project, and a sync is far
 * more parallel than that allows. Every call takes a slot from this shared pacer, which hands
 * them out at a fixed interval, so concurrency controls latency and this controls the rate.
 */
const createPacer = (perMinute) => {
  const interval = 60000 / Math.max(1, perMinute);
  let next = 0;
  return async () => {
    const now = Date.now();
    const slot = Math.max(now, next);
    next = slot + interval;
    if (slot > now) await sleep(slot - now);
  };
};

const pacer = createPacer(Number(process.env.REALTIME_RATE_PER_MIN || 240));

/**
 * One access token per sync run. `getToken` refreshes it (and persists the new one) a minute
 * before it expires, and retries throttled / transient Google responses with backoff.
 */
class GoogleClient {
  constructor(settingsDoc) {
    this.settings = settingsDoc;
    this.accessToken = decrypt(settingsDoc.accessTokenEnc);
    this.refreshToken = decrypt(settingsDoc.refreshTokenEnc);
    this.expiresAt = settingsDoc.accessTokenExpiresAt ? new Date(settingsDoc.accessTokenExpiresAt).getTime() : 0;
  }

  async getToken() {
    if (this.accessToken && Date.now() < this.expiresAt - 60000) return this.accessToken;
    if (!this.refreshToken) throw new Error('Google account is not connected (no refresh token).');
    // Single-flight: a sync run has many calls in parallel, but only one may refresh.
    if (!this.refreshing) {
      this.refreshing = (async () => {
        const data = await refreshAccessToken(this.refreshToken);
        this.accessToken = data.access_token;
        this.expiresAt = Date.now() + Number(data.expires_in || 3600) * 1000;
        // updateOne, not save(), so parallel workers never touch the same document instance.
        await this.settings.constructor.updateOne(
          { _id: this.settings._id },
          { $set: { accessTokenEnc: encrypt(this.accessToken), accessTokenExpiresAt: new Date(this.expiresAt) } }
        );
        this.refreshing = null;
        return this.accessToken;
      })().catch((err) => {
        this.refreshing = null;
        throw err;
      });
    }
    return this.refreshing;
  }

  async request(url, params = {}, attempt = 0) {
    const token = await this.getToken();
    await pacer();
    try {
      const { data } = await axios.get(url, {
        params,
        headers: { Authorization: `Bearer ${token}` },
        timeout: 60000,
        paramsSerializer: (p) => {
          const sp = new URLSearchParams();
          Object.entries(p).forEach(([k, v]) => {
            if (v === undefined || v === null) return;
            if (Array.isArray(v)) v.forEach((item) => sp.append(k, item));
            else sp.append(k, v);
          });
          return sp.toString();
        },
      });
      return data;
    } catch (err) {
      const status = err.response?.status;
      const retriable = status === 429 || status === 500 || status === 503 || !status;
      // Quota rejections get more patience than transient errors: the window is a full minute.
      const maxAttempts = status === 429 ? 7 : 4;
      if (retriable && attempt < maxAttempts) {
        const retryAfter = Number(err.response?.headers?.['retry-after']) * 1000;
        const backoff = status === 429 ? Math.min(90000, 15000 * 2 ** attempt) : Math.min(30000, 2000 * 2 ** attempt);
        await sleep((Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : backoff) + Math.floor(Math.random() * 1000));
        return this.request(url, params, attempt + 1);
      }
      if (status === 401 && attempt < 1) {
        this.accessToken = null; // force a refresh, then retry once
        this.expiresAt = 0;
        return this.request(url, params, attempt + 1);
      }
      const detail = err.response?.data?.error?.message || err.message;
      const error = new Error(`Google API ${status || 'network'} on ${url}: ${detail}`);
      error.status = status;
      throw error;
    }
  }

  /** All Business Profile accounts the connected mailbox can see. */
  async listAccounts() {
    const out = [];
    let pageToken;
    do {
      const data = await this.request(`${API.accounts}/accounts`, { pageSize: 20, pageToken });
      out.push(...(data.accounts || []));
      pageToken = data.nextPageToken;
    } while (pageToken);
    return out;
  }

  /**
   * One page of locations for an account.
   *
   * Two different answers, and the difference matters:
   *   membership: true  - no filter. The folder's actual members, which is what Business
   *                       Profile Manager counts for a group.
   *   membership: false - `filter=title:*`. Everything reachable from the folder, including
   *                       listings owned by another folder. Used only as a fallback.
   */
  listLocationsPage(accountName, pageToken, { membership = true } = {}) {
    return this.request(`${API.business}/${accountName}/locations`, {
      readMask: LOCATION_READ_MASK,
      pageSize: 100,
      ...(membership ? {} : { filter: 'title:*' }),
      pageToken,
    });
  }

  /** Verification detail - only needed for locations Google does not report as verified. */
  voiceOfMerchantState(locationId) {
    return this.request(`${API.verifications}/${locationId}/VoiceOfMerchantState`);
  }

  /**
   * Google's own suggested edits for a listing. A non-empty diffMask is what GBP Manager
   * counts under its "Google updates" filter.
   */
  googleUpdated(locationId) {
    return this.request(`${API.business}/${locationId}:getGoogleUpdated`, { readMask: LOCATION_READ_MASK });
  }

  /** Daily performance metrics for one location, from..to inclusive (Date objects). */
  async dailyMetrics(locationId, from, to) {
    const data = await this.request(`${API.performance}/${locationId}:fetchMultiDailyMetricsTimeSeries`, {
      dailyMetrics: Object.keys(DAILY_METRICS),
      'dailyRange.startDate.year': from.getFullYear(),
      'dailyRange.startDate.month': from.getMonth() + 1,
      'dailyRange.startDate.day': from.getDate(),
      'dailyRange.endDate.year': to.getFullYear(),
      'dailyRange.endDate.month': to.getMonth() + 1,
      'dailyRange.endDate.day': to.getDate(),
    });
    return parseDailyMetrics(data);
  }
}

/** Google omits a value when it is zero, so every dated entry starts from zero. */
const parseDailyMetrics = (res) => {
  const byDate = new Map();
  for (const group of res.multiDailyMetricTimeSeries || []) {
    for (const series of group.dailyMetricTimeSeries || []) {
      const field = DAILY_METRICS[series.dailyMetric];
      if (!field) continue;
      for (const dv of series.timeSeries?.datedValues || []) {
        const d = dv.date;
        if (!d?.year || !d?.month || !d?.day) continue;
        const key = `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
        const row = byDate.get(key) || {};
        const value = Number(dv.value || 0);
        row[field] = Number.isFinite(value) ? value : 0;
        byDate.set(key, row);
      }
    }
  }
  return byDate;
};

module.exports = {
  SCOPES,
  API,
  DAILY_METRICS,
  GoogleClient,
  authorizationUrl,
  exchangeCode,
  refreshAccessToken,
  revokeToken,
  fetchUserInfo,
  encrypt,
  decrypt,
  isConfigured,
  redirectUri,
  parseDailyMetrics,
};
