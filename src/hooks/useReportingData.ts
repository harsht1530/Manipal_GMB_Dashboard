import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import * as XLSX from "xlsx";

export interface ReportingRecord {
  _id: string;
  Cluster: string;
  Unit: string;
  "Business Profile Name": string;
  "GMB Status": string;
  "Profile Type": string;
  Date: string;
  "Longitude/Latitude"?: string;
  "Google Search Link"?: string;
  "GMB Short URL"?: string;
  "Creation Month"?: string;
  "Mail Id"?: string;
}

export interface StatusBreakdownItem {
  status: string;
  count: number;
  percentage: number;
}

export interface ClusterBreakdownItem {
  cluster: string;
  total: number;
  verified: number;
  needToVerify: number;
  outOfOrg: number;
  needAccess: number;
  suspended: number;
  notInterested: number;
  verifiedRate: number;
}

export interface ProfileTypeBreakdownItem {
  type: string;
  total: number;
  verified: number;
  needToVerify: number;
  outOfOrg: number;
  needAccess: number;
  suspended: number;
  notInterested: number;
  verifiedRate: number;
}

export interface UnitBreakdownItem {
  unit: string;
  cluster: string;
  total: number;
  verified: number;
  needToVerify: number;
  outOfOrg: number;
  needAccess: number;
  suspended: number;
  notInterested: number;
  verifiedRate: number;
}

export interface ReportingMetricChanges {
  total?: number;
  verified?: number;
  needToVerify?: number;
  outOfOrg?: number;
  needAccess?: number;
  suspended?: number;
  notInterested?: number;
}

export interface ReportingStats {
  total: number;
  verifiedCount: number;
  needToVerifyCount: number;
  outOfOrgCount: number;
  needAccessCount: number;
  suspendedCount: number;
  notInterestedCount: number;
  verifiedRate: number;
  currentDate?: string;
  previousDate?: string | null;
  changes?: ReportingMetricChanges | null;
  deltas?: ReportingMetricChanges | null;
  previousStats?: {
    date: string;
    total: number;
    verifiedCount: number;
    needToVerifyCount: number;
    outOfOrgCount: number;
    needAccessCount: number;
    suspendedCount: number;
    notInterestedCount: number;
  } | null;
  statusBreakdown: StatusBreakdownItem[];
  clusterBreakdown: ClusterBreakdownItem[];
  profileTypeBreakdown: ProfileTypeBreakdownItem[];
  unitBreakdown: UnitBreakdownItem[];
  dateTimeline: { date: string; total: number; verified: number; needToVerify: number }[];
}

export interface FilterOptions {
  dates: string[];
  latestDate?: string;
  clusters: string[];
  units: string[];
  statuses: string[];
  profileTypes: string[];
  unitClusterMap: Record<string, string>;
}

const PRIMARY_API_URL = `${import.meta.env.VITE_API_BASE_URL || "https://smldatamanagement.multiplierai.co"}/api`;
const LOCAL_API_URL = "http://localhost:5000/api";

// Robust fetch helper that tries primary URL, then falls back to localhost if 404 or network error
async function fetchWithFallback(endpoint: string, options?: RequestInit) {
  try {
    const res = await fetch(`${PRIMARY_API_URL}${endpoint}`, options);
    if (res.ok) {
      return await res.json();
    }
    // If 404 or server error, and primary is not localhost, fallback to localhost
    if (!PRIMARY_API_URL.includes("localhost") && (res.status === 404 || res.status >= 500)) {
      const localRes = await fetch(`${LOCAL_API_URL}${endpoint}`, options);
      if (localRes.ok) {
        return await localRes.json();
      }
    }
    return await res.json();
  } catch (err) {
    if (!PRIMARY_API_URL.includes("localhost")) {
      try {
        const localRes = await fetch(`${LOCAL_API_URL}${endpoint}`, options);
        if (localRes.ok) {
          return await localRes.json();
        }
      } catch (e) {
        // Both failed
      }
    }
    throw err;
  }
}

