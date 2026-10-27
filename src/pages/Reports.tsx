import React, { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { MultiSelect } from "@/components/ui/multi-select";
import { useReportingData, formatReportDateLabel } from "@/hooks/useReportingData";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  FileSpreadsheet,
  FileText,
  Download,
  Search,
  RefreshCw,
  Building2,
  Users,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ExternalLink,
  Filter,
  Layers,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  KeyRound,
  Info,
  Calendar,
  ChevronDown,
} from "lucide-react";

// Color helper for GMB Verification Status
const getStatusBadgeStyle = (status: string) => {
  const s = status?.toLowerCase().trim() || "";
  if (s === "verified") {
    return {
      label: "Verified",
      className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-medium",
      icon: CheckCircle2,
      progressColor: "bg-emerald-500",
    };
  }
  if (s === "need to verify") {
    return {
      label: "Need to verify",
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 font-medium",
      icon: AlertTriangle,
      progressColor: "bg-amber-500",
    };
  }
  if (s === "out of organization") {
    return {
      label: "Out of Organization",
      className: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30 font-medium",
      icon: Info,
      progressColor: "bg-slate-500",
    };
  }
  if (s === "need access") {
    return {
      label: "Need Access",
      className: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30 font-medium",
      icon: KeyRound,
      progressColor: "bg-indigo-500",
    };
  }
  if (s === "suspended") {
    return {
      label: "Suspended",
      className: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 font-medium",
      icon: XCircle,
      progressColor: "bg-rose-500",
    };
  }
  if (s === "not interested") {
    return {
      label: "Not Interested",
      className: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30 font-medium",
      icon: Clock,
      progressColor: "bg-purple-500",
    };
  }
  return {
    label: status || "Unknown",
    className: "bg-muted text-muted-foreground border-border font-medium",
    icon: Info,
    progressColor: "bg-muted-foreground",
  };
};

const getProfileTypeBadge = (type: string) => {
  const t = type?.toLowerCase().trim() || "";
  if (t === "doctor" || t === "doctors") {
    return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20";
  }
  if (t === "hospital") {
    return "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20";
  }
  if (t === "department") {
    return "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20";
  }
  if (t === "mars") {
    return "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20";
  }
  if (t === "clinic") {
    return "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20";
  }
  return "bg-muted text-muted-foreground border-border";
};

