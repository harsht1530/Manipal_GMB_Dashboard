import { useState, useMemo, useEffect, useTransition } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { PerformanceTable } from "@/components/dashboard/PerformanceTable";
import { TopPerformers } from "@/components/dashboard/TopPerformers";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { LocationsOverview } from "@/components/dashboard/LocationsOverview";
import { useMongoData, getAggregatedMetrics } from "@/hooks/useMongoData";
import { Search, Map, Navigation, Globe, Phone, Star, Smartphone, Monitor, MapPin, Loader2, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

import { ReviewSummary } from "@/components/dashboard/ReviewSummary";
import { cn } from "@/lib/utils";

const Index = () => {
  const [selectedCluster, setSelectedCluster] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string[]>([]);
  const [selectedSpeciality, setSelectedSpeciality] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedRatings, setSelectedRatings] = useState<number[]>([]);

  const { insights, doctors, locations, top10Data, loading } = useMongoData();
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 10);
    return () => clearTimeout(timer);
  }, []);

  // Derive unique filter options from the insights data with dependencies
  const filterOptions = useMemo(() => {
    if (!mounted || loading) {
      return { clusters: [], branches: [], months: [], specialities: [] };
    }
    // 1. Clusters depend on selected Departments (Profile Types)
    const clusterData = selectedDepartments.length > 0
      ? insights.filter(i => selectedDepartments.includes(i.department))
      : insights;
    const clusters = [...new Set(clusterData.map(i => i.cluster))].filter(Boolean).sort();

    // 2. Branches depend on selected Clusters AND selected Departments
    const branchData = insights.filter(i => {
      const clusterMatch = selectedCluster.length === 0 || selectedCluster.includes(i.cluster);
      const departmentMatch = selectedDepartments.length === 0 || selectedDepartments.includes(i.department);
      return clusterMatch && departmentMatch;
    });
    const branches = [...new Set(branchData.map(i => i.branch))].filter(Boolean).sort();

    const months = [...new Set(insights.map(i => i.month))].filter(Boolean);

    // 3. Specialities depend on selected Clusters, Branches, Departments, and Ratings
    const specialityData = insights.filter(i => {
      const clusterMatch = selectedCluster.length === 0 || selectedCluster.includes(i.cluster);
      const branchMatch = selectedBranch.length === 0 || selectedBranch.includes(i.branch);
      const departmentMatch = selectedDepartments.length === 0 || selectedDepartments.includes(i.department);
      const ratingMatch = selectedRatings.length === 0 || selectedRatings.some(r => Math.floor(i.rating) === r);
      return clusterMatch && branchMatch && departmentMatch && ratingMatch;
    });
    const specialities = [...new Set(specialityData.map(i => i.speciality))].filter(Boolean).sort();

    // Sort months chronologically
    const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    months.sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));

    return { clusters, branches, months, specialities };
  }, [insights, selectedDepartments, selectedCluster, mounted, loading]);

  const filteredData = useMemo(() => {
    if (!mounted || loading) return [];
    return insights.filter((item) => {
      const clusterMatch = selectedCluster.length === 0 || selectedCluster.includes(item.cluster);
      const branchMatch = selectedBranch.length === 0 || selectedBranch.includes(item.branch);
      const monthMatch = selectedMonth.length === 0 || selectedMonth.includes(item.month);
      const specialityMatch = selectedSpeciality.length === 0 || selectedSpeciality.includes(item.speciality);
      const departmentMatch = selectedDepartments.length === 0 || selectedDepartments.includes(item.department);
      const ratingMatch = selectedRatings.length === 0 || selectedRatings.some(r => Math.floor(item.rating) === r);
      return clusterMatch && branchMatch && monthMatch && specialityMatch && departmentMatch && ratingMatch;
    });
  }, [insights, selectedCluster, selectedBranch, selectedMonth, selectedSpeciality, selectedDepartments, selectedRatings, mounted, loading]);

  // Calculate total reviews and average rating
  const reviewStats = useMemo(() => {
    const totalReviews = filteredData.reduce((acc, item) => acc + (item.review || 0), 0);
    const validRatings = filteredData.filter(item => item.rating > 0);
    const averageRating = validRatings.length > 0
      ? validRatings.reduce((acc, item) => acc + item.rating, 0) / validRatings.length
      : 0;
    return { totalReviews, averageRating };
  }, [filteredData]);

  // Get the chronologically latest month from the data
  const latestDataMonth = useMemo(() => {
    if (insights.length === 0) return "Nov";
    const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const uniqueMonths = [...new Set(insights.map(i => i.month))];
    return uniqueMonths.sort((a, b) => monthOrder.indexOf(b) - monthOrder.indexOf(a))[0];
  }, [insights]);

  // Unique performers for the table
  const topUniquePerformers = useMemo(() => {
    const grouped = filteredData.reduce((acc, item) => {
      const totalSearches = item.googleSearchMobile + item.googleSearchDesktop;
      if (!acc[item.businessName]) {
        acc[item.businessName] = { ...item, totalSearches };
      } else {
        // We accumulate total searches but keep the most recent metadata
        acc[item.businessName].totalSearches += totalSearches;
      }
      return acc;
    }, {} as Record<string, any>);

    return Object.values(grouped)
      .sort((a, b) => b.totalSearches - a.totalSearches)
      .slice(0, 10) as any[];
  }, [filteredData]);

  // Processed locations data with conditional logic
  const processedLocations = useMemo(() => {
    const isSpecialityFiltered = selectedSpeciality.length > 0;
    const isRatingFiltered = selectedRatings.length > 0;
    const targetMonth = selectedMonth.length > 0 ? selectedMonth[0] : (insights.some(m => m.month === "Nov") ? "Nov" : latestDataMonth);

    if (isSpecialityFiltered || isRatingFiltered) {
      // If rating or speciality are selected, show count of unique business names in target month
      const filteredInsights = insights.filter(i =>
        i.month === targetMonth &&
        (selectedCluster.length === 0 || selectedCluster.includes(i.cluster)) &&
        (selectedBranch.length === 0 || selectedBranch.includes(i.branch)) &&
        (selectedSpeciality.length === 0 || selectedSpeciality.includes(i.speciality)) &&
        (selectedDepartments.length === 0 || selectedDepartments.includes(i.department)) &&
        (selectedRatings.length === 0 || selectedRatings.some(r => Math.floor(i.rating) === r))
      );

      const branchGroups = filteredInsights.reduce((acc, i) => {
        if (!acc[i.branch]) acc[i.branch] = new Set();
        acc[i.branch].add(i.businessName);
        return acc;
      }, {} as Record<string, Set<string>>);

      return Object.entries(branchGroups).map(([branch, nameSet]) => {
        const count = nameSet.size;
        const firstDoc = filteredInsights.find(i => i.branch === branch);
        return {
          id: `dynamic-${branch}`,
          month: targetMonth,
          cluster: firstDoc?.cluster || "",
          unitName: branch,
          department: "Multiple",
          totalProfiles: count,
          verifiedProfiles: count,
          unverifiedProfiles: 0,
          needAccess: 0,
          notInterested: 0,
          outOfOrganization: 0
        };
      });
    }

    // Default: Return locations filtered by sidebar/header filters
    // If no month is selected, we default to Nov for locations as well
    const locationsTargetMonth = selectedMonth.length > 0 ? selectedMonth : ["Nov"];

    return locations.filter(loc => {
      const clusterMatch = selectedCluster.length === 0 || selectedCluster.includes(loc.cluster);
      const branchMatch = selectedBranch.length === 0 || selectedBranch.includes(loc.unitName);
      const monthMatch = locationsTargetMonth.includes(loc.month);
      const departmentMatch = selectedDepartments.length === 0 || selectedDepartments.includes(loc.department);
      return clusterMatch && branchMatch && monthMatch && departmentMatch;
    });
  }, [insights, locations, selectedCluster, selectedBranch, selectedSpeciality, selectedDepartments, selectedRatings, selectedMonth, latestDataMonth]);

  const metrics = getAggregatedMetrics(filteredData);

  const handleExport = () => {
    // 1. Insights Data Sheet
    let exportInsights = filteredData;
    if (selectedMonth.length === 0) {
      exportInsights = insights.filter(item => {
        const clusterMatch = selectedCluster.length === 0 || selectedCluster.includes(item.cluster);
        const branchMatch = selectedBranch.length === 0 || selectedBranch.includes(item.branch);
        const specialityMatch = selectedSpeciality.length === 0 || selectedSpeciality.includes(item.speciality);
        const departmentMatch = selectedDepartments.length === 0 || selectedDepartments.includes(item.department);
        const ratingMatch = selectedRatings.length === 0 || selectedRatings.some(r => Math.floor(item.rating) === r);
        return item.month === latestDataMonth && clusterMatch && branchMatch && specialityMatch && departmentMatch && ratingMatch;
      });
    }

    const insightsSheetData = exportInsights.map(item => ({
      "Business Name": item.businessName,
      "Month": item.month,
      "Cluster": item.cluster,
      "Branch": item.branch,
      "Speciality": item.speciality,
      "Rating": item.rating,
      "Reviews": item.review,
      "Search Mobile": item.googleSearchMobile,
      "Search Desktop": item.googleSearchDesktop,
      "Maps Mobile": item.googleMapsMobile,
      "Maps Desktop": item.googleMapsDesktop,
      "Directions": item.directions,
      "Website Clicks": item.websiteClicks,
      "Calls": item.calls,
      "Profile Type": item.department
    }));

    // 2. Profile counts Sheet
    const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const activeLatestMonth = (selectedMonth.length === 0)
      ? [...new Set(processedLocations.map(d => d.month))].sort((a, b) => monthOrder.indexOf(b) - monthOrder.indexOf(a))[0]
      : selectedMonth.sort((a, b) => monthOrder.indexOf(b) - monthOrder.indexOf(a))[0];

    const locationFiltered = processedLocations.filter(d => d.month === activeLatestMonth);

    const aggregatedLocationData = locationFiltered.reduce((acc, item) => {
      const unitName = item.unitName;
      const existing = acc.find(d => d.unitName === unitName);
      if (existing) {
        existing.totalProfiles += item.totalProfiles;
        existing.verifiedProfiles += item.verifiedProfiles;
        existing.unverifiedProfiles += item.unverifiedProfiles;
        existing.needAccess += item.needAccess;
        existing.notInterested += item.notInterested;
      } else {
        acc.push({
          unitName,
          cluster: item.cluster,
          totalProfiles: item.totalProfiles,
          verifiedProfiles: item.verifiedProfiles,
          unverifiedProfiles: item.unverifiedProfiles,
          needAccess: item.needAccess,
          notInterested: item.notInterested,
        });
      }
      return acc;
    }, [] as any[]);

    const profileCountsSheetData = aggregatedLocationData.map(item => ({
      "Unit Name": item.unitName,
      "Cluster": item.cluster,
      "Total Profiles": item.totalProfiles,
      "Verified": item.verifiedProfiles,
      "Unverified": item.unverifiedProfiles,
      "Need Access": item.needAccess,
      "Not Interested": item.notInterested,
      "Verification %": item.totalProfiles > 0 ? `${Math.round((item.verifiedProfiles / item.totalProfiles) * 100)}%` : "0%"
    }));

    // Generate Excel
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(insightsSheetData);
    const ws2 = XLSX.utils.json_to_sheet(profileCountsSheetData);
    XLSX.utils.book_append_sheet(wb, ws1, "Insights Data");
    XLSX.utils.book_append_sheet(wb, ws2, "Profile counts");
    XLSX.writeFile(wb, `Manipal_Insights_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (!mounted || loading) {
    return (
      <DashboardLayout
        title="Dashboard"
        subtitle="Google Business Profile Analytics Overview"
        selectedDepartments={selectedDepartments}
        onDepartmentsChange={setSelectedDepartments}
        selectedRatings={selectedRatings}
        onRatingsChange={setSelectedRatings}
      >
        <IndexSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Dashboard"
      subtitle="Google Business Profile Analytics Overview"
      selectedDepartments={selectedDepartments}
      onDepartmentsChange={(val) => startTransition(() => setSelectedDepartments(val))}
      selectedRatings={selectedRatings}
      onRatingsChange={(val) => startTransition(() => setSelectedRatings(val))}
    >
      <div className={cn("relative transition-all duration-300", isPending ? "opacity-60" : "opacity-100")}>
        {isPending && (
          <div className="absolute inset-x-0 -top-4 bottom-0 z-[60] flex items-start justify-center pt-32 bg-background/5 backdrop-blur-[1px] rounded-xl pointer-events-none">
            <div className="flex items-center gap-3 px-4 py-2 bg-background/80 border border-border shadow-lg rounded-full animate-in fade-in zoom-in duration-300">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm font-medium">Updating results...</span>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">Analytics Overview</h2>
            <p className="text-sm text-muted-foreground">Detailed metrics and performance trends</p>
          </div>
          <Button onClick={handleExport} className="gap-2 bg-primary hover:bg-primary/90">
            <Download className="h-4 w-4" />
            Export Data
          </Button>
        </div>

        <FilterBar
          selectedCluster={selectedCluster}
          selectedBranch={selectedBranch}
          selectedMonth={selectedMonth}
          selectedSpeciality={selectedSpeciality}
          clusterOptions={filterOptions.clusters}
          branchOptions={filterOptions.branches}
          monthOptions={filterOptions.months}
          specialityOptions={filterOptions.specialities}
          onClusterChange={(val) => startTransition(() => setSelectedCluster(val))}
          onBranchChange={(val) => startTransition(() => setSelectedBranch(val))}
          onMonthChange={(val) => startTransition(() => setSelectedMonth(val))}
          onSpecialityChange={(val) => startTransition(() => setSelectedSpeciality(val))}
        />

        {/* Metrics Grid - 2 rows of 4 cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <MetricCard title="Search Mobile" value={metrics.googleSearchMobile} change={12.5} icon={Smartphone} delay={0} />
          <MetricCard title="Search Desktop" value={metrics.googleSearchDesktop} change={8.3} icon={Monitor} delay={50} />
          <MetricCard title="Maps Mobile" value={metrics.googleMapsMobile} change={15.2} icon={Map} delay={100} />
          <MetricCard title="Maps Desktop" value={metrics.googleMapsDesktop} change={6.1} icon={MapPin} delay={150} />

          <MetricCard title="Phone Calls" value={metrics.totalCalls} change={5.8} icon={Phone} delay={200} />
          <MetricCard title="Directions" value={metrics.totalDirections} change={9.4} icon={Navigation} delay={250} />
          <MetricCard title="Website Clicks" value={metrics.totalWebsiteClicks} change={-2.4} icon={Globe} delay={300} />
          <MetricCard title="Total Searches" value={metrics.totalSearchImpressions} change={10.2} icon={Search} delay={350} />
        </div>

        <div className="mb-6">
          <PerformanceChart data={filteredData} />
        </div>

        <div className="mb-6">
          <LocationsOverview data={processedLocations} selectedMonths={selectedMonth.map(m => m.substring(0, 3))} />
        </div>

        {/* Performance Table - Full Width */}
        <div className="mb-6">
          <div className="space-y-6">
            <PerformanceTable data={topUniquePerformers} />
            {topUniquePerformers.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Showing Top 10 Unique Profiles by total searches across filtered results.
              </p>
            )}
          </div>
        </div>

        {/* Summary Row - 2 Columns */}
        <div className="grid gap-6 lg:grid-cols-2 mb-6">
          <TopPerformers data={insights.filter(i => i.month === latestDataMonth)} />
          <ReviewSummary totalReviews={reviewStats.totalReviews} averageRating={reviewStats.averageRating} />
        </div>
      </div>
    </DashboardLayout>
  );
};

const IndexSkeleton = () => {
  return (
    <div className="space-y-6">
      {/* Header & Export Skeleton */}
      <div className="flex items-center justify-between mb-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Filter Bar Skeleton */}
      <div className="flex flex-wrap gap-4 items-center p-4 bg-card rounded-xl border border-border mb-6">
        <Skeleton className="h-5 w-24" />
        <div className="flex flex-wrap gap-3 flex-1">
          <Skeleton className="h-10 w-[200px]" />
          <Skeleton className="h-10 w-[220px]" />
          <Skeleton className="h-10 w-[180px]" />
          <Skeleton className="h-10 w-[220px]" />
        </div>
      </div>

      {/* Metric Cards Skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>

      {/* Charts Skeleton */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[400px] w-full rounded-xl" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>

      {/* Table Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
