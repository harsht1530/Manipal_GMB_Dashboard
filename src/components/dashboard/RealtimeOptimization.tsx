import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Image,
  FileText,
  Clock,
  ListChecks,
  Phone,
  Globe,
  MessageCircle,
  CalendarCheck,
  Star,
  Download,
  Loader2,
  Gauge,
  AlertTriangle,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  RealtimeFilters,
  OptimizationCheckId,
  OptimizationRow,
  useRealtimeOptimization,
} from "@/hooks/useRealtimeData";

interface Props {
  filters: RealtimeFilters;
}

/**
 * The nine checks in the order the report lists them. Labels and totals come from the
 * backend - this only decides the icon and the one-line explanation of what counts as done,
 * so the two can never disagree about whether a listing passed.
 */
const CHECK_META: Record<OptimizationCheckId, { icon: typeof Image; hint: string }> = {
  coverLogo: { icon: Image, hint: "Both a cover photo and a logo are uploaded" },
  description: { icon: FileText, hint: "The business description is filled in" },
  hours: { icon: Clock, hint: "At least one opening period is set" },
  services: { icon: ListChecks, hint: "At least one service is listed" },
  phone: { icon: Phone, hint: "A primary phone number is set" },
  website: { icon: Globe, hint: "A website URL is set" },
  whatsapp: { icon: MessageCircle, hint: "A WhatsApp chat link is set on the listing" },
  appointment: { icon: CalendarCheck, hint: "An appointment link is set on the listing" },
  review: { icon: Star, hint: "Google gives the listing a review link" },
};

const CHECK_ORDER: OptimizationCheckId[] = [
  "coverLogo",
  "description",
  "hours",
  "services",
  "phone",
  "website",
  "whatsapp",
  "appointment",
  "review",
];

const yesNo = (value: boolean) => (value ? "Yes" : "No");

const toneFor = (percent: number) => {
  if (percent >= 90) return "text-emerald-600";
  if (percent >= 60) return "text-amber-600";
  return "text-rose-600";
};

