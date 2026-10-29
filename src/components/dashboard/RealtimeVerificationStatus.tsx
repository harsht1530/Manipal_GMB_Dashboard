import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  CheckCircle2,
  Copy,
  Clock,
  Ban,
  CircleSlash,
  Tag,
  Download,
  Loader2,
  Hourglass,
  Wand2,
  PauseCircle,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { VerificationData, fetchRealtimeExport, RealtimeFilters } from "@/hooks/useRealtimeData";

interface Props {
  data?: VerificationData;
  loading?: boolean;
  filters: RealtimeFilters;
}

const PAGE_SIZE = 5;

const TILES = [
  {
    key: "total" as const,
    label: "Total Profiles",
    hint: "All folders",
    icon: Building2,
    tone: "bg-muted/60 border-border",
    value: "text-foreground",
    iconTone: "text-muted-foreground",
    export: "",
  },
  {
    key: "verified" as const,
    label: "Verified",
    hint: "has voice of merchant",
    icon: CheckCircle2,
    tone: "bg-emerald-500/10 border-emerald-500/20",
    value: "text-emerald-600",
    iconTone: "text-emerald-600",
    export: "verified",
  },
  {
    key: "duplicates" as const,
    label: "Duplicates",
    hint: "also counted in Unverified",
    icon: Copy,
    tone: "bg-violet-500/10 border-violet-500/20",
    value: "text-violet-600",
    iconTone: "text-violet-600",
    export: "duplicate",
  },
  {
    key: "unverified" as const,
    label: "Unverified",
    hint: "incl. suspended + duplicates",
    icon: Clock,
    tone: "bg-amber-500/10 border-amber-500/20",
    value: "text-amber-600",
    iconTone: "text-amber-600",
    export: "unverified",
  },
  {
    key: "suspended" as const,
    label: "Suspended",
    hint: "also counted in Unverified",
    icon: Ban,
    tone: "bg-rose-500/10 border-rose-500/20",
    value: "text-rose-600",
    iconTone: "text-rose-600",
    export: "suspended",
  },
  {
    key: "pendingReview" as const,
    label: "Pending Review",
    hint: "awaiting Google",
    icon: Hourglass,
    tone: "bg-sky-500/10 border-sky-500/20",
    value: "text-sky-600",
    iconTone: "text-sky-600",
    export: "pending-review",
  },
  {
    key: "googleUpdates" as const,
    label: "Google Updates",
    hint: "edits Google suggests",
    icon: Wand2,
    tone: "bg-blue-500/10 border-blue-500/20",
    value: "text-blue-600",
    iconTone: "text-blue-600",
    export: "google-updates",
  },
  {
    key: "temporarilyClosed" as const,
    label: "Temporarily Closed",
    hint: "openInfo status",
    icon: PauseCircle,
    tone: "bg-orange-500/10 border-orange-500/20",
    value: "text-orange-600",
    iconTone: "text-orange-600",
    export: "temporarily-closed",
  },
  {
    key: "permanentlyClosed" as const,
    label: "Permanently Closed",
    hint: "openInfo status",
    icon: CircleSlash,
    tone: "bg-slate-500/10 border-slate-500/20",
    value: "text-slate-600",
    iconTone: "text-slate-600",
    export: "closed",
  },
  {
    key: "missingStoreCodes" as const,
    label: "Missing Store Codes",
    hint: "no storeCode",
    icon: Tag,
    tone: "bg-yellow-500/10 border-yellow-500/20",
    value: "text-yellow-600",
    iconTone: "text-yellow-600",
    export: "missing-store-code",
  },
];

/**
 * Live mirror of the dashboard's Profile Verification Status, read straight from the Google
 * API snapshot. Total = Verified + Unverified; suspended and duplicate listings are already
 * inside Unverified, so the tiles never double-count.
 */
