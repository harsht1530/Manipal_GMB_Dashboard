import { useState, useMemo, useTransition } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ComparisonFilterBar } from "@/components/comparison/ComparisonFilterBar";
import { ComparisonChart } from "@/components/comparison/ComparisonChart";
import { useMongoData, getAggregatedMetrics } from "@/hooks/useMongoData";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Search, Map, Navigation, Globe, Phone, Smartphone, Monitor, MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const Comparison = () => {
    const { user } = useAuth();
    const { insights, loading } = useMongoData();
    const [isPending, startTransition] = useTransition();

    const [compareBy, setCompareBy] = useState("Branch");
    const [entity1, setEntity1] = useState("");
    const [entity2, setEntity2] = useState("");
    const [selectedMonth, setSelectedMonth] = useState<string[]>([]);
    const [selectedYear, setSelectedYear] = useState<string[]>([]);

    // Global filters managed by Layout
    const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
    const [selectedRatings, setSelectedRatings] = useState<number[]>([]);

    const filterOptions = useMemo(() => {
        if (loading) return { months: [], years: [], entities: [] };

        const years = [...new Set(insights.map(i => {
            try {
                const d = new Date(i.date);
                return !isNaN(d.getFullYear()) ? d.getFullYear().toString() : "";
            } catch { return ""; }
        }))].filter(Boolean).sort().reverse();

        const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const yearFiltered = selectedYear.length > 0 ? insights.filter(i => {
            const y = new Date(i.date).getFullYear().toString();
            return selectedYear.includes(y);
        }) : insights;
        const months = [...new Set(yearFiltered.map(i => i.month))].filter(Boolean).sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));

        // Filter valid entities based on role or department
        const baseData = selectedDepartments.length > 0 ? insights.filter(i => selectedDepartments.includes(i.department)) : insights;

        let entities: string[] = [];
        if (compareBy === "Cluster") {
            entities = [...new Set(baseData.map(i => i.cluster))];
            if (user?.cluster && !user?.branch) entities = entities.filter(e => e === user.cluster); // if cluster restricted
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

        // Autoselect if empty
        if (entities.length > 0) {
            if (!entity1 || !entities.includes(entity1)) setTimeout(() => setEntity1(entities[0]), 0);
            if (!entity2 || !entities.includes(entity2)) setTimeout(() => setEntity2(entities[1] || entities[0]), 0);
        }

        return { months, years, entities };
    }, [insights, loading, compareBy, selectedYear, selectedDepartments, user, entity1, entity2]);

    const entity1Data = useMemo(() => {
        if (!entity1 || loading) return [];
        return insights.filter(i => {
            const matchEntity = compareBy === "Cluster" ? i.cluster === entity1 : (compareBy === "Branch" ? i.branch === entity1 : i.speciality === entity1);
            const matchMonth = selectedMonth.length === 0 || selectedMonth.includes(i.month);
            const matchYear = selectedYear.length === 0 || selectedYear.includes(new Date(i.date).getFullYear().toString());
            const matchDept = selectedDepartments.length === 0 || selectedDepartments.includes(i.department);
            return matchEntity && matchMonth && matchYear && matchDept;
        });
    }, [insights, entity1, compareBy, selectedMonth, selectedYear, selectedDepartments, loading]);

    const entity2Data = useMemo(() => {
        if (!entity2 || loading) return [];
        return insights.filter(i => {
            const matchEntity = compareBy === "Cluster" ? i.cluster === entity2 : (compareBy === "Branch" ? i.branch === entity2 : i.speciality === entity2);
            const matchMonth = selectedMonth.length === 0 || selectedMonth.includes(i.month);
            const matchYear = selectedYear.length === 0 || selectedYear.includes(new Date(i.date).getFullYear().toString());
            const matchDept = selectedDepartments.length === 0 || selectedDepartments.includes(i.department);
            return matchEntity && matchMonth && matchYear && matchDept;
        });
    }, [insights, entity2, compareBy, selectedMonth, selectedYear, selectedDepartments, loading]);

    const metrics1 = useMemo(() => getAggregatedMetrics(entity1Data), [entity1Data]);
    const metrics2 = useMemo(() => getAggregatedMetrics(entity2Data), [entity2Data]);

    const calcDiff = (v1: number, v2: number) => {
        if (v2 === 0 && v1 > 0) return 100;
        if (v2 === 0 && v1 === 0) return 0;
        return parseFloat((((v1 - v2) / v2) * 100).toFixed(1));
    };

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
                    onCompareByChange={(val) => startTransition(() => {
                        setCompareBy(val);
                        setEntity1(""); setEntity2("");
                    })}
                    onEntity1Change={(val) => startTransition(() => setEntity1(val))}
                    onEntity2Change={(val) => startTransition(() => setEntity2(val))}
                    onMonthChange={(val) => startTransition(() => setSelectedMonth(val))}
                    onYearChange={(val) => startTransition(() => setSelectedYear(val))}
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

                        {/* Comparative Visuals */}
                        <div>
                            <h3 className="text-lg font-semibold mb-4 text-foreground border-b border-border pb-2">Trend Comparison</h3>
                            <ComparisonChart
                                entity1Name={entity1}
                                entity2Name={entity2}
                                entity1Data={entity1Data}
                                entity2Data={entity2Data}
                            />
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
};

export default Comparison;
