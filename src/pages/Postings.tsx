import { useState, useMemo, useEffect, useTransition } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMongoData } from "@/hooks/useMongoData";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Video, FileText, Image as ImageIcon, Send, Instagram, Facebook, Download, Users, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";
import { useAuth } from "@/contexts/AuthContext";

const Postings = () => {
    const { user } = useAuth();
    const { postings, locations, loading: dataLoading } = useMongoData();
    const [isPending, startTransition] = useTransition();
    const [mounted, setMounted] = useState(false);

    // Sidebar Filters (From Layout)
    const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
    const [selectedRatings, setSelectedRatings] = useState<number[]>([]);

    // Page Level Filters
    const [selectedCluster, setSelectedCluster] = useState<string[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string[]>([]);
    const [selectedMonth, setSelectedMonth] = useState<string[]>([]);
    const [selectedYear, setSelectedYear] = useState<string[]>([]);

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

    const dashboardTitle = user?.role === "Admin" ? "Postings" : (user?.branch || user?.cluster || "Postings");
    const dashboardSubtitle = "Manage and track content postings across locations";

    // Extract unique filter options from loaded postings
    const filterOptions = useMemo(() => {
        if (!mounted || dataLoading || !postings) {
            return { clusters: [], branches: [], months: [], years: [] };
        }
        const clusters = [...new Set(postings.map(p => p.cluster))].filter(Boolean).sort();

        // Filter branches based on selected clusters
        let availableForBranches = postings;
        if (selectedCluster.length > 0) {
            availableForBranches = postings.filter(p => selectedCluster.includes(p.cluster));
        }
        const branches = [...new Set(availableForBranches.map(p => p.branch))].filter(Boolean).sort();

        const monthData = selectedYear.length > 0
            ? postings.filter(p => {
                let y = "";
                if (p.date) {
                    if (p.date.includes('-')) {
                        const parts = p.date.split('-');
                        if (parts[2] && parts[2].length === 4) y = parts[2];
                    }
                    if (!y) {
                        try { y = new Date(p.date).getFullYear().toString(); } catch { }
                    }
                }
                return selectedYear.includes(y);
            })
            : postings;

        const monthSet = new Set<string>();
        monthData.forEach(p => {
            if (!p.month) return;
            let y = "Unknown Year";
            if (p.date) {
                if (p.date.includes('-')) {
                    const parts = p.date.split('-');
                    if (parts[2] && parts[2].length === 4) y = parts[2];
                }
                if (y === "Unknown Year") {
                    try { y = new Date(p.date).getFullYear().toString(); } catch { }
                }
            }
            monthSet.add(JSON.stringify({ month: p.month, year: y }));
        });

        const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const months = Array.from(monthSet)
            .map(s => JSON.parse(s))
            .sort((a, b) => {
                if (a.year !== b.year) return parseInt(b.year) - parseInt(a.year);
                return monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month);
            })
            .map(m => ({ label: m.month, value: `${m.month} ${m.year}`, group: m.year }));

        const years = [...new Set(postings.map(p => {
            if (!p.date) return "";
            if (p.date.includes('-')) {
                const parts = p.date.split('-');
                if (parts[2] && parts[2].length === 4) return parts[2]; // DD-MM-YYYY
            }
            try { return new Date(p.date).getFullYear().toString(); } catch { return ""; }
        }))].filter(Boolean).sort((a, b) => parseInt(b) - parseInt(a));

        return { clusters, branches, months, years };
    }, [postings, mounted, dataLoading, selectedCluster]);

    // Apply all filters to the postings list
    const filteredPostings = useMemo(() => {
        if (!postings) return [];

        return postings.filter(post => {
            const clusterMatch = selectedCluster.length === 0 || selectedCluster.includes(post.cluster);
            const branchMatch = selectedBranch.length === 0 || selectedBranch.includes(post.branch);

            let postYear = "";
            if (post.date) {
                if (post.date.includes('-')) {
                    const parts = post.date.split('-');
                    if (parts[2] && parts[2].length === 4) postYear = parts[2];
                }
                if (!postYear) {
                    try { postYear = new Date(post.date).getFullYear().toString(); } catch { }
                }
            }

            const itemMonthYear = `${post.month} ${postYear}`;
            const monthMatch = selectedMonth.length === 0 || selectedMonth.includes(itemMonthYear);

            let yearMatch = true;
            if (selectedYear.length > 0) {
                yearMatch = selectedYear.includes(postYear);
            }

            // Apply sidebar layout filters if any exist in the data models (e.g. department)
            const departmentMatch = selectedDepartments.length === 0 || selectedDepartments.includes(post.department);

            return clusterMatch && branchMatch && monthMatch && yearMatch && departmentMatch;
        });
    }, [postings, selectedCluster, selectedBranch, selectedMonth, selectedYear, selectedDepartments]);

    const getIconForPostType = (type: string) => {
        const t = type.toLowerCase();
        if (t.includes('instagram') || t.includes('reel')) return <Instagram className="h-4 w-4 mr-2 text-pink-600" />;
        if (t.includes('facebook') || t.includes('fb')) return <Facebook className="h-4 w-4 mr-2 text-blue-600" />;
        if (t.includes('video') || t.includes('youtube')) return <Video className="h-4 w-4 mr-2 text-red-500" />;
        if (t.includes('image') || t.includes('photo')) return <ImageIcon className="h-4 w-4 mr-2 text-blue-500" />;
        return <FileText className="h-4 w-4 mr-2 text-gray-500" />;
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "Unknown";
        if (dateStr.includes('-')) {
            const parts = dateStr.split('-');
            if (parts.length === 3 && parts[2].length === 4) {
                return dateStr; // already DD-MM-YYYY
            }
        }
        try { return new Date(dateStr).toLocaleDateString(); } catch { return dateStr; }
    };

    // Calculate the most recent month based on the Date field from locations (like Profile Verification Status)
    const latestLocationInfo = useMemo(() => {
        if (!locations || locations.length === 0) {
            const now = new Date();
            const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            return {
                month: monthOrder[now.getMonth() === 0 ? 11 : now.getMonth() - 1] || "Dec",
                year: (now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()).toString()
            };
        }

        const sortedLocations = [...locations].sort((a, b) => {
            const parseDate = (dateStr: string) => {
                if (!dateStr) return 0;
                if (dateStr.includes('-')) {
                    const parts = dateStr.split('-');
                    if (parts.length === 3 && parts[2].length === 4) {
                        return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
                    }
                }
                const time = new Date(dateStr).getTime();
                return isNaN(time) ? 0 : time;
            };
            return parseDate(b.date) - parseDate(a.date);
        });

        const latest = sortedLocations[0];
        let year = "";
        if (latest.date) {
            if (latest.date.includes('-')) {
                const parts = latest.date.split('-');
                if (parts.length === 3 && parts[2].length === 4) year = parts[2];
            }
            if (!year) {
                try { year = new Date(latest.date).getFullYear().toString(); } catch { }
            }
        }

        return {
            month: latest.month,
            year: year
        };
    }, [locations]);

    const latestLocMonth = latestLocationInfo.month;
    const latestLocYear = latestLocationInfo.year;

    // Apply all filters to the locations list for Total Profiles calculation
    const filteredLocations = useMemo(() => {
        if (!locations) return [];

        const targetMonths = selectedMonth.length > 0 ? selectedMonth.map(m => m.split(' ')[0]) : [latestLocMonth];
        const targetYears = selectedMonth.length > 0 ? selectedMonth.map(m => m.split(' ')[1]) : (selectedYear.length > 0 ? selectedYear : [latestLocYear]);

        return locations.filter(loc => {
            const clusterMatch = selectedCluster.length === 0 || selectedCluster.includes(loc.cluster);
            const branchMatch = selectedBranch.length === 0 || selectedBranch.includes(loc.unitName); // branch maps to unitName

            let locYear = "";
            if (loc.date) {
                if (loc.date.includes('-')) {
                    const parts = loc.date.split('-');
                    if (parts[2] && parts[2].length === 4) locYear = parts[2];
                }
                if (!locYear) {
                    try { locYear = new Date(loc.date).getFullYear().toString(); } catch { }
                }
            }

            const exactMonthMatch = selectedMonth.length === 0
                ? targetMonths.includes(loc.month)
                : selectedMonth.includes(`${loc.month} ${locYear}`);

            let yearMatch = true;
            if (targetYears.length > 0) {
                yearMatch = targetYears.includes(locYear);
            }

            const departmentMatch = selectedDepartments.length === 0 || selectedDepartments.includes(loc.department);

            return clusterMatch && branchMatch && exactMonthMatch && departmentMatch && yearMatch;
        });
    }, [locations, selectedCluster, selectedBranch, selectedMonth, selectedYear, selectedDepartments, latestLocMonth, latestLocYear]);

    // Calculate metrics
    const totalProfiles = useMemo(() => {
        return filteredLocations.reduce((sum, loc) => sum + (loc.verifiedProfiles || 0), 0);
    }, [filteredLocations]);

    const completed = filteredPostings.length;
    // Difference between Total Profiles and Completed
    const yetToStart = Math.max(0, totalProfiles - completed);

    // Percentages
    const completedPercent = totalProfiles > 0 ? Math.round((completed / totalProfiles) * 100) : 0;
    const yetToStartPercent = totalProfiles > 0 ? Math.round((yetToStart / totalProfiles) * 100) : 0;

    const handleExport = () => {
        if (!filteredPostings.length) return;

        const exportData = filteredPostings.map(post => ({
            "Cluster": post.cluster,
            "Branch": post.branch,
            "Business Name": post.businessName,
            "Department": post.department,
            "Type of Post": post.typeOfPost,
            "Date": post.date,
            "Month": post.month,
            "Source URL": post.sourceUrl,
            "GMB Post Link": post.gmbPostLink
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Postings");
        XLSX.writeFile(wb, `Postings_Data_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    if (!mounted || dataLoading) {
        return (
            <DashboardLayout
                title={dashboardTitle}
                subtitle={dashboardSubtitle}
                selectedDepartments={selectedDepartments}
                onDepartmentsChange={(val) => startTransition(() => setSelectedDepartments(val))}
                selectedRatings={selectedRatings}
                onRatingsChange={(val) => startTransition(() => setSelectedRatings(val))}
            >
                <div className="space-y-6">
                    <div className="flex gap-4 mb-6">
                        <Skeleton className="h-10 w-48" />
                        <Skeleton className="h-10 w-48" />
                        <Skeleton className="h-10 w-48" />
                    </div>
                    <Card>
                        <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
                        <CardContent><Skeleton className="h-64 w-full" /></CardContent>
                    </Card>
                </div>
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
                selectedSpeciality={[]} // Explicitly empty as requested by user
                onClusterChange={(val) => startTransition(() => setSelectedCluster(val))}
                onBranchChange={(val) => startTransition(() => setSelectedBranch(val))}
                onMonthChange={(val) => startTransition(() => setSelectedMonth(val))}
                onSpecialityChange={() => { }} // No-op
                clusterOptions={filterOptions.clusters}
                branchOptions={filterOptions.branches}
                monthOptions={filterOptions.months}
                specialityOptions={[]}
                hideCluster={isBranchRestricted || isClusterRestricted}
                hideBranch={isBranchRestricted}
                hideSpeciality={true} // Hide speciality completely
                selectedYear={selectedYear}
                yearOptions={filterOptions.years}
                onYearChange={(val) => startTransition(() => setSelectedYear(val))}
            />

            {/* Cards section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Profiles</CardTitle>
                        <Users className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalProfiles}</div>
                        <p className="text-xs text-muted-foreground mt-1">Verified Profiles</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{completed}</div>
                        <p className="text-xs text-muted-foreground mt-1">{completedPercent}% of Total</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Yet to Start</CardTitle>
                        <Clock className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{yetToStart}</div>
                        <p className="text-xs text-muted-foreground mt-1">{yetToStartPercent}% of Total</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="animate-slide-up shadow-sm mt-6">
                <CardHeader className="border-b pb-4">
                    <CardTitle className="text-xl font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-primary">
                            <Send className="h-5 w-5" />
                            Postings Library
                            <Badge variant="outline" className="ml-2 text-sm font-medium bg-secondary/50">
                                {filteredPostings.length} posts
                            </Badge>
                        </div>
                        <Button
                            onClick={handleExport}
                            disabled={filteredPostings.length === 0}
                            className="bg-primary hover:bg-primary/90 text-white shadow-sm"
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Export Data
                        </Button>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="rounded-md border-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/30 hover:bg-muted/30">
                                    <TableHead className="font-semibold text-foreground h-12">Cluster / Branch</TableHead>
                                    <TableHead className="font-semibold text-foreground h-12">Business Name</TableHead>
                                    <TableHead className="font-semibold text-foreground h-12">Department</TableHead>
                                    <TableHead className="font-semibold text-foreground h-12">Post Type</TableHead>
                                    <TableHead className="font-semibold text-foreground h-12">Date Issued</TableHead>
                                    <TableHead className="font-semibold text-foreground h-12 text-right">Links</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredPostings.length > 0 ? (
                                    filteredPostings.map((post) => (
                                        <TableRow key={post.id} className="hover:bg-muted/20 transition-colors border-b last:border-0">
                                            <TableCell className="py-4 align-top">
                                                <div className="font-medium">{post.cluster}</div>
                                                <div className="text-xs text-muted-foreground mt-0.5">{post.branch}</div>
                                            </TableCell>
                                            <TableCell className="py-4 align-top max-w-[200px] truncate" title={post.businessName}>
                                                {post.businessName || "N/A"}
                                            </TableCell>
                                            <TableCell className="py-4 align-top">
                                                <Badge variant="secondary" className="font-normal">{post.department || "Other"}</Badge>
                                            </TableCell>
                                            <TableCell className="py-4 align-top font-medium flex items-center">
                                                {getIconForPostType(post.typeOfPost)}
                                                {post.typeOfPost}
                                            </TableCell>
                                            <TableCell className="py-4 align-top">
                                                <div className="text-sm">
                                                    {formatDate(post.date)}
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-0.5 font-medium">{post.month}</div>
                                            </TableCell>
                                            <TableCell className="py-4 align-top text-right space-y-2">
                                                {post.gmbPostLink && post.gmbPostLink !== "N/A" && (
                                                    post.gmbPostLink.trim().startsWith('http') ? (
                                                        <a
                                                            href={post.gmbPostLink}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="block text-xs font-semibold text-primary hover:text-primary/80 hover:underline"
                                                        >
                                                            GMB Link
                                                        </a>
                                                    ) : (
                                                        <div className="text-xs text-muted-foreground break-words w-full text-right ml-auto" style={{ maxWidth: "200px" }}>
                                                            {post.gmbPostLink}
                                                        </div>
                                                    )
                                                )}
                                                {post.sourceUrl && post.sourceUrl !== "N/A" && (
                                                    post.sourceUrl.trim().startsWith('http') ? (
                                                        <a
                                                            href={post.sourceUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="block text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                                                        >
                                                            Source Link
                                                        </a>
                                                    ) : (
                                                        <div className="text-xs mt-1 text-muted-foreground break-words w-full text-right ml-auto" style={{ maxWidth: "200px" }}>
                                                            {post.sourceUrl}
                                                        </div>
                                                    )
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                            No postings found matching your current filters.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </DashboardLayout>
    );
};

export default Postings;
