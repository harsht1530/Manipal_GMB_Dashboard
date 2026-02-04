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
import { CheckCircle, XCircle, AlertCircle, Building2 } from "lucide-react";
import { LocationData } from "@/data/dummyData";

interface LocationsOverviewProps {
  data: LocationData[];
  selectedMonths: string[];
}

export const LocationsOverview = ({ data, selectedMonths }: LocationsOverviewProps) => {
  // Get the latest month from selected months or all data
  const getLatestMonth = () => {
    const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    if (selectedMonths.length === 0 || selectedMonths.includes("All")) {
      const availableMonths = [...new Set(data.map(d => d.month))];
      return availableMonths.sort((a, b) => monthOrder.indexOf(b) - monthOrder.indexOf(a))[0];
    }
    return selectedMonths.sort((a, b) => monthOrder.indexOf(b) - monthOrder.indexOf(a))[0];
  };

  const latestMonth = getLatestMonth();
  const filteredData = data.filter(d => d.month === latestMonth);

  // Aggregate by unit name
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
  }, [] as {
    unitName: string;
    cluster: string;
    totalProfiles: number;
    verifiedProfiles: number;
    unverifiedProfiles: number;
    needAccess: number;
    notInterested: number;
    outOfOrganization: number;
  }[]);

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

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-semibold">Profile Verification Status</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            Showing: {latestMonth}
          </Badge>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold text-foreground">{totals.totalProfiles}</p>
            <p className="text-xs text-muted-foreground">Total Profiles</p>
          </div>
          <div className="text-center p-3 bg-green-500/10 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{totals.verifiedProfiles}</p>
            <p className="text-xs text-muted-foreground">Verified</p>
          </div>
          <div className="text-center p-3 bg-yellow-500/10 rounded-lg">
            <p className="text-2xl font-bold text-yellow-600">{totals.unverifiedProfiles}</p>
            <p className="text-xs text-muted-foreground">Unverified</p>
          </div>
          <div className="text-center p-3 bg-blue-500/10 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">{totals.needAccess}</p>
            <p className="text-xs text-muted-foreground">Need Access</p>
          </div>
          <div className="text-center p-3 bg-red-500/10 rounded-lg">
            <p className="text-2xl font-bold text-red-600">{totals.notInterested}</p>
            <p className="text-xs text-muted-foreground">Not Interested</p>
          </div>
          <div className="text-center p-3 bg-gray-500/10 rounded-lg">
            <p className="text-2xl font-bold text-gray-600">{totals.outOfOrganization}</p>
            <p className="text-xs text-muted-foreground">Out of Organization</p>
          </div>
        </div>

        {/* Overall Verification Rate */}
        <div className="mt-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Overall Verification Rate</span>
            <span className="font-semibold text-primary">{verificationRate}%</span>
          </div>
          <Progress value={verificationRate} className="h-2" />
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
                    Verified
                  </div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <XCircle className="h-3 w-3 text-yellow-500" />
                    Unverified
                  </div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <AlertCircle className="h-3 w-3 text-blue-500" />
                    Need Access
                  </div>
                </TableHead>
                <TableHead className="text-center">Out of Organization</TableHead>
                <TableHead className="text-center">Verification %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aggregatedData.map((item, index) => {
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
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
