import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { REALTIME_API, realtimeHeaders, signedInKey } from "@/hooks/useRealtimeData";
import type { DoctorData, InsightData } from "@/hooks/useMongoData";

/**
 * The realtime Google data, in the shapes the Profiles, Units, Phone and Postings pages were
 * built on (DoctorData / InsightData), so those pages read Google's own figures without their
 * layout changing. Only the Dashboard still reads the monthly uploads (useMongoData).
 *
 * Listings are keyed by Google location id, not by name: several listings share a title.
 */

export interface FeedProfile {
  locationId: string;
  account: string;
  email: string;
  title: string;
  phone: string;
  website: string;
  address: string;
  primaryCategory: string;
  mapsUri: string;
  placeId: string;
  unitName: string;
  cluster: string;
  folders: string[];
  department: string;
  statusType: string;
  reviewCount: number | null;
  averageRating: number | null;
}

interface FeedPayload {
  months: { ym: string; year: number; month: number; label: string }[];
  profiles: FeedProfile[];
  /** [profile, month, desktopSearch, mobileSearch, desktopMaps, mobileMaps, calls, website, directions] */
  metrics: number[][];
  lastSyncAt: string | null;
}

/** DoctorData plus what the realtime pages filter on. */
export interface FeedDoctor extends DoctorData {
  locationId: string;
  unitName: string;
  folders: string[];
  department: string;
  statusType: string;
  /** In one of the "OOO" folders (MH - OOO East, MH - OOO Clinic, ...): Out of Organization. */
  outOfOrganization: boolean;
}

/** Any folder named with "OOO" - including ones added in Google later - marks the listing. */
export const isOutOfOrganization = (folders: string[] = [], unitName = "") =>
  [...folders, unitName].some((f) => /\bOOO\b/i.test(f || ""));

export interface FeedInsight extends InsightData {
  locationId: string;
  ym: string;
}

