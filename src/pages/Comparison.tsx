import { useState, useMemo, useTransition } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ComparisonFilterBar } from "@/components/comparison/ComparisonFilterBar";
import { ComparisonChart } from "@/components/comparison/ComparisonChart";
import { MonthlyComparisonTable } from "@/components/comparison/MonthlyComparisonTable";
import { useMongoData, getAggregatedMetrics } from "@/hooks/useMongoData";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Search, Navigation, Globe, Phone, Loader2, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const MONTH_ORDER = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const Comparison = () => {
    const { user } = useAuth();
    const { insights, loading } = useMongoData();
    const [isPending, startTransition] = useTransition();

    const [compareBy, setCompareBy] = useState("Branch");
    const [entity1, setEntity1] = useState("");
    const [entity2, setEntity2] = useState("");

    // months stored as "Month Year" values — same as Dashboard
    const [selectedMonth, setSelectedMonth] = useState<string[]>([]);
    const [selectedYear, setSelectedYear] = useState<string[]>([]);

    // Global filters managed by Layout
    const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
    const [selectedRatings, setSelectedRatings] = useState<number[]>([]);

    // ── Detect latest data point ──────────────────────────────────────────────
    const latestDataInfo = useMemo(() => {
        if (!insights || insights.length === 0) return { month: "Mar", year: "2026" };
        const sorted = [...insights].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const latest = sorted[0];
        return {
            month: latest.month?.substring(0, 3) || "Mar",
            year: new Date(latest.date).getFullYear().toString(),
        };
    }, [insights]);

    // ── Compute default last-12-months range "Month Year" values ─────────────
    const defaultLast12Months = useMemo(() => {
        const { month, year } = latestDataInfo;
        const latestMonthIdx = MONTH_ORDER.indexOf(month.substring(0, 3));
        const latestYear = parseInt(year);
        const range: string[] = [];
        for (let i = 11; i >= 0; i--) {
            let mIdx = latestMonthIdx - i;
            let y = latestYear;
            if (mIdx < 0) { mIdx += 12; y -= 1; }
            range.push(`${MONTH_ORDER[mIdx]} ${y}`);
        }
        return range;
    }, [latestDataInfo]);

    // ── Helper: is an insight record within the active time window ───────────
    // When nothing selected → use defaultLast12Months window
    // When selectedYear selected but no month → filter by year
    // When selectedMonth selected → match "Month Year" exactly
    const isInActiveWindow = (itemDate: string, itemMonth: string, itemYear: string) => {
        if (selectedMonth.length > 0) {
            // Month filter takes precedence — match "Month Year"
            return selectedMonth.includes(`${itemMonth} ${itemYear}`);
        }
        if (selectedYear.length > 0) {
            return selectedYear.includes(itemYear);
        }
        // Default: last 12 months
        return defaultLast12Months.includes(`${itemMonth} ${itemYear}`);
    };

    // ── Filter options ────────────────────────────────────────────────────────
    const filterOptions = useMemo(() => {
        if (loading) return { months: [] as any[], years: [] as string[], entities: [] as string[] };

        // Years
        const years = [...new Set(insights.map(i => {
            try { const d = new Date(i.date); return !isNaN(d.getFullYear()) ? d.getFullYear().toString() : ""; }
            catch { return ""; }
        }))].filter(Boolean).sort().reverse();

        // Months — same grouped format as Dashboard: {label, value: "Month Year", group: year}
        const monthData = selectedYear.length > 0
            ? insights.filter(i => {
                const y = new Date(i.date).getFullYear().toString();
                return selectedYear.includes(y);
            })
            : insights;

        const monthSet = new Set<string>();
        monthData.forEach(i => {
            if (!i.month) return;
            const y = i.date ? new Date(i.date).getFullYear().toString() : "Unknown";
            monthSet.add(JSON.stringify({ month: i.month.substring(0, 3), year: y }));
        });

        const months = Array.from(monthSet)
            .map(s => JSON.parse(s))
            .sort((a, b) => {
                if (a.year !== b.year) return parseInt(b.year) - parseInt(a.year);
                return MONTH_ORDER.indexOf(a.month) - MONTH_ORDER.indexOf(b.month);
            })
            .map(m => ({ label: m.month, value: `${m.month} ${m.year}`, group: m.year }));

        // Entity options
        const baseData = selectedDepartments.length > 0
            ? insights.filter(i => selectedDepartments.includes(i.department))
            : insights;

        let entities: string[] = [];
        if (compareBy === "Cluster") {
            entities = [...new Set(baseData.map(i => i.cluster))];
            if (user?.cluster && !user?.branch) entities = entities.filter(e => e === user.cluster);
        } else if (compareBy === "Branch") {
            entities = [...new Set(baseData.map(i => i.branch))];
            if (user?.branch) entities = entities.filter(e => e === user.branch);
            else if (user?.cluster) {
                const clusterBranches = baseData.filter(i => i.cluster === user.cluster).map(i => i.branch);
                entities = [...new Set(clusterBranches)];
            }
        } else if (compareBy === "Speciality") {
            let specData = baseData;
            if (user?.branch) specData = specData.filter(i => i.branch === user.branch);
            else if (user?.cluster) specData = specData.filter(i => i.cluster === user.cluster);
            entities = [...new Set(specData.map(i => i.speciality))];
        }

        entities = entities.filter(Boolean).sort();

        if (entities.length > 0) {
            if (!entity1 || !entities.includes(entity1)) setTimeout(() => setEntity1(entities[0]), 0);
            if (!entity2 || !entities.includes(entity2)) setTimeout(() => setEntity2(entities[1] || entities[0]), 0);
        }

        return { months, years, entities };
    }, [insights, loading, compareBy, selectedYear, selectedDepartments, user, entity1, entity2]);

    // ── Entity data — filtered with correct "Month Year" matching ────────────
    const filterEntity = (entityKey: string) => {
        if (!entityKey || loading) return [];
        return insights.filter(i => {
            const matchEntity = compareBy === "Cluster"
                ? i.cluster === entityKey
                : compareBy === "Branch"
                    ? i.branch === entityKey
                    : i.speciality === entityKey;
            const itemYear = new Date(i.date).getFullYear().toString();
            const itemMonth = i.month?.substring(0, 3) || "";
            const matchDept = selectedDepartments.length === 0 || selectedDepartments.includes(i.department);
            return matchEntity && matchDept && isInActiveWindow(i.date, itemMonth, itemYear);
        });
    };

    const entity1Data = useMemo(() => filterEntity(entity1), [insights, entity1, compareBy, selectedMonth, selectedYear, selectedDepartments, loading, defaultLast12Months]);
    const entity2Data = useMemo(() => filterEntity(entity2), [insights, entity2, compareBy, selectedMonth, selectedYear, selectedDepartments, loading, defaultLast12Months]);

    // ── Trend chart: always last 12 months (regardless of filter) ────────────
    const filterEntityLast12 = (entityKey: string) => {
        if (!entityKey || loading) return [];
        return insights.filter(i => {
            const matchEntity = compareBy === "Cluster"
                ? i.cluster === entityKey
                : compareBy === "Branch"
                    ? i.branch === entityKey
                    : i.speciality === entityKey;
            const itemYear = new Date(i.date).getFullYear().toString();
            const itemMonth = i.month?.substring(0, 3) || "";
            const matchDept = selectedDepartments.length === 0 || selectedDepartments.includes(i.department);
            return matchEntity && matchDept && defaultLast12Months.includes(`${itemMonth} ${itemYear}`);
        });
    };

    const entity1TrendData = useMemo(() => filterEntityLast12(entity1), [insights, entity1, compareBy, selectedDepartments, loading, defaultLast12Months]);
    const entity2TrendData = useMemo(() => filterEntityLast12(entity2), [insights, entity2, compareBy, selectedDepartments, loading, defaultLast12Months]);

    // ── Monthly breakdown table: ALL months, no time window (internal picker handles it) ──
    const filterEntityAll = (entityKey: string) => {
        if (!entityKey || loading) return [];
        return insights.filter(i => {
            const matchEntity = compareBy === "Cluster"
                ? i.cluster === entityKey
                : compareBy === "Branch"
                    ? i.branch === entityKey
                    : i.speciality === entityKey;
            const matchDept = selectedDepartments.length === 0 || selectedDepartments.includes(i.department);
            return matchEntity && matchDept;
        });
    };

    const entity1AllData = useMemo(() => filterEntityAll(entity1), [insights, entity1, compareBy, selectedDepartments, loading]);
    const entity2AllData = useMemo(() => filterEntityAll(entity2), [insights, entity2, compareBy, selectedDepartments, loading]);

    const metrics1 = useMemo(() => getAggregatedMetrics(entity1Data), [entity1Data]);
    const metrics2 = useMemo(() => getAggregatedMetrics(entity2Data), [entity2Data]);

    const calcDiff = (v1: number, v2: number) => {
        if (v2 === 0 && v1 > 0) return 100;
        if (v2 === 0 && v1 === 0) return 0;
        return parseFloat((((v1 - v2) / v2) * 100).toFixed(1));
    };

    // ── Active window label for UI ────────────────────────────────────────────
    const activeWindowLabel = useMemo(() => {
        if (selectedMonth.length > 0) return `${selectedMonth.length} month${selectedMonth.length > 1 ? "s" : ""} selected`;
        if (selectedYear.length > 0) return selectedYear.join(", ");
        if (defaultLast12Months.length > 0) {
            return `${defaultLast12Months[0]} – ${defaultLast12Months[defaultLast12Months.length - 1]} (last 12 months)`;
        }
        return "";
    }, [selectedMonth, selectedYear, defaultLast12Months]);

    return (
        <DashboardLayout
            title="Comparison"
            subtitle="Side-by-side performance comparison"
            selectedDepartments={selectedDepartments}
            onDepartmentsChange={(val) => startTransition(() => setSelectedDepartments(val))}
            selectedRatings={selectedRatings}
            onRatingsChange={(val) => startTransition(() => setSelectedRatings(val))}
        >
            <div className={cn("relative transition-all duration-300", isPending ? "opacity-60" : "opacity-100")}>
                {isPending && (
                    <div className="absolute inset-x-0 -top-4 bottom-0 z-[60] flex items-start justify-center pt-32 pointer-events-none">
                        <div className="flex items-center gap-3 px-4 py-2 bg-background/80 border border-border shadow-lg rounded-full animate-in fade-in zoom-in duration-300">
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            <span className="text-sm font-medium">Updating comparison...</span>
                        </div>
                    </div>
                )}

                <ComparisonFilterBar
                    compareBy={compareBy}
                    entity1={entity1}
                    entity2={entity2}
                    selectedMonth={selectedMonth}
                    selectedYear={selectedYear}
                    optionsMonth={filterOptions.months}
                    optionsYear={filterOptions.years}
                    optionsEntity={filterOptions.entities}
                    activeWindowLabel={activeWindowLabel}
                    onCompareByChange={(val) => startTransition(() => {
                        setCompareBy(val);
                        setEntity1(""); setEntity2("");
                    })}
                    onEntity1Change={(val) => startTransition(() => setEntity1(val))}
                    onEntity2Change={(val) => startTransition(() => setEntity2(val))}
                    onMonthChange={(val) => startTransition(() => setSelectedMonth(val))}
                    onYearChange={(val) => startTransition(() => {
                        setSelectedYear(val);
                        setSelectedMonth([]); // clear month when year changes
                    })}
                />

                {entity1 && entity2 && (
                    <div className="space-y-8 animate-fade-in">
                        {/* Entity 1 Row */}
                        <div>
                            <div className="flex items-center gap-3 mb-4 border-b border-border pb-2">
                                <div className="h-4 w-4 rounded-full bg-primary" />
                                <h3 className="text-lg font-bold text-foreground">{entity1} <span className="text-sm font-normal text-muted-foreground ml-2">({entity1Data.length} records)</span></h3>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                <MetricCard title="Total Searches" value={metrics1.totalSearches} change={calcDiff(metrics1.totalSearches, metrics2.totalSearches)} icon={Search} delay={0} customChangeLabel={`vs ${entity2}`} />
                                <MetricCard title="Phone Calls" value={metrics1.totalCalls} change={calcDiff(metrics1.totalCalls, metrics2.totalCalls)} icon={Phone} delay={50} customChangeLabel={`vs ${entity2}`} />
                                <MetricCard title="Directions" value={metrics1.totalDirections} change={calcDiff(metrics1.totalDirections, metrics2.totalDirections)} icon={Navigation} delay={100} customChangeLabel={`vs ${entity2}`} />
                                <MetricCard title="Website Clicks" value={metrics1.totalWebsiteClicks} change={calcDiff(metrics1.totalWebsiteClicks, metrics2.totalWebsiteClicks)} icon={Globe} delay={150} customChangeLabel={`vs ${entity2}`} />
                            </div>
                        </div>

                        {/* Entity 2 Row */}
                        <div>
                            <div className="flex items-center gap-3 mb-4 border-b border-border pb-2">
                                <div className="h-4 w-4 rounded-full bg-[hsl(var(--chart-2))]" />
                                <h3 className="text-lg font-bold text-foreground">{entity2} <span className="text-sm font-normal text-muted-foreground ml-2">({entity2Data.length} records)</span></h3>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                <MetricCard title="Total Searches" value={metrics2.totalSearches} change={calcDiff(metrics2.totalSearches, metrics1.totalSearches)} icon={Search} delay={0} customChangeLabel={`vs ${entity1}`} />
                                <MetricCard title="Phone Calls" value={metrics2.totalCalls} change={calcDiff(metrics2.totalCalls, metrics1.totalCalls)} icon={Phone} delay={50} customChangeLabel={`vs ${entity1}`} />
                                <MetricCard title="Directions" value={metrics2.totalDirections} change={calcDiff(metrics2.totalDirections, metrics1.totalDirections)} icon={Navigation} delay={100} customChangeLabel={`vs ${entity1}`} />
                                <MetricCard title="Website Clicks" value={metrics2.totalWebsiteClicks} change={calcDiff(metrics2.totalWebsiteClicks, metrics1.totalWebsiteClicks)} icon={Globe} delay={150} customChangeLabel={`vs ${entity1}`} />
                            </div>
                        </div>

                        {/* Trend Comparison — always last 12 months */}
                        <div>
                            <h3 className="text-lg font-semibold mb-1 text-foreground border-b border-border pb-2">Trend Comparison</h3>
                            <p className="text-xs text-muted-foreground mb-4">
                                Showing last 12 months: {defaultLast12Months[0]} – {defaultLast12Months[defaultLast12Months.length - 1]}
                            </p>
                            <ComparisonChart
                                entity1Name={entity1}
                                entity2Name={entity2}
                                entity1Data={entity1TrendData}
                                entity2Data={entity2TrendData}
                            />
                        </div>

                        {/* Month-wise Breakdown Section */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 border-b border-border pb-2">
                                <CalendarDays className="h-5 w-5 text-primary" />
                                <h3 className="text-lg font-semibold text-foreground">Month-wise Performance Breakdown</h3>
                                <span className="text-xs text-muted-foreground ml-1">— MoM difference &amp; % change with descriptive insights</span>
                            </div>

                            {/* Full data — internal month picker handles selection */}
                            <MonthlyComparisonTable
                                entityName={entity1}
                                entityData={entity1AllData}
                                entityColor="hsl(var(--primary))"
                            />

                            <MonthlyComparisonTable
                                entityName={entity2}
                                entityData={entity2AllData}
                                entityColor="hsl(var(--chart-2))"
                            />
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
};

export default Comparison;
