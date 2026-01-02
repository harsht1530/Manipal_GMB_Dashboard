import { useState, useMemo } from "react";
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
} from "lucide-react";

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
  const { insights, doctors, loading } = useMongoData();

  const [selectedCluster, setSelectedCluster] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string[]>([]); // Keep state but hide UI
  const [selectedSpeciality, setSelectedSpeciality] = useState<string[]>([]);

  // Derive filter options
  const filterOptions = useMemo(() => {
    const clusters = [...new Set(insights.map(i => i.cluster))].filter(Boolean).sort();
    const branches = [...new Set(insights.map(i => i.branch))].filter(Boolean).sort();
    const specialities = [...new Set(insights.map(i => i.speciality))].filter(Boolean).sort();
    const months = []; // Not used in UI
    return { clusters, branches, specialities, months };
  }, [insights]);

  const branchStats: BranchStats[] = useMemo(() => {
    // 1. Filter Source Data
    const filteredInsights = insights.filter(item => {
      const clusterMatch = selectedCluster.length === 0 || selectedCluster.includes(item.cluster);
      const branchMatch = selectedBranch.length === 0 || selectedBranch.includes(item.branch);
      const specialityMatch = selectedSpeciality.length === 0 || selectedSpeciality.includes(item.speciality);
      return clusterMatch && branchMatch && specialityMatch;
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

    // Aggregate insights data
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

      // Track unique profiles (Business Names)
      if (insight.businessName) {
        existing.uniqueProfiles.add(insight.businessName);
      }

      // Track Ratings
      if (insight.rating > 0) {
        existing.ratingSum += insight.rating;
        existing.ratingCount += 1;
      }
    });

    // Add keyword data from doctors AND ensure all branches exist
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
        profileCount: stats.uniqueProfiles.size, // Use Set size for profile count
        averageRating: avgRating
      };
    }).sort((a, b) => b.totalSearchImpressions - a.totalSearchImpressions);

  }, [insights, doctors, selectedCluster, selectedBranch, selectedSpeciality]);

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
      <DashboardLayout title="Branches" subtitle="Loading branch analytics...">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Loading data...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Branches" subtitle="Branch-wise performance analytics">

      <FilterBar
        selectedCluster={selectedCluster}
        selectedBranch={selectedBranch}
        selectedMonth={selectedMonth}
        selectedSpeciality={selectedSpeciality}
        clusterOptions={filterOptions.clusters}
        branchOptions={filterOptions.branches}
        monthOptions={[]}
        specialityOptions={filterOptions.specialities}
        onClusterChange={setSelectedCluster}
        onBranchChange={setSelectedBranch}
        onMonthChange={setSelectedMonth}
        onSpecialityChange={setSelectedSpeciality}
        hideMonth={true}
      />

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
                <p className="text-xs text-muted-foreground">Total Branches</p>
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
                <p className="text-2xl font-bold">{totalStats.profiles}</p>
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
                <span className="font-semibold">{branch.profileCount}</span>
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
