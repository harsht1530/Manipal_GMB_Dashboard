import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { RealtimeVerificationStatus } from "@/components/dashboard/RealtimeVerificationStatus";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import {
  Smartphone,
  Monitor,
  Map,
  MapPin,
  Phone,
  Navigation,
  Globe,
  Search,
  Calendar as CalendarIcon,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import {
  useRealtimeMeta,
  useRealtimeOverview,
  useRealtimeVerification,
  MonthPoint,
} from "@/hooks/useRealtimeData";

const SERIES_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#db2777", "#7c3aed", "#0891b2", "#dc2626"];

const trendChart = (title: string, categories: string[], series: { name: string; data: number[] }[]): Highcharts.Options => ({
  chart: { type: "areaspline", height: 300, backgroundColor: "transparent", style: { fontFamily: "inherit" } },
  title: { text: undefined },
  credits: { enabled: false },
  xAxis: {
    categories,
    lineColor: "hsl(var(--border))",
    tickColor: "hsl(var(--border))",
    labels: { style: { fontSize: "11px", color: "hsl(var(--muted-foreground))" } },
  },
  yAxis: {
    title: { text: undefined },
    gridLineColor: "hsl(var(--border))",
    labels: { style: { fontSize: "11px", color: "hsl(var(--muted-foreground))" } },
  },
  legend: { itemStyle: { fontSize: "11px", color: "hsl(var(--foreground))" } },
  tooltip: { shared: true, valueDecimals: 0 },
  plotOptions: {
    areaspline: { fillOpacity: 0.08, marker: { enabled: true, radius: 3 }, lineWidth: 2 },
  },
  series: series.map((s, i) => ({ ...s, type: "areaspline", color: SERIES_COLORS[i % SERIES_COLORS.length] })),
});

const pctChange = (current: number, previous: number) => {
  if (!previous) return undefined;
  return Number((((current - previous) / previous) * 100).toFixed(1));
};

const relativeTime = (iso?: string | null) => {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
};

/**
 * Live Google Business Profile analytics. Reads only the realtime collections, which the
 * backend refreshes at 07:00 and 19:00 - the monthly dashboard at "/" is untouched.
 */
const RealtimeDashboard = () => {
  const [folder, setFolder] = useState("ALL");
  const [range, setRange] = useState<DateRange | undefined>(undefined);

  const iso = (d: Date) => format(d, "yyyy-MM-dd");

  const filters = useMemo(
    () => ({
      units: folder === "ALL" ? [] : [folder],
      months: 6,
      // Only a complete range narrows the window; otherwise the default 6 months applies.
      from: range?.from && range?.to ? iso(range.from) : undefined,
      to: range?.from && range?.to ? iso(range.to) : undefined,
    }),
    [folder, range]
  );

  const meta = useRealtimeMeta();
  const overview = useRealtimeOverview(filters);
  const verification = useRealtimeVerification(filters);

  const data = overview.data;
  const loading = overview.isLoading;
  const current = data?.current;
  const previous = data?.previous;

  const series: MonthPoint[] = data?.series ?? [];
  const categories = series.map((point) => point.label);

  const impressionsChart = trendChart("Impressions", categories, [
    { name: "Search Mobile", data: series.map((p) => p.mobileSearch) },
    { name: "Search Desktop", data: series.map((p) => p.desktopSearch) },
    { name: "Maps Mobile", data: series.map((p) => p.mobileMaps) },
    { name: "Maps Desktop", data: series.map((p) => p.desktopMaps) },
  ]);

  const actionsChart = trendChart("Actions", categories, [
    { name: "Phone Calls", data: series.map((p) => p.callClicks) },
    { name: "Website Clicks", data: series.map((p) => p.websiteClicks) },
    { name: "Directions", data: series.map((p) => p.directionRequests) },
  ]);

  return (
    <DashboardLayout
      title="Realtime Dashboard"
      subtitle="Live Google Business Profile data"
    >
      <div className="space-y-6">
        {/* Filters: folder + date range */}
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 p-3">
            <Select value={folder} onValueChange={setFolder}>
              <SelectTrigger className="h-9 w-[220px] shrink-0 bg-muted/20 border-primary/5 text-xs font-medium">
                <SelectValue placeholder="Folder" />
              </SelectTrigger>
              <SelectContent className="max-h-[320px]">
                <SelectItem value="ALL">All folders</SelectItem>
                {(meta.data?.units ?? []).map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="realtime-date-range"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-9 justify-start text-left font-normal bg-muted/20 border-primary/5 text-xs relative pr-7 w-[190px] shrink-0",
                    !range?.from && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate text-xs font-medium">
                    {range?.from ? (
                      range.to ? (
                        <>
                          {format(range.from, "dd MMM yy")} - {format(range.to, "dd MMM yy")}
                        </>
                      ) : (
                        format(range.from, "dd MMM yy")
                      )
                    ) : (
                      <span>Last 6 months</span>
                    )}
                  </span>
                  {range?.from && (
                    <div
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRange(undefined);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </div>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 shadow-lg border-border" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={range?.from ?? new Date()}
                  selected={range}
                  onSelect={setRange}
                  numberOfMonths={2}
                  disabled={{ after: new Date() }}
                />
              </PopoverContent>
            </Popover>

            <span className="ml-auto text-xs text-muted-foreground">
              {data?.range
                ? `${format(new Date(data.range.from), "dd MMM yyyy")} – ${format(new Date(data.range.to), "dd MMM yyyy")}`
                : ""}
              {meta.data?.lastSyncAt ? ` · synced ${relativeTime(meta.data.lastSyncAt)}` : ""}
            </span>
          </CardContent>
        </Card>

        {/* Verification status - live */}
        <RealtimeVerificationStatus data={verification.data} loading={verification.isLoading} filters={filters} />

        {/* Headline metrics - same set as the monthly dashboard */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[132px] w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard title="Search Mobile" value={data?.totals.mobileSearch ?? 0} change={pctChange(current?.mobileSearch ?? 0, previous?.mobileSearch ?? 0)} icon={Smartphone} delay={0} />
            <MetricCard title="Search Desktop" value={data?.totals.desktopSearch ?? 0} change={pctChange(current?.desktopSearch ?? 0, previous?.desktopSearch ?? 0)} icon={Monitor} delay={50} />
            <MetricCard title="Maps Mobile" value={data?.totals.mobileMaps ?? 0} change={pctChange(current?.mobileMaps ?? 0, previous?.mobileMaps ?? 0)} icon={Map} delay={100} />
            <MetricCard title="Maps Desktop" value={data?.totals.desktopMaps ?? 0} change={pctChange(current?.desktopMaps ?? 0, previous?.desktopMaps ?? 0)} icon={MapPin} delay={150} />
            <MetricCard title="Phone Calls" value={data?.totals.callClicks ?? 0} change={pctChange(current?.callClicks ?? 0, previous?.callClicks ?? 0)} icon={Phone} delay={200} />
            <MetricCard title="Directions" value={data?.totals.directionRequests ?? 0} change={pctChange(current?.directionRequests ?? 0, previous?.directionRequests ?? 0)} icon={Navigation} delay={250} />
            <MetricCard title="Website Clicks" value={data?.totals.websiteClicks ?? 0} change={pctChange(current?.websiteClicks ?? 0, previous?.websiteClicks ?? 0)} icon={Globe} delay={300} />
            <MetricCard title="Total Searches" value={data?.totals.totalImpressions ?? 0} change={pctChange(current?.totalImpressions ?? 0, previous?.totalImpressions ?? 0)} icon={Search} delay={350} />
          </div>
        )}

        {/* Trends */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Impressions by surface</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-[300px] w-full" /> : <HighchartsReact highcharts={Highcharts} options={impressionsChart} />}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customer actions</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-[300px] w-full" /> : <HighchartsReact highcharts={Highcharts} options={actionsChart} />}
            </CardContent>
          </Card>
        </div>

        {/* Per-unit performance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance by unit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[420px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unit Name</TableHead>
                    <TableHead>Cluster</TableHead>
                    <TableHead className="text-center">Profiles</TableHead>
                    <TableHead className="text-right">Search</TableHead>
                    <TableHead className="text-right">Maps</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead className="text-right">Website</TableHead>
                    <TableHead className="text-right">Directions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading &&
                    Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={8}>
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                      </TableRow>
                    ))}
                  {!loading && (data?.units?.length ?? 0) === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                        No performance data yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading &&
                    data?.units.map((unit) => (
                      <TableRow key={`${unit.cluster}-${unit.unitName}`} className="hover:bg-muted/40">
                        <TableCell className="font-medium">{unit.unitName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{unit.cluster}</Badge>
                        </TableCell>
                        <TableCell className="text-center">{unit.profiles}</TableCell>
                        <TableCell className="text-right">{unit.totalSearches.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right">{unit.totalMaps.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right">{unit.callClicks.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right">{unit.websiteClicks.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right">{unit.directionRequests.toLocaleString("en-IN")}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Top profiles */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 10 profiles by impressions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business Name</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Impressions</TableHead>
                  <TableHead className="text-right">Interactions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={4}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))}
                {!loading &&
                  data?.topProfiles.map((profile) => (
                    <TableRow key={profile.locationId}>
                      <TableCell className="font-medium">{profile.title}</TableCell>
                      <TableCell className="text-muted-foreground">{profile.unitName}</TableCell>
                      <TableCell className="text-right font-semibold">{profile.totalImpressions.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right">{profile.totalInteractions.toLocaleString("en-IN")}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default RealtimeDashboard;
