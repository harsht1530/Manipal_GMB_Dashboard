import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, AlertCircle, Building2, Info, ArrowUp, ArrowDown, Download } from "lucide-react";
import { LocationData, parseDateString, InsightData } from "@/hooks/useMongoData";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";

interface LocationsOverviewProps {
  data: LocationData[];
  apiInsights?: InsightData[];
  selectedMonths: string[];
}

const TrendIndicator = ({ current, previous, inverseColors = false }: { current: number; previous: number, inverseColors?: boolean }) => {
  if (previous === 0 || previous == null) return (
    <div className="flex items-center text-xs font-medium mt-1 text-muted-foreground">
      -
    </div>
  );

  const diff = current - previous;
  if (diff === 0) return (
    <div className="flex items-center text-xs font-medium mt-1 text-muted-foreground">
      0
    </div>
  );

  const diffAbs = Math.abs(diff);
  const isUp = diff > 0;
  
  const colorClass = isUp 
    ? (inverseColors ? 'text-red-600' : 'text-green-600') 
    : (inverseColors ? 'text-green-600' : 'text-red-600');
    
  return (
    <div className={`flex items-center text-xs font-medium mt-1 ${colorClass}`}>
      {isUp ? <ArrowUp className="h-3 w-3 mr-1" /> : <ArrowDown className="h-3 w-3 mr-1" />}
      {isUp ? '+' : '-'}{diffAbs}
    </div>
  );
};

