import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InsightData } from "@/hooks/useMongoData";
import {
    TrendingUp,
    TrendingDown,
    Minus,
    Lightbulb,
    Star,
    Phone,
    Rocket,
    AlertTriangle,
    ArrowRight,
    Globe,
    CalendarSearch,
    X,
    LayoutList,
    BarChart2 as BarChartIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";

interface MonthlyComparisonTableProps {
    entityName: string;
    entityData: InsightData[];
    entityColor?: string;
}

const MONTH_ORDER = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface MonthMetrics {
    month: string;
    yearMonth: string;
    searches: number;
    calls: number;
    directions: number;
    websiteClicks: number;
    total: number;
}

function formatNum(n: number): string {
    if (n >= 10000000) return (n / 10000000).toFixed(2) + " Cr";
    if (n >= 100000) return (n / 100000).toFixed(2) + " L";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return n.toLocaleString("en-IN");
}

function pctStr(val: number): string {
    return (val > 0 ? "+" : "") + val.toFixed(1) + "%";
}

function calcPct(curr: number, prev: number): number | null {
    if (prev === 0 && curr === 0) return null;
    if (prev === 0) return 100;
    return parseFloat((((curr - prev) / prev) * 100).toFixed(1));
}

interface InsightItem {
    icon: React.ReactNode;
    text: React.ReactNode;
}

export const MonthlyComparisonTable = ({
    entityName,
    entityData,
    entityColor = "hsl(var(--primary))",
}: MonthlyComparisonTableProps) => {

    // All available months from entity data
    const allMonthlyMetrics: MonthMetrics[] = useMemo(() => {
        const map: Record<string, MonthMetrics> = {};
        entityData.forEach(item => {
            const year = new Date(item.date).getFullYear() || "";
            const m = item.month?.substring(0, 3) || "";
            if (!m) return;
            const key = `${year}-${m}`;
            if (!map[key]) {
                map[key] = { month: m, yearMonth: key, searches: 0, calls: 0, directions: 0, websiteClicks: 0, total: 0 };
            }
            const searches = item.googleSearchMobile + item.googleSearchDesktop + item.googleMapsMobile + item.googleMapsDesktop;
            map[key].searches += searches;
            map[key].calls += item.calls;
            map[key].directions += item.directions;
            map[key].websiteClicks += item.websiteClicks;
            map[key].total += searches + item.calls + item.directions + item.websiteClicks;
        });

        return Object.values(map).sort((a, b) => {
            const [ay, am] = a.yearMonth.split("-");
            const [by, bm] = b.yearMonth.split("-");
            if (ay !== by) return parseInt(ay) - parseInt(by);
            return MONTH_ORDER.indexOf(am) - MONTH_ORDER.indexOf(bm);
        });
    }, [entityData]);

    const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [viewMode, setViewMode] = useState<"table" | "chart">("table");

    const toggleMonth = (ym: string) => {
        setSelectedMonths(prev => prev.includes(ym) ? prev.filter(m => m !== ym) : [...prev, ym]);
    };
    const clearSelection = () => setSelectedMonths([]);

    const monthlyMetrics: MonthMetrics[] = useMemo(() => {
        if (selectedMonths.length === 0) return allMonthlyMetrics;
        return allMonthlyMetrics.filter(m => selectedMonths.includes(m.yearMonth));
    }, [allMonthlyMetrics, selectedMonths]);

    const metricDefs: Array<{ key: keyof MonthMetrics; label: string; color: string }> = [
        { key: "searches", label: "Total Searches", color: "hsl(var(--primary))" },
        { key: "calls", label: "Phone Calls", color: "hsl(var(--chart-2))" },
        { key: "directions", label: "Directions", color: "hsl(var(--chart-3))" },
        { key: "websiteClicks", label: "Website Clicks", color: "hsl(var(--chart-4))" },
    ];

    // Highcharts options for chart mode
    const chartOptions: Highcharts.Options = useMemo(() => ({
        chart: {
            type: "column",
            height: 340,
            backgroundColor: "transparent",
            style: { fontFamily: "inherit" },
        },
        title: { text: undefined },
        credits: { enabled: false },
        xAxis: {
            categories: monthlyMetrics.map(m => m.yearMonth),
            labels: { style: { color: "hsl(var(--muted-foreground))", fontSize: "11px" } },
            lineColor: "hsl(var(--border))",
            tickColor: "hsl(var(--border))",
        },
        yAxis: {
            title: { text: undefined },
            labels: { style: { color: "hsl(var(--muted-foreground))" } },
            gridLineColor: "hsl(var(--muted))",
            gridLineDashStyle: "Dash",
        },
        legend: {
            itemStyle: { color: "hsl(var(--foreground))", fontWeight: "500", fontSize: "11px" },
        },
        tooltip: {
            shared: true,
            backgroundColor: "white",
            borderRadius: 8,
            useHTML: true,
            headerFormat: '<span style="font-size: 11px; font-weight: 600">{point.key}</span><br/>',
        },
        plotOptions: {
            column: {
                borderRadius: 4,
                borderWidth: 0,
                groupPadding: 0.1,
            },
        },
        series: metricDefs.map(def => ({
            name: def.label,
            type: "column" as const,
            data: monthlyMetrics.map(m => m[def.key] as number),
            color: def.color,
        })),
    }), [monthlyMetrics, metricDefs]);

    // Insights
    const insights: InsightItem[] = useMemo(() => {
        if (monthlyMetrics.length === 0) return [{
            icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />,
            text: "No data available for the selected period."
        }];
        const result: InsightItem[] = [];
        const bold = (text: string) => <strong className="text-foreground font-semibold">{text}</strong>;

        const bestMonth = [...monthlyMetrics].sort((a, b) => b.total - a.total)[0];
        result.push({
            icon: <Star className="h-3.5 w-3.5 text-amber-500" />,
            text: <span><b className="text-foreground font-semibold">{bestMonth.yearMonth}</b> was the overall strongest month for {entityName} — {formatNum(bestMonth.searches)} searches, {formatNum(bestMonth.calls)} calls, {formatNum(bestMonth.directions)} directions.</span>
        });

        const highCallsMonth = [...monthlyMetrics].sort((a, b) => b.calls - a.calls)[0];
        if (highCallsMonth && highCallsMonth.calls > 0) {
            result.push({
                icon: <Phone className="h-3.5 w-3.5 text-blue-500" />,
                text: <span>Highest phone call engagement in {bold(highCallsMonth.yearMonth)} with {formatNum(highCallsMonth.calls)} calls recorded.</span>
            });
        }

        if (monthlyMetrics.length >= 2) {
            let bestMoMPct = -Infinity, bestMoMLabel = "";
            let worstMoMPct = Infinity, worstMoMLabel = "";

            for (let i = 1; i < monthlyMetrics.length; i++) {
                const prev = monthlyMetrics[i - 1];
                const curr = monthlyMetrics[i];
                const pct = calcPct(curr.total, prev.total);
                if (pct !== null) {
                    if (pct > bestMoMPct) { bestMoMPct = pct; bestMoMLabel = `${prev.yearMonth} → ${curr.yearMonth}`; }
                    if (pct < worstMoMPct) { worstMoMPct = pct; worstMoMLabel = `${prev.yearMonth} → ${curr.yearMonth}`; }
                }
            }

            if (bestMoMLabel) result.push({
                icon: <Rocket className="h-3.5 w-3.5 text-emerald-500" />,
                text: <span>Biggest month-over-month growth: {bold(bestMoMLabel)} with an overall change of {bold(pctStr(bestMoMPct))}.</span>
            });

            if (worstMoMLabel && worstMoMPct < 0) result.push({
                icon: <AlertTriangle className="h-3.5 w-3.5 text-red-500" />,
                text: <span>Largest decline: {bold(worstMoMLabel)} saw a {bold(pctStr(worstMoMPct))} drop in total activity.</span>
            });

            const first = monthlyMetrics[0];
            const last = monthlyMetrics[monthlyMetrics.length - 1];
            const overallPct = calcPct(last.total, first.total);
            if (overallPct !== null) {
                if (overallPct > 10) result.push({
                    icon: <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />,
                    text: <span>Overall trend for {bold(entityName)} is {bold("improving")} — total activity grew by {pctStr(overallPct)} from {first.yearMonth} to {last.yearMonth}.</span>
                });
                else if (overallPct < -10) result.push({
                    icon: <TrendingDown className="h-3.5 w-3.5 text-red-500" />,
                    text: <span>Overall trend for {bold(entityName)} is {bold("declining")} — total activity fell by {pctStr(Math.abs(overallPct))} from {first.yearMonth} to {last.yearMonth}.</span>
                });
                else result.push({
                    icon: <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />,
                    text: <span>Overall trend for {bold(entityName)} is {bold("stable")} — activity remained consistent ({pctStr(overallPct)} net change).</span>
                });
            }
        }

        const highClicksMonth = [...monthlyMetrics].sort((a, b) => b.websiteClicks - a.websiteClicks)[0];
        if (highClicksMonth && highClicksMonth.websiteClicks > 0) result.push({
            icon: <Globe className="h-3.5 w-3.5 text-indigo-500" />,
            text: <span>Website engagement peaked in {bold(highClicksMonth.yearMonth)} with {formatNum(highClicksMonth.websiteClicks)} clicks — indicating strong online intent.</span>
        });

        return result;
    }, [monthlyMetrics, entityName]);

    if (allMonthlyMetrics.length === 0) {
        return (
            <Card className="border-border shadow-sm">
                <CardContent className="p-6 text-center text-muted-foreground text-sm">
                    No monthly data available for <strong>{entityName}</strong>.
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <Card className="border-border shadow-sm overflow-hidden">
                {/* ── Card Header ─────────────────────────────────────── */}
                <CardHeader className="py-4 px-6 border-b border-border bg-muted/30">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        {/* Title */}
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: entityColor }} />
                            <CardTitle className="text-sm font-semibold text-foreground">{entityName} — Month-wise Breakdown</CardTitle>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-2">

                            {/* Month Picker */}
                            <div className="relative">
                                <button
                                    onClick={() => setPickerOpen(p => !p)}
                                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border bg-background hover:bg-muted border-border text-foreground transition-colors"
                                >
                                    <CalendarSearch className="h-3.5 w-3.5 text-primary" />
                                    {selectedMonths.length === 0 ? "All Months" : `${selectedMonths.length} Month${selectedMonths.length > 1 ? "s" : ""} Selected`}
                                </button>

                                {pickerOpen && (
                                    <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-xl p-3 min-w-[260px]">
                                        <div className="flex items-center justify-between mb-2 pb-2 border-b border-border/60">
                                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Select Months to Compare</span>
                                            <button onClick={() => setPickerOpen(false)} className="text-muted-foreground hover:text-foreground">
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto scrollbar-hide">
                                            {allMonthlyMetrics.map(m => (
                                                <button
                                                    key={m.yearMonth}
                                                    onClick={() => toggleMonth(m.yearMonth)}
                                                    className={cn(
                                                        "px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all",
                                                        selectedMonths.includes(m.yearMonth)
                                                            ? "bg-primary text-primary-foreground border-primary"
                                                            : "bg-background text-foreground border-border hover:border-primary/50 hover:bg-muted"
                                                    )}
                                                >
                                                    {m.yearMonth}
                                                </button>
                                            ))}
                                        </div>
                                        {selectedMonths.length > 0 && (
                                            <button
                                                onClick={clearSelection}
                                                className="mt-2 pt-2 border-t border-border/60 w-full text-[11px] text-muted-foreground hover:text-destructive text-center transition-colors"
                                            >
                                                Clear selection (show all)
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Table / Chart Toggle */}
                            <div className="flex items-center bg-muted rounded-lg border border-border p-0.5 gap-0.5">
                                <button
                                    onClick={() => setViewMode("table")}
                                    title="Table view"
                                    className={cn(
                                        "flex items-center justify-center h-7 w-7 rounded-md transition-all",
                                        viewMode === "table" ? "bg-card shadow text-primary" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <LayoutList className="h-3.5 w-3.5" />
                                </button>
                                <button
                                    onClick={() => setViewMode("chart")}
                                    title="Chart view"
                                    className={cn(
                                        "flex items-center justify-center h-7 w-7 rounded-md transition-all",
                                        viewMode === "chart" ? "bg-card shadow text-primary" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <BarChartIcon className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Active month chips */}
                    {selectedMonths.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-border/50">
                            {selectedMonths.map(ym => (
                                <span key={ym} className="flex items-center gap-1 text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">
                                    {ym}
                                    <button onClick={() => toggleMonth(ym)} className="hover:text-destructive">
                                        <X className="h-2.5 w-2.5" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                </CardHeader>

                {/* ── Card Content ─────────────────────────────────────── */}
                <CardContent className="p-0">
                    {monthlyMetrics.length === 0 ? (
                        <div className="p-6 text-center text-muted-foreground text-sm">
                            No data for selected months. Try selecting different months.
                        </div>
                    ) : viewMode === "table" ? (
                        // ── TABLE VIEW ──────────────────────────────────────
                        <div className="overflow-x-auto scrollbar-hide">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-muted/40 border-b border-border">
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider min-w-[140px] sticky left-0 bg-card border-r border-border">Metric</th>
                                        {monthlyMetrics.map(m => (
                                            <th key={m.yearMonth} colSpan={2} className="text-center px-2 py-3 text-xs font-semibold text-foreground uppercase tracking-wider border-l border-border min-w-[140px]">
                                                {m.yearMonth}
                                            </th>
                                        ))}
                                    </tr>
                                    <tr className="bg-muted/20 border-b border-border">
                                        <th className="text-left px-4 py-2 text-[10px] text-muted-foreground sticky left-0 bg-card border-r border-border"></th>
                                        {monthlyMetrics.map((m, idx) => (
                                            <th key={m.yearMonth + "-sub"} colSpan={2} className="text-center px-2 py-1 border-l border-border">
                                                <div className="flex justify-around">
                                                    <span className="text-[10px] text-muted-foreground font-medium">Value</span>
                                                    <span className="text-[10px] text-muted-foreground font-medium">{idx === 0 ? "—" : "vs Prev"}</span>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {metricDefs.map(({ key, label }, rowIdx) => (
                                        <tr key={key} className={cn("border-b border-border/60 transition-colors hover:bg-muted/20", rowIdx % 2 !== 0 && "bg-muted/10")}>
                                            <td className="px-4 py-3 text-xs font-medium text-foreground sticky left-0 bg-card border-r border-border/60">{label}</td>
                                            {monthlyMetrics.map((m, idx) => {
                                                const val = m[key] as number;
                                                const prev = idx > 0 ? (monthlyMetrics[idx - 1][key] as number) : null;
                                                const pct = prev !== null ? calcPct(val, prev) : null;
                                                const diff = prev !== null ? val - prev : null;
                                                const isUp = pct !== null && pct > 0;
                                                const isDown = pct !== null && pct < 0;
                                                return (
                                                    <td key={m.yearMonth} colSpan={2} className="px-2 py-3 border-l border-border/40">
                                                        <div className="flex justify-around items-center gap-1">
                                                            <span className="font-semibold text-foreground text-xs">{formatNum(val)}</span>
                                                            {pct !== null ? (
                                                                <span className={cn(
                                                                    "flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                                                                    isUp && "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30",
                                                                    isDown && "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-900/30",
                                                                    !isUp && !isDown && "text-muted-foreground bg-muted/50"
                                                                )}>
                                                                    {isUp ? <TrendingUp className="h-2.5 w-2.5" /> : isDown ? <TrendingDown className="h-2.5 w-2.5" /> : <Minus className="h-2.5 w-2.5" />}
                                                                    {pctStr(pct)}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] text-muted-foreground">—</span>
                                                            )}
                                                        </div>
                                                        {diff !== null && (
                                                            <div className="text-center mt-0.5">
                                                                <span className={cn(
                                                                    "text-[9px]",
                                                                    diff > 0 ? "text-emerald-600 dark:text-emerald-500" : diff < 0 ? "text-red-600 dark:text-red-500" : "text-muted-foreground"
                                                                )}>
                                                                    ({diff > 0 ? "+" : ""}{formatNum(diff)})
                                                                </span>
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        // ── CHART VIEW ──────────────────────────────────────
                        <div className="p-4">
                            <HighchartsReact highcharts={Highcharts} options={chartOptions} />
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Insights Card */}
            <Card className="border-border shadow-sm bg-gradient-to-br from-primary/5 via-background to-background">
                <CardHeader className="py-3 px-5 border-b border-border/60">
                    <div className="flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-amber-500" />
                        <CardTitle className="text-xs font-semibold text-foreground uppercase tracking-wider">Insights — {entityName}</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-5">
                    <ul className="space-y-3">
                        {insights.map((insight, i) => (
                            <li key={i} className="flex items-start gap-2.5 text-xs text-foreground/80 leading-relaxed">
                                <span className="mt-0.5 flex-shrink-0">{insight.icon}</span>
                                <span>{insight.text}</span>
                            </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>
        </div>
    );
};