export interface ReviewSummaryData {
  ratings: number[];
  goodReviews: { comment: string; author: string; date: string }[];
  badReviews: { comment: string; author: string; date: string }[];
  averageRating?: number;
  totalReviewCount?: number;
  duration?: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");

const toDoctor = (p: FeedProfile): FeedDoctor => ({
  id: p.locationId,
  locationId: p.locationId,
  businessName: p.title,
  name: p.title,
  phone: p.phone || "Not available",
  placeId: p.placeId,
  newReviewUri: p.placeId ? `https://search.google.com/local/writereview?placeid=${p.placeId}` : "",
  mapsUri: p.mapsUri,
  websiteUrl: p.website,
  // Keyword rankings are not part of the Google data; left empty until they are.
  labels: [],
  primaryCategory: p.primaryCategory,
  address: p.address,
  averageRating: p.averageRating ?? 0,
  totalReviewCount: p.reviewCount ?? 0,
  mailId: p.email,
  cluster: p.cluster,
  branch: p.unitName,
  profileScreenshot: "",
  account: p.account,
  unitName: p.unitName,
  folders: p.folders,
  outOfOrganization: isOutOfOrganization(p.folders, p.unitName),
  department: p.department,
  statusType: p.statusType,
});

/** One row per listing per month; a month Google returned nothing for reads as zero. */
const toInsights = (payload: FeedPayload): FeedInsight[] => {
  const values = new Map<string, number[]>();
  for (const row of payload.metrics) values.set(`${row[0]}:${row[1]}`, row);

  const out: FeedInsight[] = [];
  payload.profiles.forEach((p, pi) => {
    payload.months.forEach((m, mi) => {
      const v = values.get(`${pi}:${mi}`);
      out.push({
        id: `${p.locationId}|${m.ym}`,
        locationId: p.locationId,
        ym: m.ym,
        businessName: p.title,
        googleSearchDesktop: v?.[2] ?? 0,
        googleSearchMobile: v?.[3] ?? 0,
        googleMapsDesktop: v?.[4] ?? 0,
        googleMapsMobile: v?.[5] ?? 0,
        calls: v?.[6] ?? 0,
        websiteClicks: v?.[7] ?? 0,
        directions: v?.[8] ?? 0,
        cluster: p.cluster,
        branch: p.unitName,
        month: MONTHS[m.month - 1],
        year: String(m.year),
        date: `01-${pad(m.month)}-${m.year}`,
        timestamp: new Date(m.year, m.month - 1, 1).getTime(),
        speciality: p.primaryCategory,
        review: p.reviewCount ?? 0,
        rating: p.averageRating ?? 0,
        department: p.department,
        phone: p.phone || "Not available",
        statusType: p.statusType,
      });
    });
  });
  return out;
};

type FeedCache = { email: string; doctors: FeedDoctor[]; insights: FeedInsight[]; lastSyncAt: string | null; at: number };
let cache: FeedCache | null = null;
let inflight: { email: string; promise: Promise<FeedCache> } | null = null;
/** Google data changes twice a day; a page revisit within this window reuses what it has. */
const CACHE_MS = 5 * 60 * 1000;

/**
 * The backend answers with only the listings the signed-in user may see (Admin: all; cluster
 * or branch login: their folders plus Others), so the cache belongs to one user.
 */
const load = async (force: boolean): Promise<FeedCache> => {
  const email = signedInKey();
  if (!force && cache && cache.email === email && Date.now() - cache.at < CACHE_MS) return cache;
  if (!inflight || inflight.email !== email) {
    const promise = fetch(`${REALTIME_API}/feed`, { headers: realtimeHeaders() })
      .then((res) => res.json())
      .then((json) => {
        if (!json?.success) throw new Error(json?.error || "Could not load the Google data");
        const payload = json.data as FeedPayload;
        cache = {
          email,
          doctors: payload.profiles.map(toDoctor),
          insights: toInsights(payload),
          lastSyncAt: payload.lastSyncAt,
          at: Date.now(),
        };
        return cache;
      })
      .finally(() => {
        if (inflight?.promise === promise) inflight = null;
      });
    inflight = { email, promise };
  }
  return inflight.promise;
};

export function useRealtimeFeed() {
  const { user } = useAuth();
  const fresh = cache && cache.email === signedInKey() ? cache : null;
  const [data, setData] = useState<FeedCache | null>(fresh);
  const [loading, setLoading] = useState(!fresh);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (force = false) => {
    if (!cache || cache.email !== signedInKey() || force) setLoading(true);
    setError(null);
    try {
      setData(await load(force));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetched when a different user signs in.
  useEffect(() => {
    fetchData();
  }, [fetchData, user?.email, user?.role, user?.cluster, user?.branch]);

  // Already scoped by the backend to the user's cluster / branch folders (plus Others). The
  // user's Branch is a unit name ("Broadway") and the listing's unit a folder ("MH - Broadway"),
  // so comparing them here would hide everything.
  const doctors = useMemo(() => data?.doctors ?? [], [data]);
  const insights = useMemo(() => data?.insights ?? [], [data]);

  return {
    doctors,
    insights,
    lastSyncAt: data?.lastSyncAt ?? null,
    loading,
    error,
    refetch: () => fetchData(true),
  };
}

/** A listing's reviews from the collection the daily review sync keeps current. */
export async function fetchFeedReviews(locationId: string): Promise<ReviewSummaryData | null> {
  const res = await fetch(`${REALTIME_API}/feed/reviews?location=${encodeURIComponent(locationId)}`, {
    headers: realtimeHeaders(),
  });
  const json = await res.json();
  return json?.success ? (json.data as ReviewSummaryData) : null;
}

/** The mailbox sent to the reviews API for every listing. */
const REVIEWS_API_EMAIL = "dashboard@multipliersolutions.com";
const API_BASE = `${import.meta.env.VITE_API_BASE_URL || "https://smldatamanagement.multiplierai.co"}/api`;

/**
 * A listing's reviews for the detail report.
 *
 * The review collection (kept current by the daily sync) is read first and, when it has the
 * comments, that is all that is shown - no API call. It only holds a recent window, though, so
 * a listing whose Google count says it has reviews but whose positive or critical comments are
 * not in the collection falls back to the reviews API exactly as before (same endpoint, same
 * paging and large-profile cutoff, so the Duration label follows what the API read). The
 * location is the listing's own "accounts/<id>/locations/<id>" from the realtime data, and the
 * mailbox is REVIEWS_API_EMAIL. That mailbox cannot read every folder, so when it gets nothing
 * back the folder's own mailbox is tried once. A listing with no reviews at all makes no call.
 */
export async function fetchProfileReviews(
  locationId: string,
  account: string,
  folderEmail?: string
): Promise<ReviewSummaryData | null> {
  const stored = await fetchFeedReviews(locationId).catch(() => null);
  const total = stored?.totalReviewCount;
  if (stored && total === 0) return stored;

  const good = stored?.goodReviews.length ?? 0;
  const bad = stored?.badReviews.length ?? 0;
  const held = (stored as (ReviewSummaryData & { totalFetched?: number }) | null)?.totalFetched ?? 0;
  // Both kinds present, or the collection already holds every review Google counts.
  if (stored && ((good > 0 && bad > 0) || (good + bad > 0 && total !== undefined && held >= total))) return stored;
  if (!account) return stored;

  const ask = async (email: string): Promise<ReviewSummaryData | null> => {
    const res = await fetch(`${API_BASE}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, location: account, includeRatingOnly: true }),
    });
    const json = await res.json();
    const data = json?.success ? (json.data as ReviewSummaryData) : null;
    const empty = !data || (!data.goodReviews?.length && !data.badReviews?.length && !(data.ratings || []).some(Boolean));
    return empty ? null : data;
  };

  try {
    let live = await ask(REVIEWS_API_EMAIL);
    if (!live && folderEmail && folderEmail.toLowerCase() !== REVIEWS_API_EMAIL) live = await ask(folderEmail);
    if (!live) return stored;
    return {
      ...live,
      averageRating: live.averageRating ?? stored?.averageRating,
      totalReviewCount: live.totalReviewCount ?? stored?.totalReviewCount,
    };
  } catch (err) {
    console.error("Reviews API failed; showing the stored reviews", err);
    return stored;
  }
}

/**
 * Whether a listing sits in the chosen cluster / folder, by the same rule as the Realtime page:
 * folder membership (a listing can be in several folders), with the cluster of each folder from
 * the allocation sheet.
 */
export function matchesScope(
  doctor: Pick<FeedDoctor, "folders" | "unitName">,
  cluster: string,
  folder: string,
  unitClusters: Record<string, string[]>
) {
  const folders = doctor.folders?.length ? doctor.folders : [doctor.unitName];
  if (folder !== "ALL") return folders.includes(folder);
  if (cluster !== "ALL") return folders.some((f) => (unitClusters[f] ?? []).includes(cluster));
  return true;
}