const Reports = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [showFilters, setShowFilters] = useState<boolean>(true);
  const [unitSearch, setUnitSearch] = useState<string>("");
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);

  // Wire sidebar's Profile Type filter (selectedDepartments) directly to useReportingData
  const {
    selectedDates,
    setSelectedDates,
    selectedClusters,
    setSelectedClusters,
    selectedUnits,
    setSelectedUnits,
    selectedStatuses,
    setSelectedStatuses,
    searchQuery,
    setSearchQuery,
    handleResetFilters: resetInternalFilters,

    filterOptions,
    availableUnits,

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

    stats,
    records,

    loadingStats,
    loadingRecords,
    isExporting,
    refreshData,
    exportData,
  } = useReportingData(selectedDepartments);

  const isBranchRestricted = !!user?.branch;
  const isClusterRestricted = !!user?.cluster && !user?.branch;

  const handleExportClick = async (mode: "filtered" | "all", format: "xlsx" | "csv") => {
    try {
      const modeLabel = mode === "filtered" ? "filtered" : "all historical";
      toast.info(`Preparing ${modeLabel} ${format.toUpperCase()} export...`);
      const res = await exportData(mode, format);
      toast.success(`Successfully exported ${res.count} profiles to ${format.toUpperCase()}`);
    } catch (err: any) {
      toast.error(`Export failed: ${err.message || "Unknown error"}`);
    }
  };

  const handleResetFilters = () => {
    resetInternalFilters();
    setSelectedDepartments([]);
  };

  const hasActiveFilters =
    selectedClusters.length > 0 ||
    selectedUnits.length > 0 ||
    selectedStatuses.length > 0 ||
    selectedDepartments.length > 0 ||
    searchQuery.trim().length > 0;

  // Filter unit breakdown for Tab 2
  const filteredUnits = (stats?.unitBreakdown || []).filter((u) => {
    if (!unitSearch.trim()) return true;
    const q = unitSearch.toLowerCase();
    return u.unit.toLowerCase().includes(q) || u.cluster.toLowerCase().includes(q);
  });

  return (
    <DashboardLayout
      title="Reports"
      subtitle="Historical profile status and verification analytics"
      selectedDepartments={selectedDepartments}
      onDepartmentsChange={setSelectedDepartments}
    >
      <div className="space-y-6 animate-fade-in pb-10">
        {/* Top Header Bar matching Dashboard */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">Historical Profile Reports</h2>
            <p className="text-sm text-muted-foreground">Historical profile status and verification analytics</p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshData}
              disabled={loadingStats || loadingRecords}
              className="gap-2"
            >
              <RefreshCw className={cn("h-4 w-4", (loadingStats || loadingRecords) && "animate-spin text-primary")} />
              <span>Refresh</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              {showFilters ? "Hide Filters" : "Show Filters"}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
                  <Download className="h-4 w-4" />
                  <span>Export Data</span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Export Filtered ({stats?.total || 0} rows)</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => handleExportClick("filtered", "xlsx")}
                  disabled={isExporting}
                  className="gap-2 cursor-pointer"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  <span>Download Excel (.xlsx)</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleExportClick("filtered", "csv")}
                  disabled={isExporting}
                  className="gap-2 cursor-pointer"
                >
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span>Download CSV (.csv)</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuLabel>Master Archive</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => handleExportClick("all", "xlsx")}
                  disabled={isExporting}
                  className="gap-2 cursor-pointer"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  <span>All Profiles (.xlsx)</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleExportClick("all", "csv")}
                  disabled={isExporting}
                  className="gap-2 cursor-pointer"
                >
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span>All Profiles (.csv)</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* FilterBar arranged and styled like Dashboard */}
        {showFilters && (
          <div className="flex flex-wrap gap-4 items-center p-4 bg-card rounded-xl border border-border mb-6 animate-fade-in shadow-sm">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mr-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="font-medium">Filters:</span>
            </div>

            <div className="flex flex-wrap gap-3 flex-1">
              {/* Cluster Filter */}
              <div className="w-full sm:w-[200px]">
                <MultiSelect
                  placeholder="Select Cluster"
                  options={filterOptions.clusters}
                  selected={selectedClusters}
                  onChange={isClusterRestricted ? () => {} : setSelectedClusters}
                  className={cn("w-full text-xs", isClusterRestricted && "opacity-80 pointer-events-none")}
                />
              </div>

              {/* Branch / Unit Filter */}
              <div className="w-full sm:w-[220px]">
                <MultiSelect
                  placeholder="Select Branch"
                  options={availableUnits}
                  selected={selectedUnits}
                  onChange={isBranchRestricted ? () => {} : setSelectedUnits}
                  className={cn("w-full text-xs", isBranchRestricted && "opacity-80 pointer-events-none")}
                />
              </div>

              {/* Snapshot Date Filter */}
              <div className="w-full sm:w-[220px]">
                <MultiSelect
                  placeholder="Select Date"
                  options={filterOptions.dates.map((d) => ({
                    label: formatReportDateLabel(d, d === filterOptions.latestDate),
                    value: d,
                  }))}
                  selected={selectedDates}
                  onChange={setSelectedDates}
                  className="w-full text-xs"
                />
              </div>

              {/* GMB Verification Status Filter */}
              <div className="w-full sm:w-[200px]">
                <MultiSelect
                  placeholder="Select Status"
                  options={filterOptions.statuses}
                  selected={selectedStatuses}
                  onChange={setSelectedStatuses}
                  className="w-full text-xs"
                />
              </div>
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                Reset
              </Button>
            )}
          </div>
        )}

        {/* Metric Cards styled with increment/decrement like Dashboard */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6 mb-6">
          {/* Total Profiles */}
          <MetricCard
            title="Total Profiles"
            value={stats?.total || 0}
            change={stats?.changes?.total}
            customChangeLabel={stats?.previousDate ? "vs prev month" : undefined}
            subtitle={!stats?.previousDate ? (stats?.currentDate ? "Baseline snapshot" : "Historical records") : undefined}
            icon={Users}
            iconColor="text-primary"
            compact={true}
            loading={loadingStats}
            delay={0}
          />

          {/* Verified */}
          <MetricCard
            title="Verified"
            value={stats?.verifiedCount || 0}
            change={stats?.changes?.verified}
            customChangeLabel={stats?.previousDate ? "vs prev month" : undefined}
            subtitle={!stats?.previousDate ? `${stats?.verifiedRate || 0}% rate` : undefined}
            icon={CheckCircle2}
            iconColor="text-emerald-600 dark:text-emerald-400"
            compact={true}
            loading={loadingStats}
            delay={50}
          />

          {/* Need to Verify */}
          <MetricCard
            title="Need Verify"
            value={stats?.needToVerifyCount || 0}
            change={stats?.changes?.needToVerify}
            customChangeLabel={stats?.previousDate ? "vs prev month" : undefined}
            subtitle={!stats?.previousDate ? `${stats && stats.total > 0 ? ((stats.needToVerifyCount / stats.total) * 100).toFixed(1) : 0}% of total` : undefined}
            icon={AlertTriangle}
            iconColor="text-amber-600 dark:text-amber-400"
            compact={true}
            loading={loadingStats}
            delay={100}
          />

          {/* Out of Org */}
          <MetricCard
            title="Out of Org"
            value={stats?.outOfOrgCount || 0}
            change={stats?.changes?.outOfOrg}
            customChangeLabel={stats?.previousDate ? "vs prev month" : undefined}
            subtitle={!stats?.previousDate ? `${stats && stats.total > 0 ? ((stats.outOfOrgCount / stats.total) * 100).toFixed(1) : 0}% of total` : undefined}
            icon={Info}
            iconColor="text-slate-600 dark:text-slate-300"
            compact={true}
            loading={loadingStats}
            delay={150}
          />

          {/* Need Access */}
          <MetricCard
            title="Need Access"
            value={stats?.needAccessCount || 0}
            change={stats?.changes?.needAccess}
            customChangeLabel={stats?.previousDate ? "vs prev month" : undefined}
            subtitle={!stats?.previousDate ? `${stats && stats.total > 0 ? ((stats.needAccessCount / stats.total) * 100).toFixed(1) : 0}% of total` : undefined}
            icon={KeyRound}
            iconColor="text-indigo-600 dark:text-indigo-400"
            compact={true}
            loading={loadingStats}
            delay={200}
          />

          {/* Suspended */}
          <MetricCard
            title="Suspended"
            value={stats?.suspendedCount || 0}
            change={stats?.changes?.suspended}
            customChangeLabel={stats?.previousDate ? "vs prev month" : undefined}
            subtitle={!stats?.previousDate ? `${stats && stats.total > 0 ? ((stats.suspendedCount / stats.total) * 100).toFixed(1) : 0}% of total` : undefined}
            icon={XCircle}
            iconColor="text-rose-600 dark:text-rose-400"
            compact={true}
            loading={loadingStats}
            delay={250}
          />
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <TabsList className="bg-muted/70 p-1">
              <TabsTrigger value="overview" className="gap-2 text-xs sm:text-sm">
                <Layers className="h-4 w-4" />
                <span>Overview & Analytics</span>
              </TabsTrigger>
              <TabsTrigger value="units" className="gap-2 text-xs sm:text-sm">
                <Building2 className="h-4 w-4" />
                <span>Unit (Branch) Matrix</span>
              </TabsTrigger>
              <TabsTrigger value="profiles" className="gap-2 text-xs sm:text-sm">
                <Users className="h-4 w-4" />
                <span>Profile Records ({totalRecords.toLocaleString()})</span>
              </TabsTrigger>
              <TabsTrigger value="export" className="gap-2 text-xs sm:text-sm">
                <Download className="h-4 w-4" />
                <span>Export Center</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* TAB 1: OVERVIEW & ANALYTICS */}
          <TabsContent value="overview" className="space-y-6 pt-2">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Verification Status Distribution */}
              <Card className="lg:col-span-1 border border-border shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center justify-between">
                    <span>Verification Status Breakdown</span>
                    <ShieldCheck className="h-4 w-4 text-primary" />
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Distribution of profiles by Google Business Profile status
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-1">
                  {loadingStats ? (
                    <div className="space-y-3">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                      ))}
                    </div>
                  ) : (
                    (stats?.statusBreakdown || []).map((item) => {
                      const badgeInfo = getStatusBadgeStyle(item.status);
                      const isSelected = selectedStatuses.includes(item.status);
                      return (
                        <div
                          key={item.status}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedStatuses(selectedStatuses.filter((s) => s !== item.status));
                            } else {
                              setSelectedStatuses([...selectedStatuses, item.status]);
                            }
                          }}
                          className={cn(
                            "p-2.5 rounded-lg border transition-all cursor-pointer hover:border-primary/50",
                            isSelected
                              ? "bg-primary/5 border-primary shadow-sm"
                              : "bg-card border-border/70 hover:bg-muted/40"
                          )}
                        >
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <div className="flex items-center gap-2">
                              <badgeInfo.icon className="h-3.5 w-3.5" />
                              <span className="font-medium text-foreground">{item.status}</span>
                            </div>
                            <div className="flex items-center gap-1.5 font-semibold text-foreground">
                              <span>{item.count.toLocaleString()}</span>
                              <span className="text-[10px] text-muted-foreground font-normal">
                                ({item.percentage}%)
                              </span>
                            </div>
                          </div>
                          <Progress value={item.percentage} className="h-1.5" />
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              {/* Cluster Breakdown Matrix */}
              <Card className="lg:col-span-2 border border-border shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <span>Cluster Verification Comparison</span>
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Profile verification progress across regional clusters
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow>
                          <TableHead className="font-semibold text-xs">Cluster</TableHead>
                          <TableHead className="font-semibold text-xs text-right">Total</TableHead>
                          <TableHead className="font-semibold text-xs text-right text-emerald-700 dark:text-emerald-400">
                            Verified
                          </TableHead>
                          <TableHead className="font-semibold text-xs text-right text-amber-700 dark:text-amber-400">
                            Need Verify
                          </TableHead>
                          <TableHead className="font-semibold text-xs text-right text-slate-700 dark:text-slate-300">
                            Out of Org
                          </TableHead>
                          <TableHead className="font-semibold text-xs text-right text-indigo-700 dark:text-indigo-400">
                            Need Access
                          </TableHead>
                          <TableHead className="font-semibold text-xs text-center w-36">Verification Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loadingStats ? (
                          [1, 2, 3, 4, 5].map((i) => (
                            <TableRow key={i}>
                              <TableCell colSpan={7}>
                                <Skeleton className="h-8 w-full" />
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          (stats?.clusterBreakdown || []).map((c) => {
                            const isSelected = selectedClusters.includes(c.cluster);
                            return (
                              <TableRow
                                key={c.cluster}
                                onClick={() => {
                                  if (isClusterRestricted) return;
                                  if (isSelected) {
                                    setSelectedClusters(selectedClusters.filter((x) => x !== c.cluster));
                                  } else {
                                    setSelectedClusters([...selectedClusters, c.cluster]);
                                  }
                                }}
                                className={cn(
                                  "cursor-pointer hover:bg-muted/50 transition-colors",
                                  isSelected && "bg-primary/5 font-semibold"
                                )}
                              >
                                <TableCell className="font-medium text-xs flex items-center gap-2">
                                  <span>{c.cluster}</span>
                                  {isSelected && (
                                    <Badge variant="outline" className="text-[10px] py-0 px-1 border-primary">
                                      Filtered
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right text-xs font-semibold">
                                  {c.total.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                  {c.verified.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right text-xs text-amber-600 dark:text-amber-400 font-medium">
                                  {c.needToVerify.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right text-xs text-slate-600 dark:text-slate-400 font-medium">
                                  {c.outOfOrg.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                                  {c.needAccess.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="flex items-center gap-2">
                                    <Progress value={c.verifiedRate} className="h-2 flex-1" />
                                    <span className="text-[11px] font-semibold w-10 text-right">
                                      {c.verifiedRate}%
                                    </span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Profile Types Breakdown */}
            <Card className="border border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Profile Types Categorization</CardTitle>
                <CardDescription className="text-xs">
                  Profiles grouped by category (Doctors, MARS, Departments, Hospitals, Clinics)
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                  {(stats?.profileTypeBreakdown || []).map((typeItem) => {
                    const isSelected = selectedDepartments.includes(typeItem.type);
                    return (
                      <div
                        key={typeItem.type}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedDepartments(selectedDepartments.filter((t) => t !== typeItem.type));
                          } else {
                            setSelectedDepartments([...selectedDepartments, typeItem.type]);
                          }
                        }}
                        className={cn(
                          "p-3.5 rounded-xl border transition-all cursor-pointer hover:shadow-sm",
                          isSelected
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border bg-card hover:border-primary/40"
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline" className={cn("text-xs font-medium", getProfileTypeBadge(typeItem.type))}>
                            {typeItem.type}
                          </Badge>
                          <span className="text-xs font-bold text-foreground">
                            {typeItem.total.toLocaleString()} profiles
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Verification Rate</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              {typeItem.verifiedRate}% ({typeItem.verified})
                            </span>
                          </div>
                          <Progress value={typeItem.verifiedRate} className="h-1.5" />
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                            <span>Need to Verify: {typeItem.needToVerify}</span>
                            <span>Out of Org: {typeItem.outOfOrg}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: UNIT (BRANCH) MATRIX */}
          <TabsContent value="units" className="space-y-4 pt-2">
            <Card className="border border-border shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      <span>Unit / Branch Level Status Matrix</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Branch and clinic profile verification status counts
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative w-64">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search Unit / Branch..."
                        value={unitSearch}
                        onChange={(e) => setUnitSearch(e.target.value)}
                        className="h-8 pl-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[600px] scrollbar-thin">
                  <Table>
                    <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                      <TableRow>
                        <TableHead className="font-semibold text-xs">#</TableHead>
                        <TableHead className="font-semibold text-xs">Unit Name (Branch)</TableHead>
                        <TableHead className="font-semibold text-xs">Cluster</TableHead>
                        <TableHead className="font-semibold text-xs text-right">Total Profiles</TableHead>
                        <TableHead className="font-semibold text-xs text-right text-emerald-700 dark:text-emerald-400">
                          Verified
                        </TableHead>
                        <TableHead className="font-semibold text-xs text-right text-amber-700 dark:text-amber-400">
                          Need Verify
                        </TableHead>
                        <TableHead className="font-semibold text-xs text-right text-slate-700 dark:text-slate-300">
                          Out of Org
                        </TableHead>
                        <TableHead className="font-semibold text-xs text-right text-indigo-700 dark:text-indigo-400">
                          Need Access
                        </TableHead>
                        <TableHead className="font-semibold text-xs text-center w-40">Verification Rate</TableHead>
                        <TableHead className="font-semibold text-xs text-center">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingStats ? (
                        [1, 2, 3, 4, 5, 6].map((i) => (
                          <TableRow key={i}>
                            <TableCell colSpan={10}>
                              <Skeleton className="h-8 w-full" />
                            </TableCell>
                          </TableRow>
                        ))
                      ) : filteredUnits.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-8 text-muted-foreground text-sm">
                            No units found matching "{unitSearch}"
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredUnits.map((u, idx) => {
                          const isUnitSelected = selectedUnits.includes(u.unit);
                          return (
                            <TableRow
                              key={`${u.cluster}-${u.unit}`}
                              className={cn("hover:bg-muted/40 transition-colors", isUnitSelected && "bg-primary/5")}
                            >
                              <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                              <TableCell className="font-medium text-xs text-foreground flex items-center gap-2">
                                <span>{u.unit}</span>
                                {isUnitSelected && (
                                  <Badge variant="outline" className="text-[10px] py-0 px-1 border-primary">
                                    Selected
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{u.cluster}</TableCell>
                              <TableCell className="text-right text-xs font-semibold">
                                {u.total.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                {u.verified.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right text-xs text-amber-600 dark:text-amber-400 font-medium">
                                {u.needToVerify.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right text-xs text-slate-600 dark:text-slate-400">
                                {u.outOfOrg.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right text-xs text-indigo-600 dark:text-indigo-400">
                                {u.needAccess.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center gap-2">
                                  <Progress value={u.verifiedRate} className="h-2 flex-1" />
                                  <span className="text-[11px] font-semibold w-9 text-right">{u.verifiedRate}%</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    if (isBranchRestricted) return;
                                    if (isUnitSelected) {
                                      setSelectedUnits(selectedUnits.filter((x) => x !== u.unit));
                                    } else {
                                      setSelectedUnits([u.unit]);
                                      setActiveTab("profiles");
                                    }
                                  }}
                                  className="h-7 text-xs px-2 text-primary hover:text-primary hover:bg-primary/10"
                                >
                                  {isUnitSelected ? "Clear" : "View Profiles"}
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: PROFILES DIRECTORY TABLE */}
          <TabsContent value="profiles" className="space-y-4 pt-2">
            <Card className="border border-border shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      <span>Historical Profile Directory</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Profile records, verification status, and direct profile links
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="relative w-72">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search profile, doctor, unit..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-8 pl-8 text-xs"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>Rows:</span>
                      <select
                        value={limit}
                        onChange={(e) => {
                          setLimit(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                      >
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="overflow-x-auto min-h-[350px]">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="font-semibold text-xs w-12">#</TableHead>
                        <TableHead className="font-semibold text-xs">
                          <button
                            onClick={() => {
                              if (sortField === "Business Profile Name") {
                                setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                              } else {
                                setSortField("Business Profile Name");
                                setSortOrder("asc");
                              }
                            }}
                            className="flex items-center gap-1 hover:text-foreground text-left"
                          >
                            <span>Business Profile Name</span>
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </TableHead>
                        <TableHead className="font-semibold text-xs">Unit (Branch)</TableHead>
                        <TableHead className="font-semibold text-xs">Cluster</TableHead>
                        <TableHead className="font-semibold text-xs">Profile Type</TableHead>
                        <TableHead className="font-semibold text-xs">
                          <button
                            onClick={() => {
                              if (sortField === "GMB Status") {
                                setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                              } else {
                                setSortField("GMB Status");
                                setSortOrder("asc");
                              }
                            }}
                            className="flex items-center gap-1 hover:text-foreground"
                          >
                            <span>GMB Status</span>
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </TableHead>
                        <TableHead className="font-semibold text-xs text-center">Snapshot Date</TableHead>
                        <TableHead className="font-semibold text-xs text-center">Actions / Links</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingRecords ? (
                        [1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                          <TableRow key={i}>
                            <TableCell colSpan={8}>
                              <Skeleton className="h-9 w-full" />
                            </TableCell>
                          </TableRow>
                        ))
                      ) : records.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-12 space-y-2">
                            <Info className="h-8 w-8 text-muted-foreground mx-auto" />
                            <div className="text-sm font-medium text-foreground">No profile records found</div>
                            <p className="text-xs text-muted-foreground">
                              Try clearing filters or adjusting your search term
                            </p>
                            {hasActiveFilters && (
                              <Button variant="outline" size="sm" onClick={handleResetFilters} className="mt-2 text-xs">
                                Clear Filters
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ) : (
                        records.map((doc, idx) => {
                          const badgeInfo = getStatusBadgeStyle(doc["GMB Status"]);
                          const rowNum = (currentPage - 1) * limit + idx + 1;
                          return (
                            <TableRow key={doc._id} className="hover:bg-muted/30 transition-colors">
                              <TableCell className="text-xs text-muted-foreground font-mono">{rowNum}</TableCell>
                              <TableCell className="font-medium text-xs text-foreground max-w-xs truncate">
                                {doc["Business Profile Name"] || "—"}
                              </TableCell>
                              <TableCell className="text-xs text-foreground">{doc.Unit || "—"}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{doc.Cluster || "—"}</TableCell>
                              <TableCell className="text-xs">
                                <Badge variant="outline" className={cn("text-[11px] font-normal", getProfileTypeBadge(doc["Profile Type"]))}>
                                  {doc["Profile Type"] || "—"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs">
                                <Badge variant="outline" className={cn("text-[11px] gap-1 px-2 py-0.5", badgeInfo.className)}>
                                  <badgeInfo.icon className="h-3 w-3" />
                                  <span>{doc["GMB Status"] || "—"}</span>
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-center text-muted-foreground font-mono">
                                {doc.Date || "—"}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  {doc["Google Search Link"] && (
                                    <a
                                      href={doc["Google Search Link"]}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1 rounded hover:bg-muted text-primary hover:text-primary transition-colors"
                                      title="Open Google Search"
                                    >
                                      <Search className="h-3.5 w-3.5" />
                                    </a>
                                  )}
                                  {doc["GMB Short URL"] && (
                                    <a
                                      href={doc["GMB Short URL"]}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1 rounded hover:bg-muted text-primary hover:text-primary transition-colors"
                                      title="Open Google Business Profile URL"
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </a>
                                  )}
                                  {!doc["Google Search Link"] && !doc["GMB Short URL"] && (
                                    <span className="text-xs text-muted-foreground/60">—</span>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-border bg-card">
                  <div className="text-xs text-muted-foreground">
                    Showing{" "}
                    <strong>{records.length > 0 ? (currentPage - 1) * limit + 1 : 0}</strong> to{" "}
                    <strong>{Math.min(currentPage * limit, totalRecords)}</strong> of{" "}
                    <strong>{totalRecords.toLocaleString()}</strong> profiles
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1 || loadingRecords}
                      className="h-8 gap-1 text-xs"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      <span>Previous</span>
                    </Button>

                    <div className="text-xs font-medium px-2">
                      Page {currentPage} of {totalPages || 1}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages || loadingRecords}
                      className="h-8 gap-1 text-xs"
                    >
                      <span>Next</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: EXPORT CENTER */}
          <TabsContent value="export" className="space-y-6 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Filtered Export Card */}
              <Card className="border border-border shadow-sm bg-card hover:border-primary/50 transition-all">
                <CardHeader>
                  <div className="p-3 w-fit rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-2">
                    <FileSpreadsheet className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-lg">Filtered Historical Report</CardTitle>
                  <CardDescription className="text-xs">
                    Download the dataset based on your active filters (Cluster, Unit, GMB Status, and Date).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 rounded-lg bg-muted/50 text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Matching Profiles:</span>
                      <span className="font-semibold text-foreground">{stats?.total || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Snapshot Date:</span>
                      <span className="font-semibold text-foreground">{selectedDates[0] || "All"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Includes:</span>
                      <span className="font-semibold text-foreground">Profiles, Summary, Cluster & Unit Sheets</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={() => handleExportClick("filtered", "xlsx")}
                      disabled={isExporting}
                      className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      <span>Download Excel (.xlsx)</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleExportClick("filtered", "csv")}
                      disabled={isExporting}
                      className="gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      <span>CSV</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Master Archive Card */}
              <Card className="border border-border shadow-sm bg-card hover:border-primary/50 transition-all">
                <CardHeader>
                  <div className="p-3 w-fit rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 mb-2">
                    <Layers className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-lg">Complete Historical Master Archive</CardTitle>
                  <CardDescription className="text-xs">
                    Export all profiles across all clusters and units from the database collection.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 rounded-lg bg-muted/50 text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Database Records:</span>
                      <span className="font-semibold text-foreground">{totalRecords.toLocaleString()} profiles</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Coverage:</span>
                      <span className="font-semibold text-foreground">All Units across India & International</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Format:</span>
                      <span className="font-semibold text-foreground">Multi-sheet Excel Workbook (.xlsx)</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={() => handleExportClick("all", "xlsx")}
                      disabled={isExporting}
                      className="flex-1 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download Master Archive (.xlsx)</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleExportClick("all", "csv")}
                      disabled={isExporting}
                      className="gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      <span>CSV</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Reports;