export function useReportingData(externalProfileTypes?: string[]) {
  const { user } = useAuth();

  // Filters State
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [selectedClusters, setSelectedClusters] = useState<string[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [internalProfileTypes, setInternalProfileTypes] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const effectiveProfileTypes = externalProfileTypes !== undefined ? externalProfileTypes : internalProfileTypes;

  // Pagination & Sorting
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(50);
  const [sortField, setSortField] = useState<string>("Business Profile Name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Reset page when external profile types change
  useEffect(() => {
    setCurrentPage(1);
  }, [externalProfileTypes]);

  // Data State
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    dates: [],
    clusters: [],
    units: [],
    statuses: [],
    profileTypes: [],
    unitClusterMap: {},
  });
  const [stats, setStats] = useState<ReportingStats | null>(null);
  const [records, setRecords] = useState<ReportingRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Loading & Error States
  const [loadingFilters, setLoadingFilters] = useState<boolean>(true);
  const [loadingStats, setLoadingStats] = useState<boolean>(true);
  const [loadingRecords, setLoadingRecords] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Set user role restrictions initially
  useEffect(() => {
    if (user?.branch) {
      setSelectedUnits([user.branch]);
    }
    if (user?.cluster && !user?.branch) {
      setSelectedClusters([user.cluster]);
    }
  }, [user]);

  // Fetch filter options once on mount
  useEffect(() => {
    let mounted = true;
    async function loadFilters() {
      try {
        setLoadingFilters(true);
        const res = await fetchWithFallback("/reports/filters");
        if (mounted && res.success && res.data) {
          setFilterOptions(res.data);
          // Default to latest month date
          const defaultDate = res.data.latestDate || (res.data.dates && res.data.dates.length > 0 ? res.data.dates[res.data.dates.length - 1] : "");
          if (defaultDate && selectedDates.length === 0) {
            setSelectedDates([defaultDate]);
          }
        }
      } catch (err: any) {
        if (mounted) {
          console.error("Failed to load reporting filters:", err);
          setError(err.message || "Failed to load reporting filter options");
        }
      } finally {
        if (mounted) setLoadingFilters(false);
      }
    }
    loadFilters();
    return () => {
      mounted = false;
    };
  }, []);

  // Build query string helper
  const buildQueryString = useCallback(
    (includePagination = true) => {
      const params = new URLSearchParams();

      if (selectedDates.length > 0 && !selectedDates.includes("All")) {
        params.set("date", selectedDates.join(","));
      }
      if (selectedClusters.length > 0 && !selectedClusters.includes("All")) {
        params.set("cluster", selectedClusters.join(","));
      }
      if (selectedUnits.length > 0 && !selectedUnits.includes("All")) {
        params.set("unit", selectedUnits.join(","));
      }
      if (selectedStatuses.length > 0 && !selectedStatuses.includes("All")) {
        params.set("status", selectedStatuses.join(","));
      }
      if (effectiveProfileTypes.length > 0 && !effectiveProfileTypes.includes("All")) {
        params.set("profileType", effectiveProfileTypes.join(","));
      }
      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }

      if (includePagination) {
        params.set("page", currentPage.toString());
        params.set("limit", limit.toString());
        params.set("sortField", sortField);
        params.set("sortOrder", sortOrder);
      }

      return params.toString();
    },
    [
      selectedDates,
      selectedClusters,
      selectedUnits,
      selectedStatuses,
      effectiveProfileTypes,
      searchQuery,
      currentPage,
      limit,
      sortField,
      sortOrder,
    ]
  );

  // Fetch Stats when filters change
  const fetchStats = useCallback(async () => {
    try {
      setLoadingStats(true);
      const qs = buildQueryString(false);
      const res = await fetchWithFallback(`/reports/stats?${qs}`);
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch (err: any) {
      console.error("Failed to fetch reports stats:", err);
    } finally {
      setLoadingStats(false);
    }
  }, [buildQueryString]);

  // Fetch paginated records when filters, pagination, or sorting change
  const fetchRecords = useCallback(async () => {
    try {
      setLoadingRecords(true);
      const qs = buildQueryString(true);
      const res = await fetchWithFallback(`/reports/data?${qs}`);
      if (res.success && res.data) {
        setRecords(res.data);
        if (res.pagination) {
          setTotalRecords(res.pagination.total);
          setTotalPages(res.pagination.totalPages);
        }
      }
    } catch (err: any) {
      console.error("Failed to fetch reports records:", err);
    } finally {
      setLoadingRecords(false);
    }
  }, [buildQueryString]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Reset page to 1 when filters or search change
  const handleFilterChange = (setter: (val: string[]) => void) => (val: string[]) => {
    setter(val);
    setCurrentPage(1);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    if (!user?.cluster) setSelectedClusters([]);
    if (!user?.branch) setSelectedUnits([]);
    setSelectedStatuses([]);
    setInternalProfileTypes([]);
    setSearchQuery("");
    const defaultDate = filterOptions.latestDate || (filterOptions.dates && filterOptions.dates.length > 0 ? filterOptions.dates[filterOptions.dates.length - 1] : "");
    if (defaultDate) {
      setSelectedDates([defaultDate]);
    } else {
      setSelectedDates([]);
    }
    setCurrentPage(1);
  };

  // Filter available units dynamically based on selected clusters
  const availableUnits = useMemo(() => {
    if (selectedClusters.length === 0 || selectedClusters.includes("All")) {
      return filterOptions.units;
    }
    return filterOptions.units.filter((unit) => {
      const cluster = filterOptions.unitClusterMap[unit];
      if (!cluster) return true;
      return selectedClusters.some(
        (c) =>
          c.toLowerCase() === cluster.toLowerCase() ||
          (c.toLowerCase().includes("south east") && cluster.toLowerCase().includes("south"))
      );
    });
  }, [filterOptions.units, filterOptions.unitClusterMap, selectedClusters]);

  // Export functions (Excel and CSV)
  const exportData = useCallback(
    async (mode: "filtered" | "all" = "filtered", format: "xlsx" | "csv" = "xlsx") => {
      try {
        setIsExporting(true);
        const params = new URLSearchParams();

        if (mode === "filtered") {
          if (selectedDates.length > 0 && !selectedDates.includes("All")) {
            params.set("date", selectedDates.join(","));
          }
          if (selectedClusters.length > 0 && !selectedClusters.includes("All")) {
            params.set("cluster", selectedClusters.join(","));
          }
          if (selectedUnits.length > 0 && !selectedUnits.includes("All")) {
            params.set("unit", selectedUnits.join(","));
          }
          if (selectedStatuses.length > 0 && !selectedStatuses.includes("All")) {
            params.set("status", selectedStatuses.join(","));
          }
          if (effectiveProfileTypes.length > 0 && !effectiveProfileTypes.includes("All")) {
            params.set("profileType", effectiveProfileTypes.join(","));
          }
          if (searchQuery.trim()) {
            params.set("search", searchQuery.trim());
          }
        }

        const res = await fetchWithFallback(`/reports/export?${params.toString()}`);
        if (!res.success || !res.data) {
          throw new Error("No data returned for export");
        }

        const rawList: ReportingRecord[] = res.data;

        // Clean & format data for user export
        const formattedData = rawList.map((row, index) => ({
          "S.No": index + 1,
          "Business Profile Name": row["Business Profile Name"] || "",
          "Unit (Branch)": row.Unit || "",
          Cluster: row.Cluster || "",
          "Profile Type": row["Profile Type"] || "",
          "GMB Verification Status": row["GMB Status"] || "",
          "Snapshot Date": row.Date || "",
          "Google Search Link": row["Google Search Link"] || "",
          "GMB Short URL": row["GMB Short URL"] || "",
          "Longitude/Latitude": row["Longitude/Latitude"] || "",
        }));

        const wb = XLSX.utils.book_new();

        // 1. Detailed Profiles Sheet
        const wsProfiles = XLSX.utils.json_to_sheet(formattedData);
        XLSX.utils.book_append_sheet(wb, wsProfiles, "Historical Profiles");

        // 2. If stats are available, add a Summary Sheet
        if (stats) {
          const summaryData = [
            { Metric: "Total Profiles", Value: stats.total },
            { Metric: "Verified Profiles", Value: stats.verifiedCount },
            { Metric: "Verification Rate", Value: `${stats.verifiedRate}%` },
            { Metric: "Need to verify", Value: stats.needToVerifyCount },
            { Metric: "Out of Organization", Value: stats.outOfOrgCount },
            { Metric: "Need Access", Value: stats.needAccessCount },
            { Metric: "Suspended", Value: stats.suspendedCount },
            { Metric: "Not Interested", Value: stats.notInterestedCount },
          ];
          const wsSummary = XLSX.utils.json_to_sheet(summaryData);
          XLSX.utils.book_append_sheet(wb, wsSummary, "Status Summary");

          // Cluster Breakdown Sheet
          const clusterData = stats.clusterBreakdown.map((c) => ({
            Cluster: c.cluster,
            "Total Profiles": c.total,
            Verified: c.verified,
            "Verified Rate (%)": `${c.verifiedRate}%`,
            "Need to verify": c.needToVerify,
            "Out of Organization": c.outOfOrg,
            "Need Access": c.needAccess,
            Suspended: c.suspended,
            "Not Interested": c.notInterested,
          }));
          const wsCluster = XLSX.utils.json_to_sheet(clusterData);
          XLSX.utils.book_append_sheet(wb, wsCluster, "Cluster Breakdown");

          // Unit Breakdown Sheet
          const unitData = stats.unitBreakdown.map((u) => ({
            "Unit (Branch)": u.unit,
            Cluster: u.cluster,
            "Total Profiles": u.total,
            Verified: u.verified,
            "Verified Rate (%)": `${u.verifiedRate}%`,
            "Need to verify": u.needToVerify,
            "Out of Organization": u.outOfOrg,
            "Need Access": u.needAccess,
          }));
          const wsUnit = XLSX.utils.json_to_sheet(unitData);
          XLSX.utils.book_append_sheet(wb, wsUnit, "Unit (Branch) Breakdown");
        }

        const dateStamp = selectedDates[0] || new Date().toISOString().split("T")[0];
        const fileName = `Manipal_Historical_Profiles_Report_${dateStamp}.${format}`;

        if (format === "csv") {
          XLSX.writeFile(wb, fileName, { bookType: "csv" });
        } else {
          XLSX.writeFile(wb, fileName, { bookType: "xlsx" });
        }

        return { success: true, count: rawList.length };
      } catch (err: any) {
        console.error("Export error:", err);
        throw err;
      } finally {
        setIsExporting(false);
      }
    },
    [
      selectedDates,
      selectedClusters,
      selectedUnits,
      selectedStatuses,
      effectiveProfileTypes,
      searchQuery,
      stats,
    ]
  );

  return {
    // Filter State & Setters
    selectedDates,
    setSelectedDates: handleFilterChange(setSelectedDates),
    selectedClusters,
    setSelectedClusters: handleFilterChange(setSelectedClusters),
    selectedUnits,
    setSelectedUnits: handleFilterChange(setSelectedUnits),
    selectedStatuses,
    setSelectedStatuses: handleFilterChange(setSelectedStatuses),
    selectedProfileTypes: effectiveProfileTypes,
    setSelectedProfileTypes: handleFilterChange(setInternalProfileTypes),
    searchQuery,
    setSearchQuery: handleSearchChange,
    handleResetFilters,

    // Filter Options
    filterOptions,
    availableUnits,

    // Pagination & Sorting
    currentPage,
    setCurrentPage,
    limit,
    setLimit,
    sortField,
    setSortField,
    sortOrder,
    setSortOrder,
    totalRecords,
    totalPages,

    // Data
    stats,
    records,

    // Loading & Exporting
    loadingFilters,
    loadingStats,
    loadingRecords,
    isExporting,
    error,
    refreshData: () => {
      fetchStats();
      fetchRecords();
    },
    exportData,
  };
}

export const formatReportDateLabel = (dateStr: string, isLatest = false) => {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthIndex = parseInt(parts[1], 10) - 1;
    const year = parts[2];
    const monthName = monthNames[monthIndex] || "";
    return `${dateStr} (${monthName} ${year}${isLatest ? " - Latest" : ""})`;
  }
  return dateStr;
};