export const LocationsOverview = ({ data, apiInsights = [], selectedMonths }: LocationsOverviewProps) => {
  const [viewMode, setViewMode] = useState<"standard" | "realtime">("realtime");
  const [exportDataCtx, setExportDataCtx] = useState<{
    isOpen: boolean;
    type: "Total Profiles" | "Verified and Active" | "Unverified and others" | null;
  }>({ isOpen: false, type: null });

  const handleExport = () => {
    if (!exportDataCtx.type) return;

    let dataToExport = filteredApiInsights;
    
    if (exportDataCtx.type === "Verified and Active") {
      dataToExport = filteredApiInsights.filter(item => {
        const status = item.statusType?.toLowerCase() || "";
        return status === "verified" || status === "verified and active";
      });
    } else if (exportDataCtx.type === "Unverified and others") {
      dataToExport = filteredApiInsights.filter(item => {
        const status = item.statusType?.toLowerCase() || "";
        return status !== "verified" && status !== "verified and active";
      });
    }

    const exportData = dataToExport.map(d => ({
      "Business Name": d.businessName || "",
      "Month": d.month || "",
      "Cluster": d.cluster || "",
      "Branch": d.branch || "",
      "Speciality": d.speciality || "",
      "Rating": d.rating || "",
      "Reviews": d.review || "",
      "Search Mobile": d.googleSearchMobile || "",
      "Search Desktop": d.googleSearchDesktop || "",
      "Maps Mobile": d.googleMapsMobile || "",
      "Maps Desktop": d.googleMapsDesktop || "",
      "Directions": d.directions || "",
      "Website Clicks": d.websiteClicks || "",
      "Calls": d.calls || "",
      "Profile Type": d.statusType || ""
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Export");
    XLSX.writeFile(workbook, `${exportDataCtx.type.replace(/\s+/g, '_')}_Profiles.xlsx`);
    
    setExportDataCtx({ isOpen: false, type: null });
  };

  const getLatestDataScope = (dataset: any[]) => {
    if (dataset.length === 0) return { month: "Jan", date: null };

    let targetData = dataset;
    if (selectedMonths.length > 0 && !selectedMonths.includes("All")) {
      targetData = dataset.filter(d => selectedMonths.includes(d.month));
      if (targetData.length === 0) targetData = dataset; // fallback
    }

    const sortedData = [...targetData].sort((a, b) => {
      const timeA = a.date ? parseDateString(a.date).getTime() : 0;
      const timeB = b.date ? parseDateString(b.date).getTime() : 0;
      if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) return timeB - timeA;
      
      const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return monthOrder.indexOf(b.month) - monthOrder.indexOf(a.month);
    });

    const latestMonth = sortedData[0].month || "Jan";
    const allSorted = [...dataset].sort((a, b) => {
      const timeA = a.date ? parseDateString(a.date).getTime() : 0;
      const timeB = b.date ? parseDateString(b.date).getTime() : 0;
      if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) return timeB - timeA;
      
      const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return monthOrder.indexOf(b.month) - monthOrder.indexOf(a.month);
    });
    const previousItem = allSorted.find(d => d.month !== latestMonth);
    return { 
      month: latestMonth, 
      date: sortedData[0].date,
      prevMonth: previousItem ? previousItem.month : null,
      prevDate: previousItem ? previousItem.date : null
    };
  };

  const standardScope = getLatestDataScope(data);
  const latestMonth = standardScope.month;
  const filteredData = data.filter(d => d.month === standardScope.month && (!standardScope.date || d.date === standardScope.date));
  const prevFilteredData = data.filter(d => d.month === standardScope.prevMonth && (!standardScope.prevDate || d.date === standardScope.prevDate));


  // Standard aggregation
  const aggregatedData = filteredData.reduce((acc, item) => {
    const existing = acc.find(d => d.unitName === item.unitName);
    if (existing) {
      existing.totalProfiles += item.totalProfiles;
      existing.verifiedProfiles += item.verifiedProfiles;
      existing.unverifiedProfiles += item.unverifiedProfiles;
      existing.needAccess += item.needAccess;
      existing.notInterested += item.notInterested;
      existing.outOfOrganization += item.outOfOrganization;
    } else {
      acc.push({
        unitName: item.unitName,
        cluster: item.cluster,
        totalProfiles: item.totalProfiles,
        verifiedProfiles: item.verifiedProfiles,
        unverifiedProfiles: item.unverifiedProfiles,
        needAccess: item.needAccess,
        notInterested: item.notInterested,
        outOfOrganization: item.outOfOrganization,
      });
    }
    return acc;
  }, [] as any[]);

  const totals = aggregatedData.reduce(
    (acc, item) => ({
      totalProfiles: acc.totalProfiles + item.totalProfiles,
      verifiedProfiles: acc.verifiedProfiles + item.verifiedProfiles,
      unverifiedProfiles: acc.unverifiedProfiles + item.unverifiedProfiles,
      needAccess: acc.needAccess + item.needAccess,
      notInterested: acc.notInterested + item.notInterested,
      outOfOrganization: acc.outOfOrganization + item.outOfOrganization,
    }),
    { totalProfiles: 0, verifiedProfiles: 0, unverifiedProfiles: 0, needAccess: 0, notInterested: 0, outOfOrganization: 0 }
  );

  const prevTotals = prevFilteredData.reduce(
    (acc, item) => ({
      totalProfiles: acc.totalProfiles + (item.totalProfiles || 0),
      verifiedProfiles: acc.verifiedProfiles + (item.verifiedProfiles || 0),
      unverifiedProfiles: acc.unverifiedProfiles + (item.unverifiedProfiles || 0),
      needAccess: acc.needAccess + (item.needAccess || 0),
      notInterested: acc.notInterested + (item.notInterested || 0),
      outOfOrganization: acc.outOfOrganization + (item.outOfOrganization || 0),
    }),
    { totalProfiles: 0, verifiedProfiles: 0, unverifiedProfiles: 0, needAccess: 0, notInterested: 0, outOfOrganization: 0 }
  );

  const verificationRate = totals.totalProfiles > 0
    ? Math.round((totals.verifiedProfiles / totals.totalProfiles) * 100)
    : 0;

  // Realtime aggregation
  const realtimeScope = getLatestDataScope(apiInsights);
  const realtimeLatestMonth = realtimeScope.month;
  const filteredApiInsights = apiInsights.filter(d => d.month === realtimeScope.month && (!realtimeScope.date || d.date === realtimeScope.date));
  const prevFilteredApiInsights = apiInsights.filter(d => d.month === realtimeScope.prevMonth && (!realtimeScope.prevDate || d.date === realtimeScope.prevDate));

  const latestFetchDate = apiInsights.length > 0
    ? apiInsights.reduce((latest, current) => {
      const currentD = parseDateString(current.date);
      const latestD = parseDateString(latest.date);
      return currentD > latestD ? current : latest;
    }).date
    : "N/A";

  const aggregatedRealtimeData = filteredApiInsights.reduce((acc, item) => {
    const unitName = item.branch || "Unknown";
    const existing = acc.find(d => d.unitName === unitName);

    let verified = 0, unverified = 0, suspended = 0;
    const status = item.statusType?.toLowerCase() || "";
    if (status === "verified" || status === "verified and active") verified = 1;
    else if (status === "unverified") unverified = 1;
    else suspended = 1;

    if (existing) {
      existing.totalProfiles += 1;
      existing.verifiedProfiles += verified;
      existing.unverifiedProfiles += unverified;
      existing.suspendedProfiles += suspended;
    } else {
      acc.push({
        unitName,
        cluster: item.cluster,
        totalProfiles: 1,
        verifiedProfiles: verified,
        unverifiedProfiles: unverified,
        suspendedProfiles: suspended,
      });
    }
    return acc;
  }, [] as any[]);

  const realtimeTotals = aggregatedRealtimeData.reduce(
    (acc, item) => ({
      totalProfiles: acc.totalProfiles + item.totalProfiles,
      verifiedProfiles: acc.verifiedProfiles + item.verifiedProfiles,
      unverifiedProfiles: acc.unverifiedProfiles + item.unverifiedProfiles,
      suspendedProfiles: acc.suspendedProfiles + item.suspendedProfiles,
    }),
    { totalProfiles: 0, verifiedProfiles: 0, unverifiedProfiles: 0, suspendedProfiles: 0 }
  );

  const prevAggregatedRealtimeData = prevFilteredApiInsights.reduce((acc, item) => {
    const unitName = item.branch || "Unknown";
    const existing = acc.find((d: any) => d.unitName === unitName);
    let verified = 0, unverified = 0, suspended = 0;
    const status = item.statusType?.toLowerCase() || "";
    if (status === "verified" || status === "verified and active") verified = 1;
    else if (status === "unverified") unverified = 1;
    else suspended = 1;
    if (existing) {
      existing.totalProfiles += 1;
      existing.verifiedProfiles += verified;
      existing.unverifiedProfiles += unverified;
      existing.suspendedProfiles += suspended;
    } else {
      acc.push({ unitName, totalProfiles: 1, verifiedProfiles: verified, unverifiedProfiles: unverified, suspendedProfiles: suspended });
    }
    return acc;
  }, [] as any[]);

  const prevRealtimeTotals = prevAggregatedRealtimeData.reduce(
    (acc: any, item: any) => ({
      totalProfiles: acc.totalProfiles + item.totalProfiles,
      verifiedProfiles: acc.verifiedProfiles + item.verifiedProfiles,
      unverifiedProfiles: acc.unverifiedProfiles + item.unverifiedProfiles,
      suspendedProfiles: acc.suspendedProfiles + item.suspendedProfiles,
    }),
    { totalProfiles: 0, verifiedProfiles: 0, unverifiedProfiles: 0, suspendedProfiles: 0 }
  );

  const realtimeVerificationRate = realtimeTotals.totalProfiles > 0
    ? Math.round((realtimeTotals.verifiedProfiles / realtimeTotals.totalProfiles) * 100)
    : 0;

  return (
    <TooltipProvider>
      <Card className="animate-fade-in">
        <CardHeader>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg font-semibold">Profile Verification Status</CardTitle>
              {viewMode === "realtime" && latestFetchDate !== "N/A" && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  Last Fetched: {new Date(latestFetchDate).toLocaleDateString()}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs ml-2 hidden md:inline-flex">
                Showing: {viewMode === "realtime" ? realtimeLatestMonth : latestMonth}
              </Badge>
            </div>

            <div className="flex bg-white p-1 rounded-xl shadow-sm border w-fit overflow-x-auto">
              <button
                onClick={() => setViewMode('realtime')}
                className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${viewMode === 'realtime'
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-slate-600 hover:bg-slate-50'
                  }`}
              >
                API Based
              </button>
              <button
                onClick={() => setViewMode('standard')}
                className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${viewMode === 'standard'
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-slate-600 hover:bg-slate-50'
                  }`}
              >
                Standard
              </button>
            </div>
          </div>

          {/* Summary Stats */}
          {viewMode === "standard" ? (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg group relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="absolute right-2 top-2 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity">
                      <Info className="h-4 w-4" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Total number of profiles</p>
                  </TooltipContent>
                </Tooltip>
                <div className="flex flex-col items-center">
                  <p className="text-2xl font-bold text-foreground">{totals.totalProfiles}</p>
                  <TrendIndicator current={totals.totalProfiles} previous={prevTotals.totalProfiles} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Total Profiles</p>
              </div>
              <div className="text-center p-3 bg-green-500/10 rounded-lg group relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="absolute right-2 top-2 text-green-600/50 group-hover:opacity-100 transition-opacity">
                      <Info className="h-4 w-4" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Verified profiles</p>
                  </TooltipContent>
                </Tooltip>
                <div className="flex flex-col items-center">
                  <p className="text-2xl font-bold text-green-600">{totals.verifiedProfiles}</p>
                  <TrendIndicator current={totals.verifiedProfiles} previous={prevTotals.verifiedProfiles} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Verified</p>
              </div>
              <div className="text-center p-3 bg-yellow-500/10 rounded-lg group relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="absolute right-2 top-2 text-yellow-600/50 group-hover:opacity-100 transition-opacity">
                      <Info className="h-4 w-4" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Unverified profiles</p>
                  </TooltipContent>
                </Tooltip>
                <div className="flex flex-col items-center">
                  <p className="text-2xl font-bold text-yellow-600">{totals.unverifiedProfiles}</p>
                  <TrendIndicator current={totals.unverifiedProfiles} previous={prevTotals.unverifiedProfiles} inverseColors={true} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Unverified</p>
              </div>
              <div className="text-center p-3 bg-blue-500/10 rounded-lg group relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="absolute right-2 top-2 text-blue-600/50 group-hover:opacity-100 transition-opacity">
                      <Info className="h-4 w-4" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Profiles needing access</p>
                  </TooltipContent>
                </Tooltip>
                <div className="flex flex-col items-center">
                  <p className="text-2xl font-bold text-blue-600">{totals.needAccess}</p>
                  <TrendIndicator current={totals.needAccess} previous={prevTotals.needAccess} inverseColors={true} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Need Access</p>
              </div>
              <div className="text-center p-3 bg-red-500/10 rounded-lg group relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="absolute right-2 top-2 text-red-600/50 group-hover:opacity-100 transition-opacity">
                      <Info className="h-4 w-4" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Not interested profiles</p>
                  </TooltipContent>
                </Tooltip>
                <div className="flex flex-col items-center">
                  <p className="text-2xl font-bold text-red-600">{totals.notInterested}</p>
                  <TrendIndicator current={totals.notInterested} previous={prevTotals.notInterested} inverseColors={true} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Not Interested</p>
              </div>
              <div className="text-center p-3 bg-gray-500/10 rounded-lg group relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="absolute right-2 top-2 text-gray-600/50 group-hover:opacity-100 transition-opacity">
                      <Info className="h-4 w-4" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Out of organization profiles</p>
                  </TooltipContent>
                </Tooltip>
                <div className="flex flex-col items-center">
                  <p className="text-2xl font-bold text-gray-600">{totals.outOfOrganization}</p>
                  <TrendIndicator current={totals.outOfOrganization} previous={prevTotals.outOfOrganization} inverseColors={true} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Out of Organization</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
              <div 
                className="text-center p-3 bg-muted/50 rounded-lg group relative cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                onClick={() => setExportDataCtx({ isOpen: true, type: "Total Profiles" })}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="absolute right-2 top-2 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity">
                      <Info className="h-4 w-4" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Total number of profiles from Google API. Click to export.</p>
                  </TooltipContent>
                </Tooltip>
                <div className="flex flex-col items-center">
                  <p className="text-2xl font-bold text-foreground">{realtimeTotals.totalProfiles}</p>
                  <TrendIndicator current={realtimeTotals.totalProfiles} previous={prevRealtimeTotals.totalProfiles} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Total Profiles</p>
              </div>
              <div 
                className="text-center p-3 bg-green-500/10 rounded-lg group relative cursor-pointer hover:ring-2 hover:ring-green-500/50 transition-all"
                onClick={() => setExportDataCtx({ isOpen: true, type: "Verified and Active" })}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="absolute right-2 top-2 text-green-600/50 group-hover:opacity-100 transition-opacity">
                      <Info className="h-4 w-4" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Profiles that are verified and active. Click to export.</p>
                  </TooltipContent>
                </Tooltip>
                <div className="flex flex-col items-center">
                  <p className="text-2xl font-bold text-green-600">{realtimeTotals.verifiedProfiles}</p>
                  <TrendIndicator current={realtimeTotals.verifiedProfiles} previous={prevRealtimeTotals.verifiedProfiles} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Verified and Active</p>
              </div>
              <div 
                className="text-center p-3 bg-yellow-500/10 rounded-lg group relative cursor-pointer hover:ring-2 hover:ring-yellow-500/50 transition-all"
                onClick={() => setExportDataCtx({ isOpen: true, type: "Unverified and others" })}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="absolute right-2 top-2 text-yellow-600/50 group-hover:opacity-100 transition-opacity">
                      <Info className="h-4 w-4" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Profiles that are unverified, suspended, or have other issues. Click to export.</p>
                  </TooltipContent>
                </Tooltip>
                <div className="flex flex-col items-center">
                  <p className="text-2xl font-bold text-yellow-600">{realtimeTotals.unverifiedProfiles + realtimeTotals.suspendedProfiles}</p>
                  <TrendIndicator current={realtimeTotals.unverifiedProfiles + realtimeTotals.suspendedProfiles} previous={prevRealtimeTotals.unverifiedProfiles + prevRealtimeTotals.suspendedProfiles} inverseColors={true} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Unverified and others</p>
              </div>
            </div>
          )}

          {/* Overall Verification Rate */}
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Overall Verification Rate</span>
              <span className="font-semibold text-primary">{viewMode === "realtime" ? realtimeVerificationRate : verificationRate}%</span>
            </div>
            <Progress value={viewMode === "realtime" ? realtimeVerificationRate : verificationRate} className="h-2" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[300px] overflow-auto scrollbar-hide">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit Name</TableHead>
                  <TableHead>Cluster</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      {viewMode === "realtime" ? "Verified and Active" : "Verified"}
                    </div>
                  </TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <XCircle className="h-3 w-3 text-yellow-500" />
                      {viewMode === "realtime" ? "Unverified and others" : "Unverified"}
                    </div>
                  </TableHead>
                  {viewMode === "standard" && (
                    <>
                      <TableHead className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <AlertCircle className="h-3 w-3 text-blue-500" />
                          Need Access
                        </div>
                      </TableHead>
                      <TableHead className="text-center">Out of Organization</TableHead>
                    </>
                  )}
                  <TableHead className="text-center">Verification %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {viewMode === "standard" ? (
                  aggregatedData.map((item, index) => {
                    const rate = item.totalProfiles > 0
                      ? Math.round((item.verifiedProfiles / item.totalProfiles) * 100)
                      : 0;
                    return (
                      <TableRow key={index} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{item.unitName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.cluster}</Badge>
                        </TableCell>
                        <TableCell className="text-center font-semibold">{item.totalProfiles}</TableCell>
                        <TableCell className="text-center text-green-600">{item.verifiedProfiles}</TableCell>
                        <TableCell className="text-center text-yellow-600">{item.unverifiedProfiles}</TableCell>
                        <TableCell className="text-center text-blue-600">{item.needAccess}</TableCell>
                        <TableCell className="text-center text-gray-600">{item.outOfOrganization}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center gap-2">
                            <Progress value={rate} className="h-2 w-16" />
                            <span className="text-xs font-medium">{rate}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  aggregatedRealtimeData.map((item, index) => {
                    const rate = item.totalProfiles > 0
                      ? Math.round((item.verifiedProfiles / item.totalProfiles) * 100)
                      : 0;
                    return (
                      <TableRow key={index} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{item.unitName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.cluster}</Badge>
                        </TableCell>
                        <TableCell className="text-center font-semibold">{item.totalProfiles}</TableCell>
                        <TableCell className="text-center text-green-600">{item.verifiedProfiles}</TableCell>
                        <TableCell className="text-center text-yellow-600">{item.unverifiedProfiles + item.suspendedProfiles}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center gap-2">
                            <Progress value={rate} className="h-2 w-16" />
                            <span className="text-xs font-medium">{rate}%</span>
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
      <Dialog open={exportDataCtx.isOpen} onOpenChange={(isOpen) => setExportDataCtx(prev => ({ ...prev, isOpen }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Data</DialogTitle>
            <DialogDescription>
              You are about to export {exportDataCtx.type} data to Excel.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDataCtx({ isOpen: false, type: null })}>Cancel</Button>
            <Button onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" /> Export to Excel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
};
