import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Search, Phone, Star, FileWarning, ChevronDown, ChevronUp, MapPin, RefreshCw, Activity, CheckCircle2, Calendar as CalendarIcon, X } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { format, addDays } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://smldatamanagement.multiplierai.co";

export default function CriticalIssues() {
  const [data, setData] = useState<{ summary: any; items: any[] }>({ summary: null, items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCluster, setSelectedCluster] = useState<string>("all");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [selectedIssueTypes, setSelectedIssueTypes] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [showResolved, setShowResolved] = useState(false);
  const [date, setDate] = useState<DateRange | undefined>({
    from: undefined,
    to: undefined,
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE_URL}/api/critical-gmb-profiles`);
      const json = await res.json();
      if (json.ok) {
        setData({ summary: json.summary, items: json.items });
      } else {
        throw new Error(json.error || "Failed to fetch data");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    // Polling if scan is running
    if (data.summary?.scanStatus === "running") {
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }
  }, [data.summary?.scanStatus]);

  const toggleExpand = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const clusters = useMemo(() => {
    const c = new Set<string>();
    data.items.forEach(i => { if (i.Cluster) c.add(i.Cluster); });
    return Array.from(c).sort();
  }, [data.items]);

  const branches = useMemo(() => {
    const b = new Set<string>();
    data.items.forEach(i => {
      if (selectedCluster === "all" || i.Cluster === selectedCluster) {
        if (i.Branch) b.add(i.Branch);
      }
    });
    return Array.from(b).sort();
  }, [data.items, selectedCluster]);

  const filteredItems = useMemo(() => {
    return data.items.filter(item => {
      const activeIssues = (item.issues || []).filter((i: any) => i.status === "active");

      // Toggle for showing resolved/no active issues
      if (!showResolved && activeIssues.length === 0) return false;

      // Date Filter (by updatedTime)
      if (date?.from || date?.to) {
        const timestamp = item.updatedTime?.$date || item.updatedTime;
        const updatedDate = new Date(timestamp || 0);
        if (date.from && updatedDate < date.from) return false;
        if (date.to && updatedDate > date.to) return false;
      }

      if (selectedCluster !== "all" && item.Cluster !== selectedCluster) return false;
      if (selectedBranch !== "all" && item.Branch !== selectedBranch) return false;

      if (selectedIssueTypes.length > 0) {
        if (!activeIssues.some((i: any) => selectedIssueTypes.includes(i.issueType))) return false;
      }

      if (searchQuery) {
        const sq = searchQuery.toLowerCase();
        const textToSearch = [
          item.title, item.email, item.placeId, item.locationid, item.Cluster, item.Branch, item.primaryCategory
        ].join(" ").toLowerCase();
        if (!textToSearch.includes(sq)) return false;
      }

      return true;
    }).sort((a, b) => {
      const aIssues = (a.issues || []).filter((i: any) => i.status === "active");
      const bIssues = (b.issues || []).filter((i: any) => i.status === "active");

      const aCritical = aIssues.some((i: any) => i.severity === "critical") ? 1 : 0;
      const bCritical = bIssues.some((i: any) => i.severity === "critical") ? 1 : 0;
      if (aCritical !== bCritical) return bCritical - aCritical;

      const aHigh = aIssues.some((i: any) => i.severity === "high") ? 1 : 0;
      const bHigh = bIssues.some((i: any) => i.severity === "high") ? 1 : 0;
      if (aHigh !== bHigh) return bHigh - aHigh;

      const aDateValue = a.updatedTime?.$date || a.updatedTime || 0;
      const bDateValue = b.updatedTime?.$date || b.updatedTime || 0;
      const aDate = new Date(aDateValue).getTime();
      const bDate = new Date(bDateValue).getTime();
      return bDate - aDate;
    });
  }, [data.items, selectedCluster, selectedBranch, selectedIssueTypes, searchQuery, date, showResolved]);

  // Derived Summary metrics
  const profilesWithIssuesCount = filteredItems.filter(item => (item.issues || []).some((i: any) => i.status === "active")).length;
  let totalActiveIssues = 0;
  let totalCriticalHighIssues = 0;
  const issueTypeCounts: Record<string, number> = {};
  const clusterIssueCounts: Record<string, number> = {};

  filteredItems.forEach(item => {
    const activeIssues = (item.issues || []).filter((i: any) => i.status === "active");
    totalActiveIssues += activeIssues.length;
    activeIssues.forEach((i: any) => {
      if (i.severity === "critical" || i.severity === "high") totalCriticalHighIssues++;
      issueTypeCounts[i.issueType] = (issueTypeCounts[i.issueType] || 0) + 1;

      const c = item.Cluster || "Unknown";
      clusterIssueCounts[c] = (clusterIssueCounts[c] || 0) + 1;
    });
  });

  const doughnutData = Object.entries(issueTypeCounts).map(([name, value]) => ({ name, value }));
  const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6'];
  const barData = Object.entries(clusterIssueCounts).map(([name, issues]) => ({ name, issues })).sort((a, b) => b.issues - a.issues);

  const getSeverityColor = (severity: string) => {
    if (severity === "critical") return "bg-red-50 text-red-700 border-red-200";
    if (severity === "high") return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-blue-50 text-blue-700 border-blue-200";
  };

  const getIssueIcon = (type: string) => {
    if (type.includes("Call")) return <Phone className="w-4 h-4" />;
    if (type.includes("Search")) return <Search className="w-4 h-4" />;
    if (type.includes("review") || type.includes("rating")) return <Star className="w-4 h-4" />;
    return <FileWarning className="w-4 h-4" />;
  };

  const getMonthName = (month: number, year: number) => {
    const date = new Date(year, month - 1, 1);
    return format(date, "MMM yyyy");
  };

  const issueTypeOptions = [
    "Call drops",
    "Search drops",
    "Low ratings & review growth",
    "Incomplete or unoptimized profiles"
  ];

  return (
    <DashboardLayout
      title="Critical GMB Profiles"
      subtitle="Live issue monitoring for calls, search, reviews and profile completeness"
    >
      <div className="space-y-6">

        {/* Header Status Bar */}
        {/* <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border">
          <div className="flex items-center gap-3">
            {data.summary?.scanStatus === "running" ? (
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <span className="text-sm font-medium text-emerald-700">Scanning live</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-500">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm">Scan completed</span>
              </div>
            )}
            {data.summary?.finishedAt && (
              <span className="text-xs text-slate-400">Updated {new Date(data.summary.finishedAt).toLocaleString()}</span>
            )}
          </div>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Show Resolved</span>
                <input 
                  type="checkbox" 
                  checked={showResolved} 
                  onChange={(e) => setShowResolved(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
             </div>
             <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-2">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div> */}

        {/* Progress Bar if running */}
        {/* {data.summary?.scanStatus === "running" && (
          <div className="bg-white p-4 rounded-xl shadow-sm border space-y-3">
            <div className="flex justify-between text-sm font-medium">
              <span className="text-slate-700">Scanning: {data.summary.currentBranch || data.summary.currentEmail || '...'}</span>
              <span className="text-emerald-600">{data.summary.progressPercent}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${data.summary.progressPercent}%` }}></div>
            </div>
            <div className="flex gap-4 text-xs text-slate-500">
              <span>{data.summary.totalProfilesScanned} checked</span>
              <span>{data.summary.verifiedProfilesProcessed} verified</span>
              <span>{data.summary.unverifiedProfilesSkipped} skipped</span>
            </div>
          </div>
        )} */}

        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">Could not load critical profile data: {error}</span>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl shadow-sm border flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <Input
              placeholder="Search by name, email, cluster..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={selectedCluster} onValueChange={(val) => {
            setSelectedCluster(val);
            if (val === "all") setSelectedBranch("all");
          }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Clusters" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clusters</SelectItem>
              {clusters.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedBranch} onValueChange={setSelectedBranch} disabled={selectedCluster === "all"}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="w-[240px]">
            <MultiSelect
              options={issueTypeOptions}
              selected={selectedIssueTypes}
              onChange={setSelectedIssueTypes}
              placeholder="Filter by Issue Types..."
            />
          </div>

          <div className="grid gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={"outline"}
                  className={cn(
                    "w-[240px] justify-start text-left font-normal bg-slate-50 relative pr-8",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {date?.from ? (
                      date.to ? (
                        <>
                          {format(date.from, "LLL dd, y")} -{" "}
                          {format(date.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(date.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </span>
                  {date?.from && (
                    <div
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-md hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDate(undefined);
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </div>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={date?.from}
                  selected={date}
                  onSelect={setDate}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-white border shadow-sm">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Profiles w/ Issues</span>
              <span className="text-2xl font-bold text-slate-800">{profilesWithIssuesCount}</span>
            </CardContent>
          </Card>
          <Card className="bg-white border shadow-sm">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Active Issues</span>
              <span className="text-2xl font-bold text-slate-800">{totalActiveIssues}</span>
            </CardContent>
          </Card>
          <Card className="bg-white border shadow-sm">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Critical / High</span>
              <span className="text-2xl font-bold text-red-600">{totalCriticalHighIssues}</span>
            </CardContent>
          </Card>
          <Card className="bg-white border shadow-sm">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Branches Scanned</span>
              <span className="text-2xl font-bold text-slate-800">
                {data.summary?.branchesProcessed || data.summary?.branchesFound || 0}
              </span>
            </CardContent>
          </Card>
          {/* <Card className="bg-white border shadow-sm">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Profiles Checked</span>
              <span className="text-2xl font-bold text-slate-800">{data.summary?.totalProfilesScanned || 0}</span>
            </CardContent>
          </Card>
          <Card className="bg-white border shadow-sm">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Verified Profiles</span>
              <span className="text-2xl font-bold text-slate-800">
                {data.summary?.verifiedProfilesProcessed || data.summary?.locationsProcessed || 0}
              </span>
            </CardContent>
          </Card>
          <Card className="bg-white border shadow-sm">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Skipped Unverified</span>
              <span className="text-2xl font-bold text-amber-600">{data.summary?.unverifiedProfilesSkipped || 0}</span>
            </CardContent>
          </Card>
          <Card className="bg-white border shadow-sm">
            <CardContent className="p-4 flex flex-col items-center text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Last Scan Run</span>
              <span className="text-lg font-bold text-slate-800 truncate w-full">
                {data.summary?.scanStatus === "running" ? "Running..." : (data.summary?.finishedAt ? format(new Date(data.summary.finishedAt), "dd MMM HH:mm") : "-")}
              </span>
            </CardContent>
          </Card> */}
        </div>



        {/* Charts & Main Content */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Main List */}
          <div className="xl:col-span-2 space-y-4">
            {loading && filteredItems.length === 0 && (
              <div className="text-center py-12 text-slate-500">Loading profiles...</div>
            )}
            {!loading && filteredItems.length === 0 && (
              <div className="text-center py-12 bg-white rounded-xl border border-dashed text-slate-500">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-slate-700">No active issues found</h3>
                <p>Try adjusting your filters or wait for the next scan.</p>
              </div>
            )}

            {filteredItems.map(item => (
              <Card key={item._id} className="overflow-hidden border shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-0">
                  {/* Card Header Info */}
                  <div className="p-5 flex flex-col md:flex-row justify-between gap-4 bg-white">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 leading-tight">{item.title}</h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-sm text-slate-500">
                        <span className="flex items-center gap-1 font-medium"><MapPin className="w-3.5 h-3.5" /> {item.Cluster} • {item.Branch}</span>
                        {item.email && <span className="hidden md:inline text-slate-300">|</span>}
                        <span>{item.email}</span>
                      </div>
                      <div className="mt-2 text-xs text-slate-400 font-mono">
                        {item.placeId && <span>Place ID: {item.placeId}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-start md:items-end gap-2">
                      <div className="flex flex-wrap gap-2 justify-end">
                        {(item.issues || []).filter((i: any) => i.status === "active").map((issue: any, idx: number) => (
                          <Badge key={idx} variant="outline" className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold ${getSeverityColor(issue.severity)}`}>
                            {getIssueIcon(issue.issueType)}
                            {issue.issueType}
                          </Badge>
                        ))}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => toggleExpand(item._id)} className="h-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2 mt-auto">
                        {expandedCards[item._id] ? (
                          <><ChevronUp className="w-4 h-4 mr-1" /> Hide Insights</>
                        ) : (
                          <><ChevronDown className="w-4 h-4 mr-1" /> View Insights</>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Issue Panels */}
                  {expandedCards[item._id] && (
                    <div className="bg-slate-50/80 border-t p-5 space-y-4">
                      {(item.issues || []).filter((i: any) => i.status === "active").map((issue: any, idx: number) => (
                        <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">

                          {/* Issue Panel Header */}
                          <div className="flex items-start gap-3 mb-4">
                            <div className={`p-2 rounded-lg ${getSeverityColor(issue.severity).split(' ')[0]} ${getSeverityColor(issue.severity).split(' ')[1]}`}>
                              {getIssueIcon(issue.issueType)}
                            </div>
                            <div>
                              <h4 className="font-semibold text-slate-800 text-sm">{issue.issueType}</h4>
                              <p className="text-xs text-slate-500 mt-0.5">{issue.summary}</p>
                            </div>
                            <div className="ml-auto">
                              <Badge variant="outline" className="capitalize text-[10px]">{issue.severity}</Badge>
                            </div>
                          </div>

                          {/* Specific Issue Logic */}

                          {/* 1. Call or Search Drops */}
                          {(issue.issueType === "Call drops" || issue.issueType === "Search drops") && issue.comparisonMonth && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-slate-50 p-3 rounded-lg border text-sm">
                                <div className="font-medium text-slate-700 mb-2 border-b pb-1">Completed Months</div>
                                <div className="flex justify-between py-1">
                                  <span className="text-slate-500">{getMonthName(issue.baselineMonth?.month, issue.baselineMonth?.year)}</span>
                                  <span className="font-semibold">{issue.baselineMonth?.total}</span>
                                </div>
                                <div className="flex justify-between py-1">
                                  <span className="text-slate-500">{getMonthName(issue.comparisonMonth?.month, issue.comparisonMonth?.year)}</span>
                                  <span className="font-semibold">{issue.comparisonMonth?.total}</span>
                                </div>
                                <div className="flex justify-between py-1 mt-1 pt-1 border-t text-red-600 font-semibold">
                                  <span>Drop</span>
                                  <span>-{issue.dropCount} ({issue.dropPercent}%)</span>
                                </div>
                              </div>

                              {issue.currentMonthInsight && (
                                <div className="bg-slate-50 p-3 rounded-lg border text-sm">
                                  <div className="font-medium text-slate-700 mb-2 border-b pb-1 flex items-center justify-between">
                                    Current Month Pace
                                    {issue.currentMonthInsight.direction === "declining" ?
                                      <Activity className="w-3.5 h-3.5 text-red-500" /> :
                                      <Activity className="w-3.5 h-3.5 text-emerald-500" />
                                    }
                                  </div>
                                  <div className="flex justify-between py-1">
                                    <span className="text-slate-500 text-xs">Last month same period</span>
                                    <span className="font-semibold">{issue.currentMonthInsight.previousMonthSamePeriodTotal}</span>
                                  </div>
                                  <div className="flex justify-between py-1">
                                    <span className="text-slate-500 text-xs">Current month so far</span>
                                    <span className="font-semibold">{issue.currentMonthInsight.currentPartialTotal}</span>
                                  </div>
                                  <div className={`flex justify-between py-1 mt-1 pt-1 border-t font-semibold ${issue.currentMonthInsight.direction === "declining" ? "text-red-600" : "text-emerald-600"}`}>
                                    <span className="capitalize">{issue.currentMonthInsight.direction}</span>
                                    <span>{issue.currentMonthInsight.delta > 0 ? "+" : ""}{issue.currentMonthInsight.delta} ({issue.currentMonthInsight.percentChange}%)</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* 2. Low Ratings / Review Growth */}
                          {issue.issueType === "Low ratings & review growth" && (
                            <div className="space-y-4">
                              <div className="flex gap-6 items-center">
                                <div className="text-center bg-slate-50 px-4 py-2 rounded-lg border">
                                  <div className="text-2xl font-bold text-slate-800 flex items-center justify-center gap-1">
                                    {issue.averageRating?.toFixed(1) || "-"} <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                                  </div>
                                  <div className="text-xs text-slate-500">Average Rating</div>
                                </div>
                                <div className="text-center bg-slate-50 px-4 py-2 rounded-lg border">
                                  <div className="text-2xl font-bold text-slate-800">{issue.totalReviewCount || "-"}</div>
                                  <div className="text-xs text-slate-500">Total Reviews</div>
                                </div>
                              </div>
                              {issue.recentLowReviews && issue.recentLowReviews.length > 0 && (
                                <div>
                                  <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Recent Low Reviews</div>
                                  <div className="space-y-2">
                                    {issue.recentLowReviews.map((r: any, rIdx: number) => (
                                      <div key={rIdx} className="bg-slate-50 p-3 rounded-lg border text-sm">
                                        <div className="flex justify-between items-start mb-1">
                                          <span className="font-medium">{r.reviewer?.displayName || "Unknown"}</span>
                                          <span className="text-xs text-slate-400">{new Date(r.updateTime).toLocaleDateString()}</span>
                                        </div>
                                        <div className="flex text-amber-400 mb-1">
                                          {[...Array(5)].map((_, i) => (
                                            <Star key={i} className={`w-3 h-3 ${i < (r.starRating === "ONE" ? 1 : r.starRating === "TWO" ? 2 : 0) ? "fill-current" : "text-slate-300"}`} />
                                          ))}
                                        </div>
                                        <p className="text-slate-600 line-clamp-2 text-xs italic">"{r.comment}"</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* 3. Incomplete Profiles */}
                          {issue.issueType === "Incomplete or unoptimized profiles" && issue.checks && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                {Object.values(issue.checks).map((chk: any, cIdx: number) => (
                                  <div key={cIdx} className="flex items-center gap-2 p-2 border rounded-lg bg-slate-50">
                                    {chk.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />}
                                    <span className={chk.ok ? "text-slate-700" : "text-red-700 font-medium"}>{chk.label}</span>
                                  </div>
                                ))}
                              </div>
                              {issue.analysis && (
                                <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 text-sm">
                                  <div className="font-medium text-blue-800 mb-1">{issue.analysis.headline}</div>
                                  <div className="text-slate-600 text-xs mb-2">{issue.analysis.impact}</div>
                                  <div className="text-blue-700 font-medium text-xs flex items-center gap-1.5">
                                    <AlertTriangle className="w-3.5 h-3.5" /> Recommendation: {issue.analysis.recommendation}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts Sidebar */}
          <div className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-500 uppercase">Issue Types Distribution</CardTitle>
              </CardHeader>
              <CardContent className="h-[320px] pb-4 flex flex-col">
                {doughnutData.length > 0 ? (
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={doughnutData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {doughnutData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-sm text-slate-400">No data available</div>
                )}
                {doughnutData.length > 0 && (
                  <div className="flex flex-col gap-2 mt-4 pt-2 border-t px-2 overflow-y-auto max-h-[100px] scrollbar-thin">
                    {doughnutData.map((entry, index) => (
                      <div key={entry.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                        {entry.name}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-500 uppercase">Issues by Cluster</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                {barData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData.slice(0, 8)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <RechartsTooltip
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="issues" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={30} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-slate-400">No data available</div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}
