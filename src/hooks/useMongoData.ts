import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";

export interface InsightData {
  id: string;
  businessName: string;
  googleSearchMobile: number;
  googleSearchDesktop: number;
  googleMapsMobile: number;
  googleMapsDesktop: number;
  directions: number;
  websiteClicks: number;
  calls: number;
  cluster: string;
  month: string;
  branch: string;
  date: string;
  speciality: string;
  review: number;
  rating: number;
  department: string;
  phone: string;
}

export interface DoctorData {
  id: string;
  businessName: string;
  name: string;
  phone: string;
  placeId: string;
  newReviewUri: string;
  mapsUri: string;
  websiteUrl: string;
  labels: LabelData[];
  primaryCategory: string;
  address: string;
  averageRating: number;
  totalReviewCount: number;
  mailId: string;
  cluster: string;
  branch: string;
  profileScreenshot: string;
  account: string;
}

export interface LabelData {
  rank: number;
  label: string;
  competitors: string[];
  screenShot?: string;
}

export interface LocationData {
  id: string;
  month: string;
  cluster: string;
  unitName: string;
  department: string;
  totalProfiles: number;
  verifiedProfiles: number;
  unverifiedProfiles: number;
  needAccess: number;
  notInterested: number;
  outOfOrganization: number;
}

// Transform MongoDB insight document to frontend format
function transformInsight(doc: any): InsightData {
  return {
    id: doc._id?.$oid || String(Math.random()),
    businessName: doc["Business name"] || "",
    googleSearchMobile: doc["Google Search - Mobile"] || 0,
    googleSearchDesktop: doc["Google Search - Desktop"] || 0,
    googleMapsMobile: doc["Google Maps - Mobile"] || 0,
    googleMapsDesktop: doc["Google Maps - Desktop"] || 0,
    directions: doc["Directions"] || 0,
    websiteClicks: doc["Website clicks"] || 0,
    calls: doc["Calls"] || 0,
    cluster: doc["Cluster"] || "",
    month: doc["Month"] || "",
    branch: doc["Branch"] || "",
    date: doc["Date"] || "",
    speciality: doc["Speciality"] || "",
    review: doc["Review"] || 0,
    rating: doc["Rating"] || 0,
    department: doc["Department"] || "",
    phone: doc["Phone"] || "Not available"
  };
}

// Transform MongoDB doctor document to frontend format
function transformDoctor(doc: any): DoctorData {
  return {
    id: doc._id?.$oid || String(Math.random()),
    businessName: doc.business_name || "",
    name: doc.name || "",
    phone: doc.phone || "Not available",
    placeId: doc.placeId || "",
    newReviewUri: doc.newReviewUri || "",
    mapsUri: doc.mapsUri || "",
    websiteUrl: doc.websiteUrl || "",
    labels: (doc.labels || []).map((l: any) => ({
      rank: l.rank || 0,
      label: l.label || "",
      competitors: l.competitors || [],
      screenShot: l.screen_shot || ""
    })),
    primaryCategory: doc.primaryCategory || "",
    address: doc.address || "",
    averageRating: doc.averageRating || 0,
    totalReviewCount: doc.totalReviewCount || 0,
    mailId: doc.mail_id || "",
    cluster: doc.Cluster || "",
    branch: doc.Branch || "",
    profileScreenshot: doc.profile_screenshot || "",
    account: doc.account || ""
  };
}

// Transform MongoDB location document to frontend format
function transformLocation(doc: any): LocationData {
  return {
    id: doc._id?.$oid || String(Math.random()),
    month: doc["Month"] || "",
    cluster: doc["Cluster"] || "",
    unitName: doc["Unit Name"] || "",
    department: doc["Department"] || "",
    totalProfiles: doc["Total Profiles"] || 0,
    verifiedProfiles: doc["Verified Profiles"] || 0,
    unverifiedProfiles: doc["Unverfied Profiles"] || 0,
    needAccess: doc["Need Access"] || 0,
    notInterested: doc["Not Intrested"] || 0,
    outOfOrganization: doc["Out Of Organization"] || 0
  };
}

const API_URL = "http://localhost:5000/api";

// Module-level cache
let globalCache: {
  insights: InsightData[] | null;
  doctors: DoctorData[] | null;
  locations: LocationData[] | null;
  top10: { latestMonth: string; topDoctors: InsightData[] } | null;
} = {
  insights: null,
  doctors: null,
  locations: null,
  top10: null,
};

