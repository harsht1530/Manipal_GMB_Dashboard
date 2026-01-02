import { useState, useMemo, useEffect, useTransition } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useMongoData, DoctorData, InsightData } from "@/hooks/useMongoData";
import { DoctorPerformanceCharts } from "@/components/dashboard/DoctorPerformanceCharts";
import { FilterBar } from "@/components/dashboard/FilterBar";
import {
  Star,
  MapPin,
  Phone,
  Mail,
  Globe,
  Search,
  MessageSquare,
  Target,
  BarChart3,
  Trophy,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const Doctors = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCluster, setSelectedCluster] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string[]>([]);
  const [selectedSpeciality, setSelectedSpeciality] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedRatings, setSelectedRatings] = useState<number[]>([]);

  const { doctors, insights, loading } = useMongoData();
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    // Small delay to ensure the route transition is visible and responsive
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
    const clusterData = selectedDepartments.length > 0
      ? insights.filter(i => selectedDepartments.includes(i.department))
      : insights;
    const clusters = [...new Set(clusterData.map(i => i.cluster))].filter(Boolean).sort();

    const branchData = insights.filter(i => {
      const clusterMatch = selectedCluster.length === 0 || selectedCluster.includes(i.cluster);
      const departmentMatch = selectedDepartments.length === 0 || selectedDepartments.includes(i.department);
      return clusterMatch && departmentMatch;
    });
    const branches = [...new Set(branchData.map(i => i.branch))].filter(Boolean).sort();

    const months = [...new Set(insights.map(i => i.month))].filter(Boolean);
    const specialities = [...new Set(insights.map(i => i.speciality))].filter(Boolean).sort();

    const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    months.sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));

    return { clusters, branches, months, specialities };
  }, [insights, selectedDepartments, selectedCluster, mounted, loading]);

  // Pre-calculate latest month data for all doctors for $O(1)$ lookup in filters
  const latestMonthDataMap = useMemo(() => {
    if (!mounted || loading) return {};
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const map: Record<string, InsightData> = {};

    // Sort all insights once by date (month order)
    const sortedInsights = [...insights].sort((a, b) => {
      return months.indexOf(b.month) - months.indexOf(a.month);
    });

    // Take the first occurrence (latest month) for each business name (normalized)
    for (const insight of sortedInsights) {
      const key = (insight.businessName || "").trim().toLowerCase();
      if (key && !map[key]) {
        map[key] = insight;
      }
    }
    return map;
  }, [insights, mounted, loading]);

  const getRankingScore = (doctor: DoctorData) => {
    // Score based on number of keywords in Top 10
    return doctor.labels.filter(l => l.rank > 0 && l.rank <= 10).length;
  };

  const filteredDoctors = useMemo(() => {
    if (!mounted || loading || insights.length === 0) return [];
    // 1. Get unique business names from insights for strict vlookup (vlookup is now case-insensitive and trimmed)
    const validBusinessNames = new Set(insights.map(i => (i.businessName || "").trim().toLowerCase()).filter(Boolean));

    return doctors
      .filter((doctor) => {
        const docBusinessName = (doctor.businessName || "").trim().toLowerCase();
        // vlookup: Only show profiles whose business_name matches "Business name" in insights
        if (!docBusinessName || !validBusinessNames.has(docBusinessName)) return false;

        // Search Filter
        const matchesSearch = searchQuery === "" ||
          doctor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          doctor.primaryCategory.toLowerCase().includes(searchQuery.toLowerCase()) ||
          doctor.branch.toLowerCase().includes(searchQuery.toLowerCase());

        // Cluster & Branch Filters
        const clusterMatch = selectedCluster.length === 0 || selectedCluster.includes(doctor.cluster);
        const branchMatch = selectedBranch.length === 0 || selectedBranch.includes(doctor.branch);

        // Latest Insight Data for Department & Rating filtering
        const latestData = latestMonthDataMap[(doctor.businessName || "").trim().toLowerCase()];
        if (!latestData) return false;

        // Profile Type (Department) Filter
        const departmentMatch = selectedDepartments.length === 0 || selectedDepartments.includes(latestData.department);

        // Speciality Filter
        const specialityMatch = selectedSpeciality.length === 0 || selectedSpeciality.includes(latestData.speciality);

        // Rating Filter (Applying to the overall doctor rating for profile matching)
        const ratingMatch = selectedRatings.length === 0 || selectedRatings.some(r => doctor.averageRating >= r);

        return matchesSearch && clusterMatch && branchMatch && departmentMatch && ratingMatch && specialityMatch;
      })
      .sort((a, b) => {
        const scoreA = getRankingScore(a);
        const scoreB = getRankingScore(b);
        if (scoreA !== scoreB) return scoreB - scoreA;
        return b.averageRating - a.averageRating;
      });
  }, [doctors, insights, searchQuery, selectedCluster, selectedBranch, selectedDepartments, selectedRatings, selectedSpeciality, latestMonthDataMap, mounted, loading]);

  if (!mounted || loading) {
    return (
      <DashboardLayout
        title="Doctors"
        subtitle="Manage doctor profiles and rankings"
        selectedDepartments={selectedDepartments}
        onDepartmentsChange={(val) => startTransition(() => setSelectedDepartments(val))}
        selectedRatings={selectedRatings}
        onRatingsChange={(val) => startTransition(() => setSelectedRatings(val))}
      >
        <DoctorsSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Doctors"
      subtitle="Manage doctor profiles and rankings"
      selectedDepartments={selectedDepartments}
      onDepartmentsChange={(val) => startTransition(() => setSelectedDepartments(val))}
      selectedRatings={selectedRatings}
      onRatingsChange={(val) => startTransition(() => setSelectedRatings(val))}
    >
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

      {/* Search Bar */}
      <div className="relative mb-6 animate-fade-in">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search doctors by name, speciality, or branch..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 max-w-md border-primary/20 focus:border-primary"
        />
      </div>

      {/* Doctors Grid */}
      <div className={cn("relative transition-all duration-300", isPending ? "opacity-60" : "opacity-100")}>
        {isPending && (
          <div className="absolute inset-x-0 -top-4 bottom-0 z-[60] flex items-start justify-center pt-32 bg-background/5 backdrop-blur-[1px] rounded-xl pointer-events-none">
            <div className="flex items-center gap-3 px-4 py-2 bg-background/80 border border-border shadow-lg rounded-full animate-in fade-in zoom-in duration-300">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm font-medium">Updating results...</span>
            </div>
          </div>
        )}
        <div className="grid gap-6 md:grid-cols-2">
          {filteredDoctors.map((doctor, index) => {
            const latestData = latestMonthDataMap[doctor.businessName];
            return (
              <DoctorCard
                key={doctor.id}
                doctor={doctor}
                index={index}
                insights={insights}
                latestData={latestData}
                onViewDetails={() => navigate(`/doctor-details/${encodeURIComponent(doctor.businessName)}`)}
                rankingScore={getRankingScore(doctor)}
              />
            );
          })}
        </div>

        {filteredDoctors.length === 0 && (
          <div className="text-center py-24 text-muted-foreground animate-fade-in">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg">No doctors found matching your search or filters.</p>
            <Button
              variant="link"
              onClick={() => {
                setSearchQuery("");
                setSelectedCluster([]);
                setSelectedBranch([]);
              }}
            >
              Clear all filters
            </Button>
          </div>
        )}

        {/* Doctor Detail Modal removed in favor of dedicated page */}
      </div>
    </DashboardLayout>
  );
};

