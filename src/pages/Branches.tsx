import { useState, useMemo, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMongoData, InsightData, DoctorData } from "@/hooks/useMongoData";
import { FilterBar } from "@/components/dashboard/FilterBar";
import {
  Building2,
  Users,
  Search,
  Map as MapIcon,
  Phone,
  Globe,
  Navigation,
  Star,
  TrendingUp,
  Loader2,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

interface BranchStats {
  name: string;
  cluster: string;
  profileCount: number;
  totalSearchImpressions: number;
  totalMapsViews: number;
  totalDirections: number;
  totalWebsiteClicks: number;
  totalCalls: number;
  averageRating: number;
  totalKeywords: number;
  rankingKeywords: number;
}

const Branches = () => {
  const { user } = useAuth();
  const { insights, doctors, loading } = useMongoData();

  const [selectedCluster, setSelectedCluster] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string[]>([]);
  const [selectedSpeciality, setSelectedSpeciality] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (user?.branch) {
      setSelectedBranch([user.branch]);
    } else if (user?.cluster) {
      setSelectedCluster([user.cluster]);
    }
  }, [user]);

  const isBranchRestricted = !!user?.branch;
  const isClusterRestricted = !!user?.cluster && !user?.branch;

  const dashboardTitle = user?.role === "Admin" ? "Units" : (user?.branch || user?.cluster || "Units");
  const dashboardSubtitle = user?.role === "Admin" ? "Unit-wise performance analytics" : `${user?.branch ? 'Unit' : 'Cluster'} Level Access Overview`;

  // Derive filter options
  const filterOptions = useMemo(() => {
    // Extract unique years
    const uniqueYears = [...new Set(insights.map(i => {
      try {
        const d = new Date(i.date);
        return !isNaN(d.getFullYear()) ? d.getFullYear().toString() : "";
      } catch (e) { return ""; }
    }))].filter(Boolean).sort().reverse();

    const years = uniqueYears;

    const clusters = [...new Set(insights.map(i => i.cluster))].filter(Boolean).sort();
    const branches = [...new Set(insights.map(i => i.branch))].filter(Boolean).sort();
    const specialities = [...new Set(insights.map(i => i.speciality))].filter(Boolean).sort();

    // Filter by year for months list
    const monthData = selectedYear.length > 0
      ? insights.filter(i => {
        const d = new Date(i.date);
        const y = !isNaN(d.getFullYear()) ? d.getFullYear().toString() : "";
        return selectedYear.includes(y);
      })
      : insights;

    const months = [...new Set(monthData.map(i => i.month))].filter(Boolean);

    // Sort months chronologically
    const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    months.sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));

    return { clusters, branches, specialities, months, years };
  }, [insights, selectedYear]);

  // Get the absolute latest Date string from the data
  const latestDataDate = useMemo(() => {
    if (insights.length === 0) return "";
    
    // Sort by Date object to find the absolute latest entry
    const sortedInsights = [...insights].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (isNaN(dateA)) return 1;
      if (isNaN(dateB)) return -1;
      return dateB - dateA;
    });

    return sortedInsights[0]?.date || "";
  }, [insights]);

  // Derive associated month name for the latest date
  const latestDataMonth = useMemo(() => {
    const record = insights.find(i => i.date === latestDataDate);
    return record?.month || "Jan";
  }, [insights, latestDataDate]);


  const branchStats: BranchStats[] = useMemo(() => {
    const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    // Identify the date to use for "current" profile counts
    // If user has filtered by month/year, we should ideally find the latest date within that selection
    // But per user request "most recent available month", we'll default to absolute latest if no filter
    const activeLatestDate = (selectedMonth.length === 0 && selectedYear.length === 0)
      ? latestDataDate
      : insights.filter(i => {
          const monthMatch = selectedMonth.length === 0 || selectedMonth.includes(i.month);
          let yearMatch = true;
          if (selectedYear.length > 0) {
            const d = new Date(i.date);
            const y = !isNaN(d.getFullYear()) ? d.getFullYear().toString() : "";
            yearMatch = selectedYear.includes(y);
          }
          return monthMatch && yearMatch;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.date || latestDataDate;

    // 1. Filter Source Data for Cumulative Metrics
    const filteredInsights = insights.filter(item => {
      const clusterMatch = selectedCluster.length === 0 || selectedCluster.includes(item.cluster);
      const branchMatch = selectedBranch.length === 0 || selectedBranch.includes(item.branch);
      const specialityMatch = selectedSpeciality.length === 0 || selectedSpeciality.includes(item.speciality);
      const monthMatch = selectedMonth.length === 0 || selectedMonth.includes(item.month);

      let yearMatch = true;
      if (selectedYear.length > 0) {
        const d = new Date(item.date);
        const y = !isNaN(d.getFullYear()) ? d.getFullYear().toString() : "";
        yearMatch = selectedYear.includes(y);
      }

      return clusterMatch && branchMatch && specialityMatch && monthMatch && yearMatch;
    });

    // 2. Filter Insights for Profile Count (Snapshot logic using exact Date)
    const profileInsights = insights.filter(item => {
      const clusterMatch = selectedCluster.length === 0 || selectedCluster.includes(item.cluster);
      const branchMatch = selectedBranch.length === 0 || selectedBranch.includes(item.branch);
      const specialityMatch = selectedSpeciality.length === 0 || selectedSpeciality.includes(item.speciality);
      const dateMatch = item.date === activeLatestDate;
      return clusterMatch && branchMatch && specialityMatch && dateMatch;
    });

    const filteredDoctors = doctors.filter(doc => {
      const clusterMatch = selectedCluster.length === 0 || selectedCluster.includes(doc.cluster);
      const branchMatch = selectedBranch.length === 0 || selectedBranch.includes(doc.branch);
      return clusterMatch && branchMatch;
    });

    const branchMap = new Map<string, BranchStats & {
      uniqueProfiles: Set<string>,
      ratingSum: number,
      ratingCount: number
    }>();

    // Aggregate profile counts from profileInsights
    profileInsights.forEach((insight) => {
      let existing = branchMap.get(insight.branch);
      if (!existing) {
        existing = {
          name: insight.branch,
          cluster: insight.cluster,
          profileCount: 0,
          totalSearchImpressions: 0,
          totalMapsViews: 0,
          totalDirections: 0,
          totalWebsiteClicks: 0,
          totalCalls: 0,
          averageRating: 0,
          totalKeywords: 0,
          rankingKeywords: 0,
          uniqueProfiles: new Set(),
          ratingSum: 0,
          ratingCount: 0
        };
        branchMap.set(insight.branch, existing);
      }
      if (insight.businessName) {
        existing.uniqueProfiles.add(insight.businessName);
      }
    });

    // Aggregate metrics from filteredInsights (cumulative)
    filteredInsights.forEach((insight) => {
      let existing = branchMap.get(insight.branch);
      if (!existing) {
        existing = {
          name: insight.branch,
          cluster: insight.cluster,
          profileCount: 0,
          totalSearchImpressions: 0,
          totalMapsViews: 0,
          totalDirections: 0,
          totalWebsiteClicks: 0,
          totalCalls: 0,
          averageRating: 0,
          totalKeywords: 0,
          rankingKeywords: 0,
          uniqueProfiles: new Set(),
          ratingSum: 0,
          ratingCount: 0
        };
        branchMap.set(insight.branch, existing);
      }

      existing.totalSearchImpressions += insight.googleSearchMobile + insight.googleSearchDesktop;
      existing.totalMapsViews += insight.googleMapsMobile + insight.googleMapsDesktop;
      existing.totalDirections += insight.directions;
      existing.totalWebsiteClicks += insight.websiteClicks;
      existing.totalCalls += insight.calls;

      // Track Ratings
      if (insight.rating > 0) {
        existing.ratingSum += insight.rating;
        existing.ratingCount += 1;
      }
    });

    // Add keyword data from doctors
    filteredDoctors.forEach((doctor) => {
      let branchData = branchMap.get(doctor.branch);
      if (branchData) {
        branchData.totalKeywords += doctor.labels.length;
        branchData.rankingKeywords += doctor.labels.filter(l => l.rank > 0 && l.rank <= 10).length;
      }
    });

    // Finalize counts and averages
    return Array.from(branchMap.values()).map(stats => {
      const avgRating = stats.ratingCount > 0 ? stats.ratingSum / stats.ratingCount : 0;
      return {
        ...stats,
        profileCount: stats.uniqueProfiles.size,
        averageRating: avgRating
      };
    }).sort((a, b) => b.totalSearchImpressions - a.totalSearchImpressions);

  }, [insights, doctors, selectedCluster, selectedBranch, selectedSpeciality, selectedMonth, latestDataDate, selectedYear]);

  const activeLatestMonth = useMemo(() => {
    // Determine which month name to show in the badge
    if (selectedMonth.length === 0 && selectedYear.length === 0) return latestDataMonth;
    
    // Find the month associated with the latest date in the current selection
    const activeLatestDate = insights.filter(i => {
      const monthMatch = selectedMonth.length === 0 || selectedMonth.includes(i.month);
      let yearMatch = true;
      if (selectedYear.length > 0) {
        const d = new Date(i.date);
        const y = !isNaN(d.getFullYear()) ? d.getFullYear().toString() : "";
        yearMatch = selectedYear.includes(y);
      }
      return monthMatch && yearMatch;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.date;

    const record = insights.find(i => i.date === activeLatestDate);
    return record?.month || latestDataMonth;
  }, [selectedMonth, selectedYear, latestDataMonth, insights]);

  const totalStats = useMemo(() => {
    return {
      branches: branchStats.length,
      profiles: branchStats.reduce((acc, b) => acc + b.profileCount, 0),
      impressions: branchStats.reduce((acc, b) => acc + b.totalSearchImpressions, 0),
      calls: branchStats.reduce((acc, b) => acc + b.totalCalls, 0),
    };
  }, [branchStats]);

  if (loading) {
    return (
      <DashboardLayout title={dashboardTitle} subtitle={dashboardSubtitle}>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Loading data...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={dashboardTitle} subtitle={dashboardSubtitle}>

      <div className="flex justify-end mb-4">
        <Button 
          variant="outline" 
          onClick={() => setShowFilters(!showFilters)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </Button>
      </div>

      {showFilters && (
        <FilterBar
          selectedCluster={selectedCluster}
          selectedBranch={selectedBranch}
          selectedMonth={selectedMonth}
          selectedSpeciality={selectedSpeciality}
          clusterOptions={filterOptions.clusters}
          branchOptions={filterOptions.branches}
          monthOptions={filterOptions.months}
          specialityOptions={filterOptions.specialities}
          onClusterChange={setSelectedCluster}
          onBranchChange={setSelectedBranch}
          onMonthChange={setSelectedMonth}
          onYearChange={setSelectedYear}
          selectedYear={selectedYear}
          onSpecialityChange={setSelectedSpeciality}
          hideMonth={false}
          yearOptions={filterOptions.years}
          hideCluster={isBranchRestricted || isClusterRestricted}
          hideBranch={isBranchRestricted}
        />
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card className="animate-slide-up">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalStats.branches}</p>
                <p className="text-xs text-muted-foreground">Total Units</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="animate-slide-up" style={{ animationDelay: "50ms" }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/20">
                <Users className="h-5 w-5 text-success" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">{totalStats.profiles}</p>
                  <Badge variant="secondary" className="text-[10px] px-1.5 h-4">
                    {activeLatestMonth}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">Total Profiles</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="animate-slide-up" style={{ animationDelay: "100ms" }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
                <Search className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {totalStats.impressions.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Total Impressions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="animate-slide-up" style={{ animationDelay: "150ms" }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/20">
                <Phone className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalStats.calls}</p>
                <p className="text-xs text-muted-foreground">Total Calls</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Branch Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {branchStats.map((branch, index) => (
          <Card
            key={branch.name}
            className="overflow-hidden animate-slide-up"
            style={{ animationDelay: `${(index + 4) * 50}ms` }}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    {branch.name}
                  </CardTitle>
                  <Badge variant="outline" className="mt-2">
                    {branch.cluster} Cluster
                  </Badge>
                </div>
                {branch.averageRating > 0 && (
                  <div className="flex items-center gap-1 bg-accent rounded-lg px-2 py-1">
                    <Star className="h-4 w-4 fill-warning text-warning" />
                    <span className="font-semibold text-sm">
                      {branch.averageRating.toFixed(1)}
                    </span>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Profile Count */}
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Profiles
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] px-1.5 h-4">
                    {activeLatestMonth}
                  </Badge>
                  <span className="font-semibold">{branch.profileCount}</span>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-secondary rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <Search className="h-3.5 w-3.5" />
                    <span className="text-xs">Search</span>
                  </div>
                  <p className="font-semibold">
                    {branch.totalSearchImpressions.toLocaleString()}
                  </p>
                </div>
                <div className="bg-secondary rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <MapIcon className="h-3.5 w-3.5" />
                    <span className="text-xs">Maps</span>
                  </div>
                  <p className="font-semibold">
                    {branch.totalMapsViews.toLocaleString()}
                  </p>
                </div>
                <div className="bg-secondary rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <Navigation className="h-3.5 w-3.5" />
                    <span className="text-xs">Directions</span>
                  </div>
                  <p className="font-semibold">{branch.totalDirections}</p>
                </div>
                <div className="bg-secondary rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <Phone className="h-3.5 w-3.5" />
                    <span className="text-xs">Calls</span>
                  </div>
                  <p className="font-semibold">{branch.totalCalls}</p>
                </div>
              </div>

              {/* Keywords */}
              {branch.totalKeywords > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Keywords Ranking
                  </span>
                  <Badge variant="secondary">
                    {branch.rankingKeywords} / {branch.totalKeywords}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default Branches;