export function useMongoData() {
  const { user } = useAuth();
  const [rawInsights, setRawInsights] = useState<InsightData[]>(globalCache.insights || []);
  const [rawDoctors, setRawDoctors] = useState<DoctorData[]>(globalCache.doctors || []);
  const [rawLocations, setRawLocations] = useState<LocationData[]>(globalCache.locations || []);
  const [rawTop10, setRawTop10] = useState<{ latestMonth: string; topDoctors: InsightData[] } | null>(globalCache.top10);
  const [loading, setLoading] = useState(!globalCache.insights);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (force = false) => {
    if (!force && globalCache.insights && globalCache.doctors && globalCache.locations) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [insightsRes, doctorsRes, locationsRes, top10Res] = await Promise.all([
        fetch(`${API_URL}/insights`).then(res => res.json()),
        fetch(`${API_URL}/doctors`).then(res => res.json()),
        fetch(`${API_URL}/locations`).then(res => res.json()),
        fetch(`${API_URL}/top10-doctors`).then(res => res.json())
      ]);

      if (insightsRes.success && insightsRes.data) {
        const transformed = insightsRes.data.map(transformInsight);
        setRawInsights(transformed);
        globalCache.insights = transformed;
      }
      if (doctorsRes.success && doctorsRes.data) {
        const transformed = doctorsRes.data.map(transformDoctor);
        setRawDoctors(transformed);
        globalCache.doctors = transformed;
      }
      if (locationsRes.success && locationsRes.data) {
        const transformed = locationsRes.data.map(transformLocation);
        setRawLocations(transformed);
        globalCache.locations = transformed;
      }
      if (top10Res.success && top10Res.data) {
        const transformed = {
          latestMonth: top10Res.data.latestMonth,
          topDoctors: top10Res.data.topDoctors.map(transformInsight)
        };
        setRawTop10(transformed);
        globalCache.top10 = transformed;
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  const insights = useMemo(() => {
    if (!user || user.role === "Admin") return rawInsights;
    return rawInsights.filter(i => {
      if (user.branch) return i.branch === user.branch;
      if (user.cluster) return i.cluster === user.cluster;
      return true;
    });
  }, [rawInsights, user]);

  const doctors = useMemo(() => {
    if (!user || user.role === "Admin") return rawDoctors;
    return rawDoctors.filter(d => {
      if (user.branch) return d.branch === user.branch;
      if (user.cluster) return d.cluster === user.cluster;
      return true;
    });
  }, [rawDoctors, user]);

  const locations = useMemo(() => {
    if (!user || user.role === "Admin") return rawLocations;
    return rawLocations.filter(l => {
      if (user.branch) return l.unitName === user.branch;
      if (user.cluster) return l.cluster === user.cluster;
      return true;
    });
  }, [rawLocations, user]);

  const top10Data = useMemo(() => {
    if (!rawTop10) return null;
    if (!user || user.role === "Admin") return rawTop10;
    return {
      latestMonth: rawTop10.latestMonth,
      topDoctors: rawTop10.topDoctors.filter(d => {
        if (user.branch) return d.branch === user.branch;
        if (user.cluster) return d.cluster === user.cluster;
        return true;
      })
    };
  }, [rawTop10, user]);

  const fetchDoctorDetails = useCallback(async (doctorName: string) => {
    try {
      const res = await fetch(`${API_URL}/doctor-details/${encodeURIComponent(doctorName)}`).then(r => r.json());
      if (res.success && res.data) {
        return {
          profile: res.data.profile ? transformDoctor(res.data.profile) : null,
          monthlyInsights: (res.data.monthlyInsights || []).map(transformInsight),
          keywords: res.data.keywords || [],
          competitors: res.data.competitors || []
        };
      }
      return null;
    } catch (err) {
      console.error('Error fetching doctor details:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    insights,
    doctors,
    locations,
    top10Data,
    loading,
    error,
    refetch: () => fetchData(true),
    fetchDoctorDetails
  };
}

export function getAggregatedMetrics(data: InsightData[]) {
  const validRatings = data.filter(d => d.rating > 0);
  return {
    totalSearchImpressions: data.reduce((acc, item) => acc + item.googleSearchMobile + item.googleSearchDesktop, 0),
    totalMapsViews: data.reduce((acc, item) => acc + item.googleMapsMobile + item.googleMapsDesktop, 0),
    totalDirections: data.reduce((acc, item) => acc + item.directions, 0),
    totalWebsiteClicks: data.reduce((acc, item) => acc + item.websiteClicks, 0),
    totalCalls: data.reduce((acc, item) => acc + item.calls, 0),
    averageRating: validRatings.length > 0 ? validRatings.reduce((acc, item) => acc + item.rating, 0) / validRatings.length : 0,
    googleSearchMobile: data.reduce((acc, item) => acc + item.googleSearchMobile, 0),
    googleSearchDesktop: data.reduce((acc, item) => acc + item.googleSearchDesktop, 0),
    googleMapsMobile: data.reduce((acc, item) => acc + item.googleMapsMobile, 0),
    googleMapsDesktop: data.reduce((acc, item) => acc + item.googleMapsDesktop, 0),
    totalSearches: data.reduce((acc, item) => acc + item.googleSearchMobile + item.googleSearchDesktop + item.googleMapsMobile + item.googleMapsDesktop, 0)
  };
}
