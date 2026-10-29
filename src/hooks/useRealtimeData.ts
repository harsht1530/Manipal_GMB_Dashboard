import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Live Google Business Profile data, served from the realtime Mongo collections the backend
 * syncs twice a day. Separate from useMongoData, which reads the manually maintained monthly
 * collections - nothing here touches those.
 */

export const REALTIME_API = `${import.meta.env.VITE_API_BASE_URL || "https://smldatamanagement.multiplierai.co"}/api/realtime`;

export interface MetricTotals {
  desktopSearch: number;
  mobileSearch: number;
  desktopMaps: number;
  mobileMaps: number;
  callClicks: number;
  websiteClicks: number;
  directionRequests: number;
  totalSearches: number;
  totalMaps: number;
  totalImpressions: number;
  totalInteractions: number;
}

export interface MonthPoint extends MetricTotals {
  /** Either a month ("2026-10") or a day ("2026-10-26"), depending on the range length. */
  key: string;
  label: string;
}

export interface UnitRow extends MetricTotals {
  unitName: string;
  cluster: string;
  profiles: number;
}

export interface TopProfile extends MetricTotals {
  locationId: string;
  title: string;
  unitName: string;
}

export interface OverviewData {
  range: { from: string; to: string; granularity: "day" | "month" };
  totals: MetricTotals;
  current: MetricTotals & { label: string | null };
  previous: MetricTotals & { label: string | null };
  series: MonthPoint[];
  units: UnitRow[];
  topProfiles: TopProfile[];
}

export interface VerificationUnit {
  unitName: string;
  cluster: string;
  total: number;
  verified: number;
  unverified: number;
  duplicates: number;
  suspended: number;
  permanentlyClosed: number;
  temporarilyClosed: number;
  pendingReview: number;
  googleUpdates: number;
  missingStoreCodes: number;
  verificationRate: number;
}

export interface VerificationData {
  totals: Omit<VerificationUnit, "unitName" | "cluster"> & { needAction: number };
  units: VerificationUnit[];
}

export interface RealtimeMeta {
  clusters: string[];
  units: string[];
  months: { ym: string; label: string }[];
  lastSyncAt: string | null;
  connected: boolean;
  email: string | null;
}

export interface SyncState {
  /** "partial": the run finished, but Google was unavailable for one or more folders. */
  status: "idle" | "running" | "partial" | "error";
  mode: string | null;
  phase: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  processed: number;
  total: number;
  profilesSynced: number;
  lastSuccessAt: string | null;
  lastFullSyncAt: string | null;
  error: string | null;
  /** Folders Google could not list on the last run; they kept their previous data. */
  failedAccounts?: string[];
}

export interface GoogleConnection {
  connected: boolean;
  email: string | null;
  name: string | null;
  picture: string | null;
  connectedAt: string | null;
  connectedBy: string | null;
  accounts: { name: string; accountName: string }[];
  configured: boolean;
  redirectUri: string;
  sync: SyncState;
  counts: { profiles: number; metrics: number };
}

export interface ProfileRow {
  locationId: string;
  title: string;
  storeCode: string;
  unitName: string;
  cluster: string;
  phone: string;
  website: string;
  address: string;
  statusType: string;
  openStatus: string;
  hasVoiceOfMerchant: boolean;
  duplicateOf: string | null;
  missingStoreCode: boolean;
  mapsUri: string;
}

/** One month of a profile's performance, as the export returns it. */
export interface ExportMonth extends MetricTotals {
  ym: string;
  label: string;
}

/** Which verification tiles a listing falls into; the same rules the tiles count by. */
export interface TileFlags {
  verified: boolean;
  unverified: boolean;
  duplicate: boolean;
  suspended: boolean;
  pendingReview: boolean;
  googleUpdates: boolean;
  temporarilyClosed: boolean;
  permanentlyClosed: boolean;
  missingStoreCode: boolean;
}

/** A profile with every stored field plus its performance for the exported window. */
export interface ExportRow extends ProfileRow {
  /** Verified | Duplicate | Suspended | Disabled | Pending Review | Ownership Conflict | Need to verify */
  verificationStatus: string;
  tiles: TileFlags;
  accountName?: string;
  department?: string;
  primaryCategory?: string;
  labels?: string[];
  folders?: string[];
  verificationState?: string;
  publishStatus?: string;
  hasGoogleUpdates?: boolean;
  googleUpdateFields?: string[];
  googleOpenStatus?: string | null;
  lastSyncedAt?: string;
  performance: MetricTotals;
  monthsCovered: number;
  months: ExportMonth[];
}

