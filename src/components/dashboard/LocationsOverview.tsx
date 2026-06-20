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
import { CheckCircle, XCircle, AlertCircle, Building2, Info } from "lucide-react";
import { LocationData, parseDateString, InsightData } from "@/hooks/useMongoData";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface LocationsOverviewProps {
  data: LocationData[];
  apiInsights?: InsightData[];
  selectedMonths: string[];
}

export const LocationsOverview = ({ data, apiInsights = [], selectedMonths }: LocationsOverviewProps) => {
  const [viewMode, setViewMode] = useState<"standard" | "realtime">("realtime");

  const getLatestMonth = (dataset: any[]) => {
    if (selectedMonths.length === 0 || selectedMonths.includes("All")) {
      if (dataset.length > 0) {
          const hasValidDates = dataset.some(d => d.date);
          if (hasValidDates) {
            const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const sortedData = [...dataset].sort((a, b) => {
              const getYear = (dateStr: string) => {
                if (!dateStr) return 0;
                const d = parseDateString(dateStr);
                if (!isNaN(d.getFullYear())) return d.getFullYear();
                const parts = dateStr.split('-');
                if (parts.length === 3 && parts[2].length === 4) return parseInt(parts[2]);
                return 0;
              };
              
              const yearA = getYear(a.date);
              const yearB = getYear(b.date);
              
              if (yearA !== yearB) return yearB - yearA;
              return monthOrder.indexOf(b.month) - monthOrder.indexOf(a.month);
            });
            return sortedData[0].month;
          }
          return dataset[0].month;
      }
      return "Jan";
    }
    const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return selectedMonths.sort((a, b) => monthOrder.indexOf(b) - monthOrder.indexOf(a))[0];
  };

  const latestMonth = getLatestMonth(data);
  const filteredData = data.filter(d => d.month === latestMonth);

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

  const verificationRate = totals.totalProfiles > 0
    ? Math.round((totals.verifiedProfiles / totals.totalProfiles) * 100)
    : 0;

  // Realtime aggregation
  const realtimeLatestMonth = getLatestMonth(apiInsights);
  const filteredApiInsights = apiInsights.filter(d => d.month === realtimeLatestMonth);
  
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
              Realtime API
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
                <p className="text-2xl font-bold text-foreground">{totals.totalProfiles}</p>
                <p className="text-xs text-muted-foreground">Total Profiles</p>
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
                <p className="text-2xl font-bold text-green-600">{totals.verifiedProfiles}</p>
                <p className="text-xs text-muted-foreground">Verified</p>
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
                <p className="text-2xl font-bold text-yellow-600">{totals.unverifiedProfiles}</p>
                <p className="text-xs text-muted-foreground">Unverified</p>
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
                <p className="text-2xl font-bold text-blue-600">{totals.needAccess}</p>
                <p className="text-xs text-muted-foreground">Need Access</p>
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
                <p className="text-2xl font-bold text-red-600">{totals.notInterested}</p>
                <p className="text-xs text-muted-foreground">Not Interested</p>
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
                <p className="text-2xl font-bold text-gray-600">{totals.outOfOrganization}</p>
                <p className="text-xs text-muted-foreground">Out of Organization</p>
              </div>
            </div>
        ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg group relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="absolute right-2 top-2 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity">
                      <Info className="h-4 w-4" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Total number of profiles from Realtime API</p>
                  </TooltipContent>
                </Tooltip>
                <p className="text-2xl font-bold text-foreground">{realtimeTotals.totalProfiles}</p>
                <p className="text-xs text-muted-foreground">Total Profiles</p>
              </div>
              <div className="text-center p-3 bg-green-500/10 rounded-lg group relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="absolute right-2 top-2 text-green-600/50 group-hover:opacity-100 transition-opacity">
                      <Info className="h-4 w-4" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Profiles that are verified and active</p>
                  </TooltipContent>
                </Tooltip>
                <p className="text-2xl font-bold text-green-600">{realtimeTotals.verifiedProfiles}</p>
                <p className="text-xs text-muted-foreground">Verified and Active</p>
              </div>
              <div className="text-center p-3 bg-yellow-500/10 rounded-lg group relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="absolute right-2 top-2 text-yellow-600/50 group-hover:opacity-100 transition-opacity">
                      <Info className="h-4 w-4" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Profiles that are unverified, suspended, or have other issues</p>
                  </TooltipContent>
                </Tooltip>
                <p className="text-2xl font-bold text-yellow-600">{realtimeTotals.unverifiedProfiles + realtimeTotals.suspendedProfiles}</p>
                <p className="text-xs text-muted-foreground">Unverified and others</p>
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
    </TooltipProvider>
  );
};
