import { useState, useMemo, useEffect, useTransition } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { PhoneDetailsTable } from "@/components/dashboard/PhoneDetailsTable";
import { useMongoData } from "@/hooks/useMongoData";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { useAuth } from "@/contexts/AuthContext";

const PhonePage = () => {
    const { user } = useAuth();
    const [selectedCluster, setSelectedCluster] = useState<string[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string[]>([]);
    const [selectedMonth, setSelectedMonth] = useState<string[]>([]);
    const [selectedYear, setSelectedYear] = useState<string[]>([]);
    const [selectedSpeciality, setSelectedSpeciality] = useState<string[]>([]);
    const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
    const [selectedRatings, setSelectedRatings] = useState<number[]>([]);

    const { insights, loading } = useMongoData();
    const [mounted, setMounted] = useState(false);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        const timer = setTimeout(() => {
            setMounted(true);
        }, 10);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (user?.branch) {
            setSelectedBranch([user.branch]);
        } else if (user?.cluster) {
            setSelectedCluster([user.cluster]);
        }
    }, [user]);

    const isBranchRestricted = !!user?.branch;
    const isClusterRestricted = !!user?.cluster && !user?.branch;

    const dashboardTitle = user?.role === "Admin" ? "Phone Directory" : (user?.branch || user?.cluster || "Phone Directory");
    const dashboardSubtitle = user?.role === "Admin" ? "Manage and view contact details" : `${user?.branch ? 'Branch' : 'Cluster'} Level Access - Contact Details`;

    // Get the chronologically latest month from the data
    const latestDataMonth = useMemo(() => {
        const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        if (!mounted || loading || insights.length === 0) return monthOrder[new Date().getMonth() - 1] || "Dec";
        const uniqueMonths = [...new Set(insights.map(i => i.month))];
        return uniqueMonths.sort((a, b) => monthOrder.indexOf(b) - monthOrder.indexOf(a))[0];
    }, [insights, mounted, loading]);

    // Derive unique filter options from the insights data
    const filterOptions = useMemo(() => {
        if (!mounted || loading) {
            return { clusters: [], branches: [], months: [], specialities: [] };
        }
        // Extract unique years
        const uniqueYears = [...new Set(insights.map(i => {
            try {
                const d = new Date(i.date);
                return !isNaN(d.getFullYear()) ? d.getFullYear().toString() : "";
            } catch (e) { return ""; }
        }))].filter(Boolean).sort().reverse();

        const years = uniqueYears;

        // 1. Clusters depend on selected Departments (Profile Types)
        const clusterData = selectedDepartments.length > 0
            ? insights.filter(i => selectedDepartments.includes(i.department))
            : insights;
        const clusters = [...new Set(clusterData.map(i => i.cluster))].filter(Boolean).sort();

        // 2. Branches depend on selected Clusters AND selected Departments
        const branchData = insights.filter(i => {
            const clusterMatch = selectedCluster.length === 0 || selectedCluster.includes(i.cluster);
            const departmentMatch = selectedDepartments.length === 0 || selectedDepartments.includes(i.department);
            return clusterMatch && departmentMatch;
        });
        const branches = [...new Set(branchData.map(i => i.branch))].filter(Boolean).sort();

        // Filter by year for months list
        const monthData = selectedYear.length > 0
            ? insights.filter(i => {
                const d = new Date(i.date);
                const y = !isNaN(d.getFullYear()) ? d.getFullYear().toString() : "";
                return selectedYear.includes(y);
            })
            : insights;

        const months = [...new Set(monthData.map(i => i.month))].filter(Boolean);
        const specialities = [...new Set(insights.map(i => i.speciality))].filter(Boolean).sort();

        // Sort months chronologically (if needed elsewhere, but FilterBar handles it)
        const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        months.sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));

        return { clusters, branches, months, years, specialities };
    }, [insights, selectedDepartments, selectedCluster, selectedYear, mounted, loading]);

    const filteredData = useMemo(() => {
        if (!mounted || loading) return [];
        return insights.filter((item) => {
            const clusterMatch = selectedCluster.length === 0 || selectedCluster.includes(item.cluster);
            const branchMatch = selectedBranch.length === 0 || selectedBranch.includes(item.branch);

            // If no month is selected, default to the latest available month
            const effectiveMonths = selectedMonth.length > 0 ? selectedMonth : [latestDataMonth];
            const monthMatch = effectiveMonths.includes(item.month);

            const specialityMatch = selectedSpeciality.length === 0 || selectedSpeciality.includes(item.speciality);
            const departmentMatch = selectedDepartments.length === 0 || selectedDepartments.includes(item.department);
            const ratingMatch = selectedRatings.length === 0 || selectedRatings.some(r => Math.floor(item.rating) === r);

            let yearMatch = true;
            if (selectedYear.length > 0) {
                const d = new Date(item.date);
                const y = !isNaN(d.getFullYear()) ? d.getFullYear().toString() : "";
                yearMatch = selectedYear.includes(y);
            }

            return clusterMatch && branchMatch && monthMatch && specialityMatch && departmentMatch && ratingMatch && yearMatch;
        });
    }, [insights, selectedCluster, selectedBranch, selectedMonth, selectedSpeciality, selectedDepartments, selectedRatings, latestDataMonth, selectedYear, mounted, loading]);

    if (!mounted || loading) {
        return (
            <DashboardLayout
                title={dashboardTitle}
                subtitle={dashboardSubtitle}
                selectedDepartments={selectedDepartments}
                onDepartmentsChange={(val) => startTransition(() => setSelectedDepartments(val))}
                selectedRatings={selectedRatings}
                onRatingsChange={(val) => startTransition(() => setSelectedRatings(val))}
            >
                <PhoneSkeleton />
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout
            title={dashboardTitle}
            subtitle={dashboardSubtitle}
            selectedDepartments={selectedDepartments}
            onDepartmentsChange={(val) => startTransition(() => setSelectedDepartments(val))}
            selectedRatings={selectedRatings}
            onRatingsChange={(val) => startTransition(() => setSelectedRatings(val))}
        >
            <div className={cn("relative transition-all duration-300", isPending ? "opacity-60" : "opacity-100")}>
                {isPending && (
                    <div className="absolute inset-0 z-[60] flex items-start justify-center pt-32 bg-background/5 backdrop-blur-[1px] rounded-xl pointer-events-none">
                        <div className="flex items-center gap-3 px-4 py-2 bg-background/80 border border-border shadow-lg rounded-full animate-in fade-in zoom-in duration-300">
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            <span className="text-sm font-medium">Updating results...</span>
                        </div>
                    </div>
                )}
                <FilterBar
                    selectedCluster={selectedCluster}
                    selectedBranch={selectedBranch}
                    selectedMonth={selectedMonth}
                    selectedSpeciality={selectedSpeciality}
                    clusterOptions={filterOptions.clusters}
                    branchOptions={filterOptions.branches}
                    monthOptions={filterOptions.months}
                    specialityOptions={filterOptions.specialities}
                    onClusterChange={(val) => startTransition(() => setSelectedCluster(val))}
                    onBranchChange={(val) => startTransition(() => setSelectedBranch(val))}
                    onMonthChange={(val) => startTransition(() => setSelectedMonth(val))}
                    selectedYear={selectedYear}
                    onYearChange={(val) => startTransition(() => setSelectedYear(val))}
                    onSpecialityChange={(val) => startTransition(() => setSelectedSpeciality(val))}
                    hideCluster={isBranchRestricted || isClusterRestricted}
                    hideBranch={isBranchRestricted}
                    yearOptions={filterOptions.years}
                />

                <div className="mb-6">
                    <PhoneDetailsTable data={filteredData} />
                </div>
            </div>
        </DashboardLayout>
    );
};

const PhoneSkeleton = () => {
    return (
        <div className="space-y-6">
            {/* Filter Bar Skeleton */}
            <div className="flex flex-wrap gap-4 items-center p-4 bg-card rounded-xl border border-border mb-6">
                <Skeleton className="h-5 w-24" />
                <div className="flex flex-wrap gap-3 flex-1">
                    <Skeleton className="h-10 w-full sm:w-[200px]" />
                    <Skeleton className="h-10 w-full sm:w-[220px]" />
                    <Skeleton className="h-10 w-full sm:w-[180px]" />
                    <Skeleton className="h-10 w-full sm:w-[220px]" />
                </div>
            </div>

            {/* Table Skeleton */}
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-48" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="grid grid-cols-4 gap-4 pb-2 border-b">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <Skeleton key={i} className="h-5 w-24" />
                            ))}
                        </div>
                        {Array.from({ length: 10 }).map((_, i) => (
                            <div key={i} className="grid grid-cols-4 gap-4 py-2">
                                {Array.from({ length: 4 }).map((_, j) => (
                                    <Skeleton key={j} className="h-8 w-full" />
                                ))}
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default PhonePage;