export const RealtimeOptimization = ({ filters }: Props) => {
  const { data, isLoading, error } = useRealtimeOptimization(filters);
  const [exporting, setExporting] = useState(false);

  const labelOf = (id: OptimizationCheckId) =>
    data?.checks.find((c) => c.id === id)?.label ?? id;

  /** One row per listing: who it is, then pass/fail and what is actually there per check. */
  const reportRow = (row: OptimizationRow) => {
    const out: Record<string, string | number> = {
      "Business Name": row.title,
      "Store Code": row.storeCode,
      "Primary Folder": row.unitName,
      "All Folders": (row.folders || []).join(" | "),
      Cluster: row.cluster,
      Department: row.department,
      "Primary Category": row.primaryCategory,
      "Verification Status": row.verificationStatus,
      Score: `${row.score} of ${row.total}`,
      "Score %": row.total ? Math.round((row.score / row.total) * 100) : 0,
    };
    CHECK_ORDER.forEach((id) => {
      const label = labelOf(id);
      out[label] = yesNo(row.checks[id]);
      out[`${label} - Detail`] = row.details[id] || "";
    });
    out["Maps URL"] = row.mapsUri;
    out["Location ID"] = row.locationId;
    out["Photos & Links Checked"] = row.checkedAt
      ? new Date(row.checkedAt).toLocaleString("en-IN")
      : "Not checked yet";
    out["Check Error"] = row.error || "";
    return out;
  };

  const handleDownload = () => {
    if (!data?.rows.length) {
      toast.info("No profiles to report on for this filter.");
      return;
    }
    try {
      setExporting(true);
      const book = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        book,
        XLSX.utils.json_to_sheet(data.rows.map(reportRow)),
        "Optimization"
      );

      // The same per-check totals as the card, so the sheet can be read on its own.
      XLSX.utils.book_append_sheet(
        book,
        XLSX.utils.json_to_sheet(
          data.checks.map((check) => ({
            Check: check.label,
            Complete: check.complete,
            Missing: check.missing,
            "Complete %": check.percent,
            "Counts as done": CHECK_META[check.id]?.hint || "",
          }))
        ),
        "Summary"
      );

      // Where the gaps sit, so a folder owner can be handed their own list.
      const byFolder = new Map<string, { folder: string; profiles: number; score: number }>();
      data.rows.forEach((row) => {
        const key = row.unitName || "Unassigned";
        const entry = byFolder.get(key) || { folder: key, profiles: 0, score: 0 };
        entry.profiles += 1;
        entry.score += row.score;
        byFolder.set(key, entry);
      });
      XLSX.utils.book_append_sheet(
        book,
        XLSX.utils.json_to_sheet(
          [...byFolder.values()]
            .map((e) => ({
              Folder: e.folder,
              Profiles: e.profiles,
              "Average Score": Math.round((e.score / e.profiles) * 100) / 100,
              "Average %": Math.round((e.score / (e.profiles * data.maxScore)) * 1000) / 10,
            }))
            .sort((a, b) => a["Average %"] - b["Average %"])
        ),
        "By Folder"
      );

      XLSX.utils.book_append_sheet(
        book,
        XLSX.utils.json_to_sheet([
          { Field: "Report", Value: "Profile optimization" },
          { Field: "Profiles", Value: data.total },
          { Field: "Checks per profile", Value: data.maxScore },
          { Field: "Average score", Value: `${data.averageScore} of ${data.maxScore}` },
          { Field: "Fully optimized", Value: data.fullyOptimized },
          {
            Field: "Awaiting first photo/link check",
            Value: data.awaitingFirstCheck,
          },
          {
            Field: "Folder filter",
            Value: filters?.units?.length ? filters.units.join(", ") : "All folders",
          },
          { Field: "Generated", Value: new Date(data.generatedAt).toLocaleString("en-IN") },
          { Field: "Source", Value: "Google Business Profile API (realtime collections)" },
          {
            Field: "Note",
            Value:
              "Cover photo, logo, WhatsApp and appointment link are read from Google once a day; the other five checks come from every sync.",
          },
        ]),
        "About"
      );

      XLSX.writeFile(book, `Realtime_Optimization_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 pb-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Gauge className="h-4 w-4 text-primary" />
            Profile Optimization
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            How complete each listing's content is, across nine checks. Live from Google.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <Badge variant="secondary" className="font-normal">
              Average {data.averageScore} / {data.maxScore}
            </Badge>
          )}
          <Button
            size="sm"
            onClick={handleDownload}
            disabled={exporting || isLoading || !data?.rows.length}
            className="gap-2"
            title="Download the optimization report for every profile in this filter"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download Report
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <p className="text-sm text-destructive">{(error as Error).message}</p>
        )}

        {isLoading && (
          <div className="space-y-3">
            {CHECK_ORDER.map((id) => (
              <Skeleton key={id} className="h-10 w-full" />
            ))}
          </div>
        )}

        {data && !isLoading && (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Profiles in report</p>
                <p className="text-xl font-semibold text-foreground">{data.total.toLocaleString("en-IN")}</p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Fully optimized</p>
                <p className="text-xl font-semibold text-emerald-600">
                  {data.fullyOptimized.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Average score</p>
                <p className="text-xl font-semibold text-foreground">
                  {data.averageScore} <span className="text-sm font-normal text-muted-foreground">/ {data.maxScore}</span>
                </p>
              </div>
            </div>

            {data.awaitingFirstCheck > 0 && (
              <p className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50/60 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {data.awaitingFirstCheck.toLocaleString("en-IN")} profile
                {data.awaitingFirstCheck === 1 ? " has" : "s have"} not had photos and links read from
                Google yet, so the cover photo, logo, WhatsApp and appointment checks show as missing
                for {data.awaitingFirstCheck === 1 ? "it" : "them"}. The next sync fills these in.
              </p>
            )}

            <div className="space-y-2.5">
              {CHECK_ORDER.map((id) => {
                const check = data.checks.find((c) => c.id === id);
                if (!check) return null;
                const Icon = CHECK_META[id].icon;
                return (
                  <div key={id} className="flex items-center gap-3 rounded-lg border p-3">
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="text-sm font-medium text-foreground">{check.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {check.complete.toLocaleString("en-IN")} of {data.total.toLocaleString("en-IN")} complete
                          {check.missing > 0 && ` - ${check.missing.toLocaleString("en-IN")} missing`}
                        </span>
                      </div>
                      <Progress value={check.percent} className="mt-2 h-1.5" />
                    </div>
                    <span className={`w-14 shrink-0 text-right text-sm font-semibold ${toneFor(check.percent)}`}>
                      {check.percent}%
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default RealtimeOptimization;
