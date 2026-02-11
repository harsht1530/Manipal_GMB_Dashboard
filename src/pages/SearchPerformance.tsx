import { useState, useMemo, useEffect, useTransition } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMongoData } from "@/hooks/useMongoData";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Loader2, Info, Check, ChevronsUpDown, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterBar } from "@/components/dashboard/FilterBar";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);
const MONTHS = [
    { value: "1", label: "January" },
    { value: "2", label: "February" },
    { value: "3", label: "March" },
    { value: "4", label: "April" },
    { value: "5", label: "May" },
    { value: "6", label: "June" },
    { value: "7", label: "July" },
    { value: "8", label: "August" },
    { value: "9", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
];

interface SearchKeywordData {
    searchKeyword: string;
    insightsValue: {
        value?: string;
        threshold?: string;
    };
}

import { useAuth } from "@/contexts/AuthContext";

const SearchPerformance = () => {
    const { user } = useAuth();
    const { doctors, insights, loading: doctorsLoading } = useMongoData();

    // Filters (Passed to DashboardLayout and FilterBar)
    const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
    const [selectedRatings, setSelectedRatings] = useState<number[]>([]);
    const [selectedCluster, setSelectedCluster] = useState<string[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string[]>([]);
    const [selectedMonth, setSelectedMonth] = useState<string[]>([]);
    const [selectedSpeciality, setSelectedSpeciality] = useState<string[]>([]);

    // Search Config
    const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
    const [startYear, setStartYear] = useState<string>(CURRENT_YEAR.toString());
    const [startMonth, setStartMonth] = useState<string>("1");
    const [endYear, setEndYear] = useState<string>(CURRENT_YEAR.toString());
    const [endMonth, setEndMonth] = useState<string>("3");

    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<SearchKeywordData[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState(false);
    const [comboOpen, setComboOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [mounted, setMounted] = useState(false);

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

    const dashboardTitle = user?.role === "Admin" ? "Search Performance" : (user?.branch || user?.cluster || "Search Performance");
    const dashboardSubtitle = user?.role === "Admin" ? "Analyze search keywords and impressions" : `${user?.branch ? 'Branch' : 'Cluster'} Level Access - Search Keywords`;

    // Derive filter options for FilterBar
    const filterOptions = useMemo(() => {
        if (!mounted || doctorsLoading) {
            return { clusters: [], branches: [], specialities: [], months: [] };
        }
        const clusters = [...new Set(insights.map(i => i.cluster))].filter(Boolean).sort();
        const branches = [...new Set(insights.map(i => i.branch))].filter(Boolean).sort();
        const specialities = [...new Set(insights.map(i => i.speciality))].filter(Boolean).sort();
        const months = [...new Set(insights.map(i => i.month))].filter(Boolean);
        return { clusters, branches, specialities, months };
    }, [insights, mounted, doctorsLoading]);

    // Get the chronologically latest month and year from the data
    const latestDataInfo = useMemo(() => {
        if (insights.length === 0) {
            const now = new Date();
            const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            return {
                month: monthOrder[now.getMonth() - 1] || "Dec",
                year: (now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()).toString()
            };
        }

        // Sort by Date object to find the absolute latest entry
        const sortedInsights = [...insights].sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            return dateB - dateA;
        });

        const latest = sortedInsights[0];
        return {
            month: latest.month,
            year: new Date(latest.date).getFullYear().toString()
        };
    }, [insights]);

    const latestDataMonth = latestDataInfo.month;
    const latestDataYear = latestDataInfo.year;

    // List of profiles that exist in Insights data for the latest month and year
    const insightProfiles = useMemo(() => {
        if (!mounted || doctorsLoading) return [];

        // Get all insights for the latest month AND year
        const latestMonthInsights = insights.filter(i => {
            const itemYear = new Date(i.date).getFullYear().toString();
            return i.month === latestDataMonth && itemYear === latestDataYear;
        });

        // Map them to profile objects, matching with doctor metadata for account/mailId
        return latestMonthInsights.map((insight, idx) => {
            const doctor = doctors.find(d => d.businessName === insight.businessName);
            return {
                id: insight._id || `${insight.businessName}-${idx}`,
                name: doctor?.name || insight.businessName,
                businessName: insight.businessName,
                cluster: insight.cluster || doctor?.cluster || "",
                branch: insight.branch || doctor?.branch || "",
                primaryCategory: insight.department || doctor?.primaryCategory || "",
                averageRating: insight.rating || doctor?.averageRating || 0,
                account: doctor?.account || "",
                mailId: doctor?.mailId || ""
            } as any;
        });
    }, [insights, doctors, latestDataMonth, latestDataYear, mounted, doctorsLoading]);

    // Filter the derived list based on ALL global filters
    const filteredDoctorsList = useMemo(() => {
        return insightProfiles.filter(doc => {
            const clusterMatch = selectedCluster.length === 0 || selectedCluster.includes(doc.cluster);
            const branchMatch = selectedBranch.length === 0 || selectedBranch.includes(doc.branch);
            const departmentMatch = selectedDepartments.length === 0 || selectedDepartments.includes(doc.primaryCategory);
            const ratingMatch = selectedRatings.length === 0 || selectedRatings.some(r => Math.floor(doc.averageRating || 0) === r);

            return clusterMatch && branchMatch && departmentMatch && ratingMatch;
        });
    }, [insightProfiles, selectedCluster, selectedBranch, selectedDepartments, selectedRatings]);

    const handleSearch = async () => {
        if (!selectedDoctorId) {
            setError("Please select a profile first.");
            return;
        }

        const selectedDoctor = insightProfiles.find(d => d.id === selectedDoctorId);
        if (!selectedDoctor) {
            setError("Selected profile not found.");
            return;
        }

        // Parse account for locationId
        const locationId = selectedDoctor.account ? selectedDoctor.account.split('/').pop() : "";
        const email = selectedDoctor.mailId;

        if (!locationId || !email) {
            setError("Profile missing Location ID or Email.");
            return;
        }

        setLoading(true);
        setError(null);
        setHasSearched(true);
        setData([]);

        try {
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/search-keywords-impressions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    locationId,
                    startYear: parseInt(startYear),
                    startMonth: parseInt(startMonth),
                    endYear: parseInt(endYear),
                    endMonth: parseInt(endMonth)
                }),
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(errText || `Server returned ${res.status}`);
            }

            const result = await res.json();

            if (result.searchKeywordsCounts) {
                setData(result.searchKeywordsCounts);
            } else if (result.error) {
                // Handle nested error object from Google Business API
                const errorMessage = typeof result.error === 'object'
                    ? (result.error.message || result.error.status || "Permission Denied")
                    : result.error;

                if (result.error.code === 403 || result.error.status === "PERMISSION_DENIED") {
                    throw new Error("Profile Permission Denied: This GMB profile doesn't have the required permissions to share search keyword data. Please ensure it is correctly verified and linked.");
                }

                throw new Error(errorMessage);
            } else {
                setData([]);
            }
        } catch (err: any) {
            console.error("Search API Error:", err);
            setError(err.message || "Failed to fetch data.");
        } finally {
            setLoading(false);
        }
    };

    if (!mounted || doctorsLoading) {
        return (
            <DashboardLayout
                title={dashboardTitle}
                subtitle={dashboardSubtitle}
                selectedDepartments={selectedDepartments}
                onDepartmentsChange={(val) => startTransition(() => setSelectedDepartments(val))}
                selectedRatings={selectedRatings}
                onRatingsChange={(val) => startTransition(() => setSelectedRatings(val))}
            >
                <SearchPerformanceSkeleton />
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
                onSpecialityChange={(val) => startTransition(() => setSelectedSpeciality(val))}
                hideMonth={true}
                hideYear={true}
                hideCluster={isBranchRestricted || isClusterRestricted}
                hideBranch={isBranchRestricted}
            />

            <Alert className="mb-6 bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-800">About this section</AlertTitle>
                <AlertDescription className="text-blue-700">
                    This detailed report shows <strong>Search Keywords Impressions</strong>—the specific terms users searched for on Google that triggered your profile to appear.
                </AlertDescription>
            </Alert>

            <Card className="mb-6 overflow-visible">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Filter className="h-5 w-5 text-primary" />
                        Configuration
                    </CardTitle>
                </CardHeader>
                <CardContent className="overflow-visible">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                        {/* Profile Selector (Combobox) */}
                        <div className="md:col-span-1 flex flex-col gap-2">
                            <label className="text-sm font-semibold text-foreground/80 flex justify-between items-center">
                                Select Profile ({latestDataMonth} {latestDataYear})
                                <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
                                    {filteredDoctorsList.length} profiles
                                </span>
                            </label>
                            <Popover open={comboOpen} onOpenChange={setComboOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={comboOpen}
                                        className="w-full justify-between text-left font-normal"
                                        disabled={doctorsLoading}
                                    >
                                        <span className="truncate">
                                            {selectedDoctorId
                                                ? (doctors.find((doctor) => doctor.id === selectedDoctorId)?.name || selectedDoctorId)
                                                : "Select profile..."}
                                        </span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="p-0 w-[--radix-popover-trigger-width] min-w-[280px]"
                                    align="start"
                                >
                                    <Command className="w-full">
                                        <CommandInput placeholder="Search profile..." className="h-9" />
                                        <CommandList className="max-h-[300px]">
                                            <CommandEmpty>No profile found.</CommandEmpty>
                                            <CommandGroup>
                                                {filteredDoctorsList
                                                    .sort((a, b) => a.name.localeCompare(b.name))
                                                    .map((doctor) => (
                                                        <CommandItem
                                                            key={doctor.id}
                                                            value={doctor.name}
                                                            onSelect={() => {
                                                                setSelectedDoctorId(doctor.id === selectedDoctorId ? "" : doctor.id);
                                                                setComboOpen(false);
                                                            }}
                                                            className="cursor-pointer"
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    selectedDoctorId === doctor.id ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            {doctor.name}
                                                        </CommandItem>
                                                    ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Start Date */}
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-semibold text-foreground/80">Start Date</label>
                            <div className="flex gap-2">
                                <Select value={startMonth} onValueChange={setStartMonth}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Month" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Select value={startYear} onValueChange={setStartYear}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Year" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {YEARS.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* End Date */}
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-semibold text-foreground/80">End Date</label>
                            <div className="flex gap-2">
                                <Select value={endMonth} onValueChange={setEndMonth}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Month" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Select value={endYear} onValueChange={setEndYear}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Year" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {YEARS.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <Button
                            onClick={handleSearch}
                            disabled={loading || !selectedDoctorId}
                            className="w-full bg-primary hover:bg-primary/90 text-white font-semibold h-10 shadow-md transition-all active:scale-[0.98]"
                        >
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                            Fetch Insights
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {error && (
                <Alert variant="destructive" className="mb-6 border-red-200 bg-red-50 text-red-800">
                    <Info className="h-4 w-4" />
                    <AlertTitle>Action Failed</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Results Table */}
            {hasSearched && !loading && (
                <Card className="animate-slide-up shadow-sm">
                    <CardHeader className="border-b pb-4">
                        <CardTitle className="text-xl font-bold text-primary flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Search className="h-5 w-5" />
                                Search Keywords
                            </div>
                            <Badge variant="outline" className="text-sm font-medium bg-secondary/50">
                                {data.length} results
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {data.length > 0 ? (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                                            <TableHead className="font-bold text-foreground h-12">Search Keyword</TableHead>
                                            <TableHead className="text-right font-bold text-foreground h-12 pr-6">Impressions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.map((item, index) => (
                                            <TableRow key={index} className="hover:bg-muted/20 transition-colors border-b last:border-0">
                                                <TableCell className="font-medium py-3.5 pl-6">
                                                    {item.searchKeyword}
                                                </TableCell>
                                                <TableCell className="text-right py-3.5 pr-6">
                                                    {item.insightsValue.value ? (
                                                        <span className="font-bold text-primary text-base tabular-nums">
                                                            {parseInt(item.insightsValue.value).toLocaleString()}
                                                        </span>
                                                    ) : (
                                                        <Badge variant="secondary" className="font-normal opacity-70">
                                                            &lt; {item.insightsValue.threshold}
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <div className="text-center py-20">
                                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
                                    <Search className="h-6 w-6 text-muted-foreground" />
                                </div>
                                <p className="text-muted-foreground font-medium">No search keyword data found for this period.</p>
                                <p className="text-sm text-muted-foreground/60 mt-1">Try selecting a different date range or profile.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </DashboardLayout>
    );
};

const SearchPerformanceSkeleton = () => {
    return (
        <div className="space-y-6">
            {/* Filter Bar Skeleton */}
            <div className="flex flex-wrap gap-4 items-center p-4 bg-card rounded-xl border border-border mb-6">
                <Skeleton className="h-5 w-24" />
                <div className="flex flex-wrap gap-3 flex-1">
                    <Skeleton className="h-10 w-[200px]" />
                    <Skeleton className="h-10 w-[220px]" />
                    <Skeleton className="h-10 w-[180px]" />
                    <Skeleton className="h-10 w-[220px]" />
                </div>
            </div>

            {/* Alert Skeleton */}
            <Skeleton className="h-20 w-full rounded-lg" />

            {/* Config Card Skeleton */}
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-20" />
                            <div className="flex gap-2">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-20" />
                            <div className="flex gap-2">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        </div>
                        <Skeleton className="h-10 w-full" />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default SearchPerformance;