export const RealtimeVerificationStatus = ({ data, loading, filters }: Props) => {
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState<string | null>(null);

  const units = data?.units ?? [];
  const totals = data?.totals;
  const pageCount = Math.max(1, Math.ceil(units.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = useMemo(
    () => units.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [units, safePage]
  );

  const yesNo = (value?: boolean) => (value ? "Yes" : "No");

  /**
   * Everything the realtime collections hold for the selected tile: the full profile record
   * plus its performance. Performance covers the dashboard's date range when one is picked,
   * and the whole stored history otherwise.
   */
  const exportProfiles = async (status: string, label: string) => {
    try {
      setExporting(status || "all");
      const data = await fetchRealtimeExport({
        clusters: filters?.clusters,
        units: filters?.units,
        from: filters?.from,
        to: filters?.to,
        status,
      });
      if (!data.rows.length) {
        toast.info(`No profiles to export for ${label}.`);
        return;
      }

      const profileSheet = XLSX.utils.json_to_sheet(
        data.rows.map((row) => ({
          "Business Name": row.title || "",
          "Store Code": row.storeCode || "",
          "Primary Folder": row.unitName || "",
          "All Folders": (row.folders || []).join(" | "),
          Cluster: row.cluster || "",
          Department: row.department || "",
          "Primary Category": row.primaryCategory || "",
          Labels: (row.labels || []).join(" | "),
          // The single answer to "what is this profile's status", then one column per tile so
          // any export can be reconciled against the numbers on screen.
          "Verification Status": row.verificationStatus || row.statusType || "",
          Verified: yesNo(row.tiles?.verified),
          Unverified: yesNo(row.tiles?.unverified),
          Duplicate: yesNo(row.tiles?.duplicate),
          Suspended: yesNo(row.tiles?.suspended),
          "Pending Review": yesNo(row.tiles?.pendingReview),
          "Google Updates": yesNo(row.tiles?.googleUpdates),
          "Temporarily Closed": yesNo(row.tiles?.temporarilyClosed),
          "Permanently Closed": yesNo(row.tiles?.permanentlyClosed),
          "Missing Store Code": yesNo(row.tiles?.missingStoreCode),
          "Verification State": row.verificationState || "",
          "Publish Status": row.publishStatus || "",
          "Duplicate Of": row.duplicateOf || "",
          "Open Status (Owner)": row.openStatus || "",
          "Open Status (Google)": row.googleOpenStatus || "",
          "Google Update Fields": (row.googleUpdateFields || []).join(" | "),
          Phone: row.phone || "",
          Website: row.website || "",
          Address: row.address || "",
          "Maps URL": row.mapsUri || "",
          Account: row.accountName || "",
          "Search Mobile": row.performance.mobileSearch,
          "Search Desktop": row.performance.desktopSearch,
          "Maps Mobile": row.performance.mobileMaps,
          "Maps Desktop": row.performance.desktopMaps,
          "Total Searches": row.performance.totalSearches,
          "Total Maps": row.performance.totalMaps,
          "Total Impressions": row.performance.totalImpressions,
          Calls: row.performance.callClicks,
          "Website Clicks": row.performance.websiteClicks,
          Directions: row.performance.directionRequests,
          "Total Interactions": row.performance.totalInteractions,
          "Months With Data": row.monthsCovered,
          "Location ID": row.locationId,
          "Last Synced": row.lastSyncedAt ? new Date(row.lastSyncedAt).toLocaleString("en-IN") : "",
        }))
      );

      // Month by month, so the totals on the first sheet can always be traced back.
      const monthlySheet = XLSX.utils.json_to_sheet(
        data.rows.flatMap((row) =>
          row.months.map((month) => ({
            "Business Name": row.title || "",
            "Store Code": row.storeCode || "",
            "Primary Folder": row.unitName || "",
            Cluster: row.cluster || "",
            "Verification Status": row.verificationStatus || row.statusType || "",
            Month: month.label,
            "Search Mobile": month.mobileSearch,
            "Search Desktop": month.desktopSearch,
            "Maps Mobile": month.mobileMaps,
            "Maps Desktop": month.desktopMaps,
            "Total Searches": month.totalSearches,
            "Total Maps": month.totalMaps,
            "Total Impressions": month.totalImpressions,
            Calls: month.callClicks,
            "Website Clicks": month.websiteClicks,
            Directions: month.directionRequests,
            "Total Interactions": month.totalInteractions,
            "Location ID": row.locationId,
          }))
        )
      );

      const period = data.overall
        ? data.monthsCovered
          ? `Overall (${data.monthsCovered.first} to ${data.monthsCovered.last})`
          : "Overall"
        : `${data.range?.from} to ${data.range?.to}`;

      const infoSheet = XLSX.utils.json_to_sheet([
        { Field: "Export", Value: label },
        { Field: "Performance period", Value: period },
        { Field: "Folder filter", Value: filters?.units?.length ? filters.units.join(", ") : "All folders" },
        { Field: "Profiles", Value: data.rows.length },
        { Field: "Generated", Value: new Date(data.generatedAt).toLocaleString("en-IN") },
        { Field: "Source", Value: "Google Business Profile API (realtime collections)" },
      ]);

      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, profileSheet, label.slice(0, 28) || "Profiles");
      if (monthlySheet["!ref"]) XLSX.utils.book_append_sheet(book, monthlySheet, "Monthly Performance");
      XLSX.utils.book_append_sheet(book, infoSheet, "About");
      XLSX.writeFile(book, `Realtime_${label.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setExporting(null);
    }
  };

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Profile Verification Status</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Live from the Google Business Profile API</p>
          </div>
          {totals && (
            <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-600">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-rose-500" />
              {totals.needAction.toLocaleString("en-IN")} need action
            </Badge>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {TILES.map((tile) => {
            const Icon = tile.icon;
            const value = totals ? totals[tile.key] : 0;
            const isExporting = exporting === (tile.export || "all");
            return (
              <button
                key={tile.key}
                type="button"
                onClick={() => exportProfiles(tile.export, tile.label)}
                disabled={loading || !totals}
                className={`rounded-xl border p-3 text-left transition-all hover:ring-2 hover:ring-primary/30 disabled:cursor-default disabled:hover:ring-0 ${tile.tone}`}
                title={`Export the ${tile.label} list to Excel`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="rounded-lg bg-background/70 p-1.5">
                    <Icon className={`h-4 w-4 ${tile.iconTone}`} />
                  </span>
                  {isExporting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  ) : (
                    <Download className="h-3.5 w-3.5 text-muted-foreground/40" />
                  )}
                </div>
                {loading ? (
                  <Skeleton className="h-7 w-16" />
                ) : (
                  <p className={`text-2xl font-bold ${tile.value}`}>{value.toLocaleString("en-IN")}</p>
                )}
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {tile.label}
                </p>
                <p className="text-[10px] text-muted-foreground/70">{tile.hint}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 text-xs leading-relaxed text-muted-foreground">
          <strong className="text-foreground">How to read these numbers:</strong> Total = Verified + Unverified,
          exactly like Google shows. Suspended and Duplicate profiles are already included inside Unverified here.
          <strong className="text-foreground">
            {" "}
            In the Excel export the same profiles are split into separate columns (Need to verify + Suspended +
            Duplicate) so teams can act on each group
          </strong>{" "}
          — add those three Excel columns together and it matches Unverified above. Nothing is missing or
          double-counted.
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[11px] uppercase tracking-wide">Unit Name</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wide">Total</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wide text-emerald-600">Verified</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wide text-amber-600">Unverified</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wide text-rose-600">Suspended</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wide text-violet-600">Duplicates</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wide text-blue-600">Google Updates</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wide">Temp. Closed</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wide">Permanently Closed</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wide">Missing Store Codes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading &&
                Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={10}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))}

              {!loading && visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                    No profiles synced yet. Connect a Google account in Settings and run a sync.
                  </TableCell>
                </TableRow>
              )}

              {!loading &&
                visible.map((unit) => (
                  <TableRow key={`${unit.cluster}-${unit.unitName}`} className="hover:bg-muted/40">
                    <TableCell className="font-medium">{unit.unitName}</TableCell>
                    <TableCell className="text-center font-semibold">{unit.total.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-center font-semibold text-emerald-600">{unit.verified}</TableCell>
                    <TableCell className="text-center font-semibold text-amber-600">{unit.unverified}</TableCell>
                    <TableCell className="text-center">
                      <Pill value={unit.suspended} tone="rose" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Pill value={unit.duplicates} tone="violet" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Pill value={unit.googleUpdates} tone="blue" />
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">{unit.temporarilyClosed}</TableCell>
                    <TableCell className="text-center text-muted-foreground">{unit.permanentlyClosed}</TableCell>
                    <TableCell className="text-center">
                      <Pill value={unit.missingStoreCodes} tone="yellow" />
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {units.length === 0
              ? "No units"
              : `Showing ${safePage * PAGE_SIZE + 1}–${Math.min((safePage + 1) * PAGE_SIZE, units.length)} of ${units.length}`}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
              ← Prev
            </Button>
            <span className="min-w-[48px] text-center font-medium">
              {safePage + 1} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage(safePage + 1)}
            >
              Next →
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const Pill = ({ value, tone }: { value: number; tone: "rose" | "violet" | "yellow" | "blue" }) => {
  if (!value) return <span className="text-muted-foreground/50">0</span>;
  const tones = {
    rose: "bg-rose-500/10 text-rose-600 border-rose-500/20",
    violet: "bg-violet-500/10 text-violet-600 border-violet-500/20",
    yellow: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
    blue: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  };
  return (
    <span className={`inline-flex h-6 min-w-[28px] items-center justify-center rounded-full border px-2 text-xs font-semibold ${tones[tone]}`}>
      {value}
    </span>
  );
};