interface DoctorCardProps {
  doctor: DoctorData;
  index: number;
  insights: InsightData[];
  latestData: InsightData | null;
  onViewDetails: () => void;
  rankingScore: number;
}

const DoctorCard = ({ doctor, index, insights, latestData, onViewDetails, rankingScore }: DoctorCardProps) => {
  const [showCharts, setShowCharts] = useState(false);
  const rankedLabels = doctor.labels.filter((l) => l.rank > 0 && l.rank <= 10);
  const topRank = rankedLabels.length > 0 ? Math.min(...rankedLabels.map((l) => l.rank)) : null;
  const totalSearch = latestData
    ? latestData.googleSearchMobile + latestData.googleSearchDesktop
    : 0;

  return (
    <Card
      className="overflow-hidden animate-slide-up hover:shadow-lg transition-all duration-300 border-primary/10"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <CardHeader className="pb-4 bg-muted/5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="text-lg leading-tight font-bold">{doctor.name}</CardTitle>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant="secondary" className="bg-primary/10 text-primary border-none">
                {doctor.primaryCategory}
              </Badge>
              <Badge variant="outline" className="text-muted-foreground font-normal">
                {doctor.branch}
              </Badge>
              {rankingScore > 0 && (
                <Badge className="bg-amber-100 text-amber-900 border-amber-200 hover:bg-amber-100">
                  <Trophy className="h-3 w-3 mr-1 text-amber-600" />
                  {rankingScore} Top Rankings
                </Badge>
              )}
              {topRank && (
                <Badge className="bg-emerald-100 text-emerald-900 border-emerald-200">
                  Top #{topRank}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-1 bg-accent rounded-lg px-3 py-1.5">
              <Star className="h-4 w-4 fill-warning text-warning" />
              <span className="font-semibold">{doctor.averageRating.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">
                ({doctor.totalReviewCount})
              </span>
            </div>
            {totalSearch > 0 && (
              <div className="text-xs text-muted-foreground">
                {totalSearch.toLocaleString()} searches/mo
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Contact Info */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">{doctor.address}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-4 w-4 shrink-0" />
            <span>{doctor.phone}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4 shrink-0" />
            <span>{doctor.mailId}</span>
          </div>
        </div>

        {/* Keywords Summary */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Target className="h-4 w-4 text-primary" />
            <span>Tracked Keywords ({doctor.labels.length})</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {doctor.labels.slice(0, 3).map((label, idx) => (
              <Badge
                key={idx}
                variant={label.rank > 0 && label.rank <= 3 ? "default" : "outline"}
                className="text-xs"
              >
                {label.rank > 0 ? `#${label.rank}` : "—"} {label.label.slice(0, 25)}...
              </Badge>
            ))}
            {doctor.labels.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{doctor.labels.length - 3} more
              </Badge>
            )}
          </div>
        </div>

        {/* Performance Charts Toggle */}
        {showCharts && (
          <div className="pt-2">
            <DoctorPerformanceCharts data={insights} doctorName={doctor.businessName} />
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant="outline" size="sm" asChild>
            <a href={doctor.mapsUri} target="_blank" rel="noopener noreferrer">
              <MapPin className="h-4 w-4 mr-1" />
              Maps
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={doctor.websiteUrl} target="_blank" rel="noopener noreferrer">
              <Globe className="h-4 w-4 mr-1" />
              Website
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={doctor.newReviewUri} target="_blank" rel="noopener noreferrer">
              <MessageSquare className="h-4 w-4 mr-1" />
              Review
            </a>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowCharts(!showCharts)}
          >
            <BarChart3 className="h-4 w-4 mr-1" />
            {showCharts ? "Hide Charts" : "Show Charts"}
          </Button>
          <Button variant="default" size="sm" onClick={onViewDetails}>
            <BarChart3 className="h-4 w-4 mr-1" />
            View Detail Report
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const DoctorsSkeleton = () => {
  return (
    <div className="space-y-6">
      {/* Filter Bar Skeleton */}
      <div className="flex flex-wrap gap-4 items-center p-4 bg-card rounded-xl border border-border mb-6">
        <Skeleton className="h-5 w-24" />
        <div className="flex flex-wrap gap-3 flex-1">
          <Skeleton className="h-10 w-full sm:w-[200px]" />
          <Skeleton className="h-10 w-full sm:w-[220px]" />
          <Skeleton className="h-10 w-full sm:w-[180px]" />
          <Skeleton className="h-10 w-full sm:w-[220px]" />
        </div>
      </div>

      {/* Search Bar Skeleton */}
      <Skeleton className="h-10 max-w-md w-full mb-6" />

      {/* Grid Skeleton */}
      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="overflow-hidden border-primary/10">
            <CardHeader className="pb-4 bg-muted/5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-6 w-3/4" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                </div>
                <Skeleton className="h-12 w-20 rounded-lg" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-5 w-1/3" />
                <div className="flex gap-2">
                  <Skeleton className="h-7 w-20 rounded-full" />
                  <Skeleton className="h-7 w-20 rounded-full" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-32" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Doctors;
