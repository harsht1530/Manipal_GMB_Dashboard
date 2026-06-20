import { useState, useMemo, useEffect, useTransition } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { PhoneDetailsTable } from "@/components/dashboard/PhoneDetailsTable";
import { useMongoData, parseDateString } from "@/hooks/useMongoData";
import { Loader2, Filter } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
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
    const [showFilters, setShowFilters] = useState(false);

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

    // Get the latest month and year from the Date field
    const latestDataInfo = useMemo(() => {
        const apiInsights = insights.filter(i => i.statusType !== undefined);
        if (!mounted || loading || apiInsights.length === 0) {
            return { month: "", year: "" };
        }
        const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        
        // Find the record with the maximum Date value
        const latestEntry = [...apiInsights].sort((a, b) => {
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
        })[0];

        if (!latestEntry) return { month: "", year: "" };
        
        const latestDate = parseDateString(latestEntry.date);
        const fallbackYear = latestEntry.date?.split('-')[2]?.length === 4 ? latestEntry.date?.split('-')[2] : new Date().getFullYear().toString();
        
        return {
            month: latestEntry.month,
            year: !isNaN(latestDate.getFullYear()) ? latestDate.getFullYear().toString() : fallbackYear
        };
    }, [insights, mounted, loading]);

    // Derive unique filter options from the apiInsights data
    const filterOptions = useMemo(() => {
        const apiInsights = insights.filter(i => i.statusType !== undefined && (i.statusType.toLowerCase() === "verified" || i.statusType.toLowerCase() === "verified and active"));
        if (!mounted || loading) {
            return { clusters: [], branches: [], months: [], specialities: [], years: [] };
        }
        // Extract unique years
        const uniqueYears = [...new Set(apiInsights.map(i => {
            try {
                const d = parseDateString(i.date);
                return !isNaN(d.getFullYear()) ? d.getFullYear().toString() : "";
            } catch (e) { return ""; }
        }))].filter(Boolean).sort().reverse();

        const years = uniqueYears;

        // 1. Clusters depend on selected Departments (Profile Types)
        const clusterData = selectedDepartments.length > 0
            ? apiInsights.filter(i => selectedDepartments.includes(i.department))
            : apiInsights;
        const clusters = [...new Set(clusterData.map(i => i.cluster))].filter(Boolean).sort();

        // 2. Branches depend on selected Clusters AND selected Departments
        const branchData = apiInsights.filter(i => {
            const clusterMatch = selectedCluster.length === 0 || selectedCluster.includes(i.cluster);
            const departmentMatch = selectedDepartments.length === 0 || selectedDepartments.includes(i.department);
            return clusterMatch && departmentMatch;
        });
        const branches = [...new Set(branchData.map(i => i.branch))].filter(Boolean).sort();

        // Filter by year for months list
        const monthData = selectedYear.length > 0
            ? apiInsights.filter(i => {
                const d = parseDateString(i.date);
                const y = !isNaN(d.getFullYear()) ? d.getFullYear().toString() : "";
                return selectedYear.includes(y);
            })
            : apiInsights;

        const months = [...new Set(monthData.map(i => i.month))].filter(Boolean);
        const specialities = [...new Set(apiInsights.map(i => i.speciality))].filter(Boolean).sort();

        // Sort months chronologically
        const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        months.sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));

        return { clusters, branches, months, years, specialities };
    }, [insights, selectedDepartments, selectedCluster, selectedYear, mounted, loading]);

    const filteredData = useMemo(() => {
        if (!mounted || loading) return [];
        return insights.filter((item) => {
            if (item.statusType === undefined) return false;
            
            const statusLower = item.statusType.toLowerCase();
            if (statusLower !== "verified" && statusLower !== "verified and active") return false;

            const clusterMatch = selectedCluster.length === 0 || selectedCluster.includes(item.cluster);
            const branchMatch = selectedBranch.length === 0 || selectedBranch.includes(item.branch);
            const specialityMatch = selectedSpeciality.length === 0 || selectedSpeciality.includes(item.speciality);
            const departmentMatch = selectedDepartments.length === 0 || selectedDepartments.includes(item.department);
            const ratingMatch = selectedRatings.length === 0 || selectedRatings.some(r => Math.floor(item.rating) === r);

            // Date filtering logic
            let dateMatch = true;
            if (selectedMonth.length === 0 && selectedYear.length === 0) {
                // If no month/year selected, default to the latest available month and year from Date
                const itemDate = parseDateString(item.date);
                const itemYearStr = !isNaN(itemDate.getFullYear()) ? itemDate.getFullYear().toString() : "";
                dateMatch = item.month === latestDataInfo.month && itemYearStr === latestDataInfo.year;
            } else {
                // If month or year filters are used, use them
                const monthMatch = selectedMonth.length === 0 || selectedMonth.includes(item.month);
                
                let yearMatch = true;
                if (selectedYear.length > 0) {
                    const itemDate = parseDateString(item.date);
                    const itemYearStr = !isNaN(itemDate.getFullYear()) ? itemDate.getFullYear().toString() : "";
                    yearMatch = selectedYear.includes(itemYearStr);
                }
                dateMatch = monthMatch && yearMatch;
            }

            return clusterMatch && branchMatch && specialityMatch && departmentMatch && ratingMatch && dateMatch;
        });
    }, [insights, selectedCluster, selectedBranch, selectedMonth, selectedSpeciality, selectedDepartments, selectedRatings, latestDataInfo, selectedYear, mounted, loading]);

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
                <div className="flex justify-end mb-4">
                    <Button 
                        variant="outline" 
                        onClick={() => setShowFilters(!showFilters)}
                        className="gap-2"
                    >
                        <Filter className="h-4 w-4" />
                        {showFilters ? 'Hide Filters' : 'Show Filters'}
                    </Button>
                </div>

                {showFilters && (
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
                )}

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
