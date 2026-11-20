import React, { useState, useMemo, useEffect, useTransition, useDeferredValue } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useRealtimeFeed, matchesScope, FeedDoctor, FeedInsight } from "@/hooks/useRealtimeFeed";
import { useRealtimeMeta } from "@/hooks/useRealtimeData";
import { DoctorAggregatedStats } from "@/components/dashboard/DoctorAggregatedStats";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  Check,
  ChevronsUpDown,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { useAuth } from "@/contexts/AuthContext";

const Doctors = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  // Same filters as the Realtime page: cluster (from the allocation sheet) is the parent of folder.
  const [cluster, setCluster] = useState("ALL");
  const [folder, setFolder] = useState("ALL");
  // Google verification status (Verified, Unverified, Duplicate, ...); "ALL" = every status.
  const [status, setStatus] = useState("ALL");
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedRatings, setSelectedRatings] = useState<number[]>([]);
  const [comboOpen, setComboOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);

  const { doctors, insights, loading } = useRealtimeFeed();
  const meta = useRealtimeMeta();
  const unitClusters = meta.data?.unitClusters ?? {};
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const deferredSearchQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    // Small delay to ensure the route transition is visible and responsive
    const timer = setTimeout(() => {
      setMounted(true);
    }, 10);
    return () => clearTimeout(timer);
  }, []);

  // No preselection from the login: the realtime data arrives already limited to the user's
  // cluster or branch folders (plus Others), and the login's Branch is a unit name ("Broadway")
  // while the data's unit is a folder ("MH - Broadway"), so preselecting it filtered everything away.

  useEffect(() => {
    setVisibleCount(20);
  }, [searchQuery, cluster, folder, status, selectedDepartments, selectedRatings]);


  const dashboardTitle = user?.role === "Admin" ? "Profiles" : (user?.branch || user?.cluster || "Profiles");
  const dashboardSubtitle = user?.role === "Admin" ? "Manage profiles and rankings" : `${user?.branch ? 'Branch' : 'Cluster'} Level Access - Profiles`;

  // Cluster is the parent filter: only the folders the allocation sheet puts in it are offered.
  const folderOptions = useMemo(() => {
    const units = meta.data?.units ?? [];
    if (cluster === "ALL") return units;
    return units.filter((unit) => (unitClusters[unit] ?? []).includes(cluster));
  }, [meta.data, cluster, unitClusters]);

  // The most recent month in the Google data (the current month, to date).
  const latestYm = useMemo(() => {
    let latest = "";
    for (const i of insights) if (i.ym > latest) latest = i.ym;
    return latest;
  }, [insights]);

  // Each listing's latest month, keyed by Google location id (titles are not unique).
  const latestMonthDataMap = useMemo(() => {
    if (!mounted || loading) return {} as Record<string, FeedInsight>;
    const map: Record<string, FeedInsight> = {};
    for (const insight of insights) {
      if (insight.ym === latestYm) map[insight.locationId] = insight;
    }
    return map;
  }, [insights, latestYm, mounted, loading]);

  // Listings inside the chosen cluster / folder, profile type and rating, before the name search.
  const scopedDoctors = useMemo(() => {
    if (!mounted || loading) return [] as FeedDoctor[];
    return doctors.filter((doctor) => {
      if (!matchesScope(doctor, cluster, folder, unitClusters)) return false;
      if (status !== "ALL" && doctor.statusType !== status) return false;
      const departmentMatch = selectedDepartments.length === 0 || selectedDepartments.includes(doctor.department);
      const ratingMatch = selectedRatings.length === 0 || selectedRatings.some(r => Math.floor(doctor.averageRating) === r);
      return departmentMatch && ratingMatch;
    });
  }, [doctors, cluster, folder, status, unitClusters, selectedDepartments, selectedRatings, mounted, loading]);

  // The statuses present in the listings this user can see, most common first.
  const statusOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of doctors) if (d.statusType) counts.set(d.statusType, (counts.get(d.statusType) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  }, [doctors]);

  // Names for the search dropdown, from the listings in scope.
  const validSearchProfiles = useMemo(() => {
    const seen = new Set<string>();
    return scopedDoctors
      .filter((d) => {
        if (!d.businessName || seen.has(d.businessName)) return false;
        seen.add(d.businessName);
        return true;
      })
      .map((d) => ({ id: d.locationId, name: d.businessName, businessName: d.unitName }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [scopedDoctors]);

  const getRankingScore = (doctor: FeedDoctor) => {
    // Score based on number of keywords in Top 10
    return doctor.labels.filter(l => l.rank > 0 && l.rank <= 10).length;
  };

  const filteredDoctors = useMemo(() => {
    const lowerSearch = deferredSearchQuery.toLowerCase();
    return scopedDoctors
      .filter((doctor) =>
        deferredSearchQuery === "" ||
        doctor.businessName.toLowerCase().includes(lowerSearch) ||
        doctor.primaryCategory.toLowerCase().includes(lowerSearch) ||
        doctor.branch.toLowerCase().includes(lowerSearch)
      )
      .sort((a, b) => {
        const scoreA = getRankingScore(a);
        const scoreB = getRankingScore(b);
        if (scoreA !== scoreB) return scoreB - scoreA;
        return b.averageRating - a.averageRating;
      });
  }, [scopedDoctors, deferredSearchQuery]);

  const displayedDoctors = useMemo(() => {
    return filteredDoctors.slice(0, visibleCount);
  }, [filteredDoctors, visibleCount]);

  if (!mounted || loading) {
    return (
      <DashboardLayout
        title={dashboardTitle}
        subtitle={dashboardSubtitle}
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
      title={dashboardTitle}
      subtitle={dashboardSubtitle}
      selectedDepartments={selectedDepartments}
      onDepartmentsChange={(val) => startTransition(() => setSelectedDepartments(val))}
      selectedRatings={selectedRatings}
      onRatingsChange={(val) => startTransition(() => setSelectedRatings(val))}
    >
      <div className="flex flex-col sm:flex-row items-end sm:items-center justify-between gap-4 mb-6">
        {/* Search Bar / Profile Selector */}
        <div className="relative flex flex-row gap-2 items-center w-full max-w-md">
          <div className="flex-1">
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5 ml-1">
              <Search className="h-3 w-3" />
              Search Profiles
            </label>
            <Popover open={comboOpen} onOpenChange={setComboOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={comboOpen}
                  className="w-full justify-between text-left font-normal border-primary/20 focus:border-primary bg-background h-10"
                >
                  <span className="truncate">
                    {searchQuery ? searchQuery : "Search profiles by name..."}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="p-0 w-[--radix-popover-trigger-width] min-w-[300px]"
                align="start"
              >
                <Command className="w-full">
                  <CommandInput placeholder="Type name to search..." className="h-9" />
                  <CommandList className="max-h-[300px]">
                    <CommandEmpty>No profile found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="all"
                        onSelect={() => {
                          startTransition(() => {
                            setSearchQuery("");
                          });
                          setComboOpen(false);
                        }}
                        className="cursor-pointer text-primary font-medium"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            searchQuery === "" ? "opacity-100" : "opacity-0"
                          )}
                        />
                        All Profiles
                      </CommandItem>
                      {validSearchProfiles.map((profile) => (
                        <CommandItem
                          key={profile.id}
                          value={profile.name}
                          onSelect={() => {
                            startTransition(() => {
                              setSearchQuery(profile.name === searchQuery ? "" : profile.name);
                            });
                            setComboOpen(false);
                          }}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              searchQuery === profile.name ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{profile.name}</span>
                            {profile.name !== profile.businessName && (
                              <span className="text-[10px] text-muted-foreground truncate">{profile.businessName}</span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery("")}
              className="text-xs text-muted-foreground hover:text-primary mt-6"
            >
              Clear
            </Button>
          )}
        </div>

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
        <div className="bg-card p-4 rounded-xl border border-border shadow-sm mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex flex-wrap items-center gap-2">
            {(meta.data?.clusters ?? []).length > 1 && (
              <Select
                value={cluster}
                onValueChange={(value) =>
                  startTransition(() => {
                    setCluster(value);
                    // A folder chosen under the previous cluster would filter everything away.
                    setFolder("ALL");
                  })
                }
              >
                <SelectTrigger className="h-9 w-[200px] shrink-0 bg-muted/20 border-primary/5 text-xs font-medium">
                  <SelectValue placeholder="Cluster" />
                </SelectTrigger>
                <SelectContent className="max-h-[320px]">
                  <SelectItem value="ALL">All clusters</SelectItem>
                  {(meta.data?.clusters ?? []).map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {(
              <Select value={folder} onValueChange={(value) => startTransition(() => setFolder(value))}>
                <SelectTrigger className="h-9 w-[220px] shrink-0 bg-muted/20 border-primary/5 text-xs font-medium">
                  <SelectValue placeholder="Folder" />
                </SelectTrigger>
                <SelectContent className="max-h-[320px]">
                  <SelectItem value="ALL">{cluster === "ALL" ? "All folders" : `All folders in ${cluster}`}</SelectItem>
                  {folderOptions.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={status} onValueChange={(value) => startTransition(() => setStatus(value))}>
              <SelectTrigger className="h-9 w-[200px] shrink-0 bg-muted/20 border-primary/5 text-xs font-medium">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="max-h-[320px]">
                <SelectItem value="ALL">All statuses</SelectItem>
                {statusOptions.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Doctors Grid */}
      <div className={cn("relative transition-all duration-300", (isPending || deferredSearchQuery !== searchQuery) ? "opacity-60" : "opacity-100")}>
        {(isPending || deferredSearchQuery !== searchQuery) && (
          <div className="absolute inset-x-0 -top-4 bottom-0 z-[60] flex items-start justify-center pt-32 bg-background/5 backdrop-blur-[1px] rounded-xl pointer-events-none">
            <div className="flex items-center gap-3 px-4 py-2 bg-background/80 border border-border shadow-lg rounded-full animate-in fade-in zoom-in duration-300">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm font-medium">Updating results...</span>
            </div>
          </div>
        )}
        <div className="grid gap-6 md:grid-cols-2">
          {displayedDoctors.map((doctor, index) => {
            const latestData = latestMonthDataMap[doctor.locationId] ?? null;
            return (
              <DoctorCard
                key={doctor.id}
                doctor={doctor}
                index={index}
                insights={insights}
                latestData={latestData}
                onViewDetails={() => navigate(`/doctor-details/${encodeURIComponent(doctor.locationId)}`)}
                rankingScore={getRankingScore(doctor)}
              />
            );
          })}
        </div>

        {filteredDoctors.length > visibleCount && (
          <div className="flex justify-center mt-8 mb-12">
            <Button
              onClick={() => setVisibleCount((prev) => prev + 20)}
              className="px-6 py-2 shadow-md hover:shadow-lg transition-all"
            >
              Load More Profiles
            </Button>
          </div>
        )}

        {filteredDoctors.length === 0 && (
          <div className="text-center py-24 text-muted-foreground animate-fade-in">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg">No profiles found matching your search or filters.</p>
            <Button
              variant="link"
              onClick={() => {
                setSearchQuery("");
                setCluster("ALL");
                setFolder("ALL");
                setStatus("ALL");
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

/** Google's verification status, coloured the way the Realtime tiles colour it. */
const statusBadgeClass = (status: string) => {
  switch (status) {
    case "Verified":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Unverified":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "Duplicate":
      return "bg-violet-50 text-violet-700 border-violet-200";
    case "Suspended":
      return "bg-red-50 text-red-700 border-red-200";
    case "Pending Verification":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "Ownership Conflict":
      return "bg-orange-50 text-orange-700 border-orange-200";
    default:
      return "bg-muted text-muted-foreground";
  }
};

interface DoctorCardProps {
  doctor: FeedDoctor;
  index: number;
  insights: FeedInsight[];
  latestData: FeedInsight | null;
  onViewDetails: () => void;
  rankingScore: number;
}

const DoctorCard = React.memo(({ doctor, index, insights, latestData, onViewDetails, rankingScore }: DoctorCardProps) => {
  const [showStats, setShowStats] = useState(false);
  // This listing's months only, by location id, so listings that share a title stay apart.
  const ownInsights = useMemo(
    () => (showStats ? insights.filter((i) => i.locationId === doctor.locationId) : []),
    [showStats, insights, doctor.locationId]
  );
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
            <CardTitle className="text-lg leading-tight font-bold">{doctor.businessName}</CardTitle>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant="secondary" className="bg-primary/10 text-primary border-none">
                {doctor.primaryCategory}
              </Badge>
              <Badge variant="outline" className="text-muted-foreground font-normal">
                {doctor.branch}
              </Badge>
              {doctor.statusType && (
                <Badge variant="outline" className={cn("font-medium", statusBadgeClass(doctor.statusType))}>
                  {doctor.statusType}
                </Badge>
              )}
              {doctor.outOfOrganization && (
                <Badge variant="outline" className="font-medium bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-100">
                  Out of Organization
                </Badge>
              )}
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

        {/* Aggregated Stats View */}
        {showStats && (
          <div className="pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-bold text-primary flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Aggregated Lifetime Performance
              </h4>
            </div>
            <DoctorAggregatedStats data={ownInsights} doctorName={doctor.businessName} />
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
            onClick={() => setShowStats(!showStats)}
          >
            <BarChart3 className="h-4 w-4 mr-1" />
            {showStats ? "Hide Stats" : "Show Counts"}
          </Button>
          <Button variant="default" size="sm" onClick={onViewDetails}>
            <BarChart3 className="h-4 w-4 mr-1" />
            View Detail Report
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

DoctorCard.displayName = "DoctorCard";

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