export interface ExportPayload {
  /** True when no date range was given and the whole stored history was summed. */
  overall: boolean;
  range: { from: string; to: string } | null;
  monthsCovered: { first: string; last: string } | null;
  generatedAt: string;
  rows: ExportRow[];
}

const get = async <T>(path: string): Promise<T> => {
  const res = await fetch(`${REALTIME_API}${path}`);
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.error || `Request failed (${res.status})`);
  return body.data as T;
};

export interface RealtimeFilters {
  clusters?: string[];
  units?: string[];
  months?: number;
  /** YYYY-MM-DD; both must be set for the range to apply. */
  from?: string;
  to?: string;
}

const toQuery = (filters: RealtimeFilters = {}) => {
  const params = new URLSearchParams();
  if (filters.clusters?.length) params.set("cluster", filters.clusters.join(","));
  if (filters.units?.length) params.set("unit", filters.units.join(","));
  if (filters.months) params.set("months", String(filters.months));
  if (filters.from && filters.to) {
    params.set("from", filters.from);
    params.set("to", filters.to);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
};

// Short enough that a finished sync shows up on the next look, long enough that moving
// between pages stays instant. The backend caches these roll-ups for 30s as well.
const SLOW = { staleTime: 30 * 1000, gcTime: 30 * 60 * 1000, refetchOnWindowFocus: true };

export const useRealtimeMeta = () =>
  useQuery({ queryKey: ["realtime", "meta"], queryFn: () => get<RealtimeMeta>("/meta"), ...SLOW });

export const useRealtimeOverview = (filters: RealtimeFilters) =>
  useQuery({
    queryKey: ["realtime", "overview", filters],
    queryFn: () => get<OverviewData>(`/overview${toQuery(filters)}`),
    ...SLOW,
  });

export const useRealtimeVerification = (filters: RealtimeFilters) =>
  useQuery({
    queryKey: ["realtime", "verification", filters],
    queryFn: () => get<VerificationData>(`/verification${toQuery(filters)}`),
    ...SLOW,
  });

export const useGoogleConnection = (pollWhileSyncing = false) =>
  useQuery({
    queryKey: ["realtime", "google-status"],
    queryFn: () => get<GoogleConnection>("/google/status"),
    staleTime: 30 * 1000,
    refetchInterval: (query) =>
      pollWhileSyncing && query.state.data?.sync?.status === "running" ? 5000 : false,
  });

export const useRunSync = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (mode: "full" | "incremental" | "profiles") => {
      const res = await fetch(`${REALTIME_API}/sync/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.error || "Could not start the sync.");
      return body.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["realtime"] });
    },
  });
};

export const useDisconnectGoogle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${REALTIME_API}/google/disconnect`, { method: "POST" });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.error || "Could not disconnect.");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["realtime"] });
    },
  });
};

/** Sends the browser to Google's consent screen; the backend returns it to /#/settings. */
export const startGoogleConnect = (userEmail?: string) => {
  // Includes the Vite base path ("/GMB/" in production) so the callback returns to this app.
  const params = new URLSearchParams({
    origin: `${window.location.origin}${import.meta.env.BASE_URL || "/"}`,
  });
  if (userEmail) params.set("user", userEmail);
  window.location.href = `${REALTIME_API}/google/connect?${params.toString()}`;
};

export const fetchRealtimeProfiles = (
  filters: RealtimeFilters & { status?: string; limit?: number } = {}
) => {
  const params = new URLSearchParams();
  if (filters.clusters?.length) params.set("cluster", filters.clusters.join(","));
  if (filters.units?.length) params.set("unit", filters.units.join(","));
  if (filters.status) params.set("status", filters.status);
  params.set("limit", String(filters.limit || 5000));
  return get<{ items: ProfileRow[]; total: number }>(`/profiles?${params.toString()}`);
};

/**
 * Every stored detail for the matching profiles, performance included. Pass `from`/`to` to
 * limit the performance to that range; leave them out for the whole stored history.
 */
export const fetchRealtimeExport = (
  filters: RealtimeFilters & { status?: string } = {}
) => {
  const params = new URLSearchParams();
  if (filters.clusters?.length) params.set("cluster", filters.clusters.join(","));
  if (filters.units?.length) params.set("unit", filters.units.join(","));
  if (filters.status) params.set("status", filters.status);
  if (filters.from && filters.to) {
    params.set("from", filters.from);
    params.set("to", filters.to);
  }
  const qs = params.toString();
  return get<ExportPayload>(`/export${qs ? `?${qs}` : ""}`);
};
