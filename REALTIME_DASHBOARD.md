# Realtime Dashboard (live Google Business Profile data)

A second dashboard that sits **before** the existing one in the sidebar (`/#/realtime`). It shows
the same analytics as the monthly dashboard, but read straight from the Google Business Profile
API instead of the manually uploaded sheets.

**Nothing in this feature touches the existing collections.** `manipalinsightsdatas`,
`manipalLocations`, `manipalApiInsights` and the Dashboard page at `/` are unchanged — the data
you have loaded up to September stays exactly as it is.

## What it shows

* The eight headline metrics (Search mobile/desktop, Maps mobile/desktop, Calls, Directions,
  Website clicks, Total searches) over the last 6 months, with month-on-month change.
* Impression and customer-action trend charts.
* **Profile Verification Status**, live: Total / Verified / Duplicates / Unverified / Suspended /
  Permanently Closed / Missing Store Codes, with a per-unit table. Each tile exports the
  underlying profile list to Excel.
* Performance by unit, and the top 10 profiles by impressions.
* Cluster and Unit filters.

## Sync

| | |
|---|---|
| Schedule | 07:00 and 19:00 every day (`REALTIME_SYNC_TZ`, default Asia/Kolkata) |
| Scheduled run | Profiles + verification status in full, performance for the trailing 10 days |
| First connect / "Full 6-month resync" | Profiles + the complete 6-month performance window |
| Manual | "Sync now" on the Realtime page or in Settings |

A run makes one `accounts.locations.list` page call per 100 profiles, one
`VoiceOfMerchantState` call per *unverified* profile (to tell suspended from pending), and one
`fetchMultiDailyMetricsTimeSeries` call per profile. Calls run 8 at a time
(`REALTIME_SYNC_CONCURRENCY`) and retry with backoff on 429/5xx.

## Collections

| Collection | Shape | Rough size |
|---|---|---|
| `realtimeProfiles` | one document per Google location — title, store code, unit/cluster, open status, verification status | ~3,300 docs |
| `realtimeMetrics` | one document per location per month — monthly totals plus a day array | ~20,000 docs |
| `realtimeSettings` | single document: the one Google connection + last sync state | 1 doc |

Page reads are served by indexed aggregations over those two collections and cached in the
backend for 60 seconds, so the page renders without ever calling Google.

## Connecting the Google account (Settings → Google Account Connection)

Admins only. One mailbox at a time — connecting another replaces the current one; disconnect
revokes the token with Google. It uses the **same OAuth client as GMB_Multiplier**
(`671454541441-...apps.googleusercontent.com`).

### Before the first connect, add the redirect URI in Google Cloud Console

APIs & Services → Credentials → that OAuth client → Authorised redirect URIs:

```
http://localhost:5000/api/realtime/google/callback
https://smldatamanagement.multiplierai.co/api/realtime/google/callback
```

(the second one must match whatever `REALTIME_GOOGLE_REDIRECT_URI` is set to in production).

The connected account must have access to the Business Profile accounts that own the listings,
and the Cloud project needs these APIs enabled: Business Profile Account Management, Business
Information, Verifications, and Business Profile Performance.

## Backend environment (`backend/.env`)

```
GOOGLE_OAUTH_CLIENT_ID=...          # same client as GMB_Multiplier
GOOGLE_OAUTH_CLIENT_SECRET=...
REALTIME_GOOGLE_REDIRECT_URI=...    # must be registered on that client
REALTIME_FRONTEND_URL=...           # where the browser returns after consent
REALTIME_SYNC_TZ=Asia/Kolkata
REALTIME_SYNC_CONCURRENCY=8
REALTIME_TOKEN_KEY=                 # optional: base64 32 bytes; otherwise derived from the client secret
```

Refresh tokens are stored AES-256-GCM encrypted, never in plain text.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/realtime/meta` | filter options, last sync time |
| GET | `/api/realtime/overview` | metric totals, monthly series, per-unit and top-profile tables |
| GET | `/api/realtime/verification` | Profile Verification Status totals and per-unit rows |
| GET | `/api/realtime/profiles` | profile list / Excel export source |
| GET | `/api/realtime/google/status` | connection + sync state |
| GET | `/api/realtime/google/connect` | starts consent (redirects to Google) |
| GET | `/api/realtime/google/callback` | OAuth callback |
| POST | `/api/realtime/google/disconnect` | revoke and clear |
| POST | `/api/realtime/sync/run` | `{ "mode": "incremental" \| "full" }` |
| GET | `/api/realtime/sync/status` | progress of the running sync |

All filters accept comma-separated values: `?cluster=South,West&unit=MH%20-%20Hebbal&months=6`.

## Files

```
backend/realtime/models.js    collections and indexes
backend/realtime/google.js    OAuth, token encryption, Google API client
backend/realtime/sync.js      profile + performance sync
backend/realtime/routes.js    endpoints, aggregations, 60s cache
backend/server.js             mounts /api/realtime, schedules 07:00 / 19:00

src/pages/RealtimeDashboard.tsx
src/components/dashboard/RealtimeVerificationStatus.tsx
src/components/settings/GoogleConnectionCard.tsx
src/hooks/useRealtimeData.ts
```
