import { useState, useMemo, useEffect, useTransition } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Globe, Clock, Phone, MapPin, Key, Image as ImageIcon, Camera, Building2, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";
import { useAuth } from "@/contexts/AuthContext";
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

interface OptimizationData {
  _id: string;
  Location: string;
  "Business Name": string;
  "Profile Url": string;
  Website: string;
  "Website Link": string;
  Timings: string;
  "Phone number": string;
  "Phone Number ": string;
  Address: string;
  "Address Detail": string;
  Keywords: string;
  Description: string;
  "Cover Photo": string;
  Logo: string;
}

const PanIndiaOptimization = () => {
  const { user } = useAuth();
  const [data, setData] = useState<OptimizationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  // Sidebar Filters (From Layout)
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedRatings, setSelectedRatings] = useState<number[]>([]);

  // Page Level Filters
  const [selectedBranch, setSelectedBranch] = useState<string[]>([]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Chart State
  const [chartView, setChartView] = useState<'Overall' | 'By Activity'>('Overall');
  const [selectedActivity, setSelectedActivity] = useState<string>('All');

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 10);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Admin, Cluster or Branch roles can limit data if needed. 
    // Usually cluster corresponds to another grouping, but here we just have Location.
    // Assuming user.branch would map to Location
    if (user?.branch) {
      setSelectedBranch([user.branch]);
    }
  }, [user]);

  useEffect(() => {
    const fetchOptimizations = async () => {
        setLoading(true);
        try {
            const API_URL = `${import.meta.env.VITE_API_BASE_URL || "https://smldatamanagement.multiplierai.co"}/api`;
            const res = await fetch(`${API_URL}/optimizations`);
            const json = await res.json();
            if (json.success && json.data) {
                setData(json.data);
            }
        } catch (error) {
            console.error("Failed to fetch optimization data", error);
        } finally {
            setLoading(false);
        }
    };
    fetchOptimizations();
  }, []);

  const isBranchRestricted = !!user?.branch;

  const dashboardTitle = "Pan India Optimization";
  const dashboardSubtitle = "Track Google Business Profile optimization completeness across locations";

  // Extract unique branches
  const filterOptions = useMemo(() => {
    if (!data) return { branches: [] };
    const branches = [...new Set(data.map(d => d.Location))].filter(Boolean).sort();
    return { branches };
  }, [data]);

  // Apply filters
  const filteredData = useMemo(() => {
    if (!data) return [];
    return data.filter(item => {
      const branchMatch = selectedBranch.length === 0 || selectedBranch.includes(item.Location);
      return branchMatch;
    });
  }, [data, selectedBranch]);

  // Reset pagination when data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredData]);

  // Chart Data Preparation
  const chartOptions = useMemo(() => {
    const monthlyStats: Record<string, any> = {};
    
    filteredData.forEach(item => {
      // Use explicit Month field, otherwise fall back to Date matching or "Mar 2026"
      let monthKey = "Mar 2026";
      let d: Date | null = null;

      if ((item as any).Month && (item as any).Year) {
         monthKey = `${(item as any).Month} ${(item as any).Year}`;
      } else if ((item as any).Month) {
         monthKey = (item as any).Month;
      } else if ((item as any).Date) {
         // Some date parsers return invalid, we keep fallback
         try {
            d = new Date((item as any).Date);
            if (!isNaN(d.getTime())) {
                monthKey = d.toLocaleString('default', { month: 'short', year: 'numeric' });
            }
         } catch(e) {}
      }

      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = {
            totalProfiles: 0,
            Website: 0,
            Timings: 0,
            "Phone number": 0,
            Address: 0,
            Keywords: 0,
            Description: 0,
            "Cover Photo": 0,
            Logo: 0,
            fullyOptimized: 0,
            timestamp: d ? d.getTime() : new Date("March 1, 2026").getTime()
        };
      }
      
      let optCount = 0;
      if (item.Website === "Yes") { monthlyStats[monthKey].Website++; optCount++; }
      if (item.Timings === "Yes") { monthlyStats[monthKey].Timings++; optCount++; }
      if (item["Phone number"] === "Yes") { monthlyStats[monthKey]["Phone number"]++; optCount++; }
      if (item.Address === "Yes") { monthlyStats[monthKey].Address++; optCount++; }
      if (item.Keywords === "Yes") { monthlyStats[monthKey].Keywords++; optCount++; }
      if (item.Description === "Yes") { monthlyStats[monthKey].Description++; optCount++; }
      if (item["Cover Photo"] === "Yes") { monthlyStats[monthKey]["Cover Photo"]++; optCount++; }
      if (item.Logo === "Yes") { monthlyStats[monthKey].Logo++; optCount++; }

      if (optCount === 8) {
          monthlyStats[monthKey].fullyOptimized++;
      }
      monthlyStats[monthKey].totalProfiles++;
    });

    const categories = Object.keys(monthlyStats).sort((a,b) => monthlyStats[a].timestamp - monthlyStats[b].timestamp);
    
    const series: any[] = [];
    const activities = ['Keywords', 'Website', 'Description', 'Timings', 'Cover Photo', 'Phone number', 'Address', 'Logo'];
    const activityLabels: Record<string, string> = {
        'Keywords': 'Keywords',
        'Website': 'Website',
        'Description': 'Description',
        'Timings': 'Timings',
        'Cover Photo': 'Photos',
        'Phone number': 'Contact',
        'Address': 'Address',
        'Logo': 'Logo'
    };
    const activityColors: Record<string, string> = {
        'Keywords': '#8b5cf6', // Purple
        'Website': '#6366f1', // Indigo
        'Description': '#0ea5e9', // Cyan
        'Timings': '#fbbf24', // Amber
        'Cover Photo': '#ec4899', // Pink
        'Phone number': '#10b981', // Emerald
        'Address': '#f97316', // Orange
        'Logo': '#14b8a6' // Teal
    };

    let actsToPlot = activities; // Default to 'Overall' showing all lines
    if (chartView === 'By Activity') {
        actsToPlot = selectedActivity === 'All' ? ['Keywords'] : [selectedActivity];
    }

    actsToPlot.forEach(act => {
         series.push({
             name: activityLabels[act],
             data: categories.map(m => monthlyStats[m][act] || 0),
             color: activityColors[act],
             marker: { symbol: 'circle' }
         });
    });

    return {
      chart: { type: 'spline', backgroundColor: 'transparent', height: 350 },
      title: { text: null },
      xAxis: { categories, labels: { style: { color: '#64748b', fontFamily: 'Inter' } }, gridLineWidth: 0, tickWidth: 0 },
      yAxis: { 
        title: { text: null }, 
        labels: { style: { color: '#94a3b8', fontFamily: 'Inter' } },
        gridLineColor: '#f1f5f9',
        min: 0,
        allowDecimals: false
      },
      tooltip: { shared: true, crosshairs: true },
      plotOptions: { 
          spline: { 
              lineWidth: 2.5,
              marker: { enabled: true, radius: 4, symbol: 'circle' }
          } 
      },
      legend: { enabled: false }, // Using custom React buttons instead
      series: series,
      credits: { enabled: false }
    };
  }, [filteredData, chartView, selectedActivity]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
      const startIndex = (currentPage - 1) * itemsPerPage;
      return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage]);

  // Calculate Metrics
  const metrics = useMemo(() => {
    const total = filteredData.length;
    let website = 0, timings = 0, phone = 0, address = 0, keywords = 0, description = 0, coverPhoto = 0, logo = 0;
    
    filteredData.forEach(item => {
      if (item.Website === "Yes") website++;
      if (item.Timings === "Yes") timings++;
      if (item["Phone number"] === "Yes") phone++;
      if (item.Address === "Yes") address++;
      if (item.Keywords === "Yes") keywords++;
      if (item.Description === "Yes") description++;
      if (item["Cover Photo"] === "Yes") coverPhoto++;
      if (item.Logo === "Yes") logo++;
    });

    return { total, website, timings, phone, address, keywords, description, coverPhoto, logo };
  }, [filteredData]);

  const handleExport = () => {
    if (!filteredData.length) return;
    const ws = XLSX.utils.json_to_sheet(filteredData.map(d => ({
        "Location": d.Location,
        "Business Name": d["Business Name"],
        "Website": d.Website,
        "Timings": d.Timings,
        "Phone": d["Phone number"],
        "Address": d.Address,
        "Keywords": d.Keywords,
        "Description": d.Description,
        "Cover Photo": d["Cover Photo"],
        "Logo": d.Logo
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Optimizations");
    XLSX.writeFile(wb, `Pan_India_Optimization_Data_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const MetricCard = ({ title, count, total, icon: Icon, color }: { title: string, count: number, total: number, icon: any, color: string }) => {
     const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
     return (
        <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                <Icon className={`h-4 w-4 ${color}`} />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{count} <span className="text-sm font-normal text-muted-foreground">/ {total}</span></div>
                <div className="mt-1 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{percentage}% Optimized</p>
                    <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${color.replace('text-', 'bg-')}`} style={{ width: `${percentage}%` }}></div>
                    </div>
                </div>
            </CardContent>
        </Card>
     );
  };

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
            <div className="space-y-6">
                <div className="flex gap-4 mb-6">
                    <Skeleton className="h-10 w-48" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
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
            selectedCluster={[]} // Not applicable for optimization data based on schema provided
            selectedBranch={selectedBranch}
            selectedMonth={[]}
            selectedSpeciality={[]}
            onClusterChange={() => {}} 
            onBranchChange={(val) => startTransition(() => setSelectedBranch(val))}
            onMonthChange={() => {}}
            onSpecialityChange={() => {}}
            clusterOptions={[]}
            branchOptions={filterOptions.branches}
            monthOptions={[]}
            specialityOptions={[]}
            hideCluster={true}
            hideBranch={isBranchRestricted}
            hideSpeciality={true}
            selectedYear={[]}
            yearOptions={[]}
            onYearChange={() => {}}
        />

        {/* Cards section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <MetricCard title="Website" count={metrics.website} total={metrics.total} icon={Globe} color="text-blue-500" />
            <MetricCard title="Timings" count={metrics.timings} total={metrics.total} icon={Clock} color="text-amber-500" />
            <MetricCard title="Phone Number" count={metrics.phone} total={metrics.total} icon={Phone} color="text-green-500" />
            <MetricCard title="Address" count={metrics.address} total={metrics.total} icon={MapPin} color="text-red-500" />
            <MetricCard title="Keywords" count={metrics.keywords} total={metrics.total} icon={Key} color="text-purple-500" />
            <MetricCard title="Description" count={metrics.description} total={metrics.total} icon={Building2} color="text-indigo-500" />
            <MetricCard title="Cover Photo" count={metrics.coverPhoto} total={metrics.total} icon={ImageIcon} color="text-pink-500" />
            <MetricCard title="Logo" count={metrics.logo} total={metrics.total} icon={Camera} color="text-teal-500" />
        </div>

        {/* Chart Section */}
        <Card className="animate-slide-up shadow-sm mt-6">
            <CardHeader className="border-b pb-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-xl font-bold text-slate-800">
                            Monthly Optimization Trend
                        </CardTitle>
                        <p className="text-sm text-slate-500 mt-1">Number of profiles with completed optimization per month</p>
                    </div>
                    <div className="flex shrink-0 bg-slate-100 p-1 rounded-lg self-start md:self-auto">
                        <button 
                            onClick={() => { setChartView('Overall'); setSelectedActivity('All'); }}
                            className={`px-5 py-2 rounded-md text-sm font-semibold transition-colors ${chartView === 'Overall' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Overall
                        </button>
                        <button 
                            onClick={() => { 
                                setChartView('By Activity'); 
                                if (selectedActivity === 'All') setSelectedActivity('Keywords'); 
                            }}
                            className={`px-5 py-2 rounded-md text-sm font-semibold transition-colors ${chartView === 'By Activity' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            By Activity
                        </button>
                    </div>
                </div>
                
                <div className="flex flex-wrap gap-3 mt-6">
                    {[
                        { id: 'Keywords', label: 'Keywords', color: '#8b5cf6' },
                        { id: 'Website', label: 'Website', color: '#6366f1' },
                        { id: 'Description', label: 'Description', color: '#0ea5e9' },
                        { id: 'Timings', label: 'Timings', color: '#fbbf24' },
                        { id: 'Cover Photo', label: 'Photos', color: '#ec4899' },
                        { id: 'Phone number', label: 'Contact', color: '#10b981' },
                        { id: 'Address', label: 'Address', color: '#f97316' },
                        { id: 'Logo', label: 'Logo', color: '#14b8a6' },
                    ].map(act => {
                        const isSelected = chartView === 'Overall' || (chartView === 'By Activity' && selectedActivity === act.id);
                        return (
                            <button 
                                key={act.id}
                                onClick={() => { setChartView('By Activity'); setSelectedActivity(act.id); }}
                                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all border ${isSelected ? 'text-white border-transparent shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                                style={{ backgroundColor: isSelected ? act.color : undefined }}
                            >
                                {act.label}
                            </button>
                        );
                    })}
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                <HighchartsReact highcharts={Highcharts} options={chartOptions} />
            </CardContent>
        </Card>

        <Card className="animate-slide-up shadow-sm mt-6">
            <CardHeader className="border-b pb-4">
                <CardTitle className="text-xl font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-primary">
                        <Building2 className="h-5 w-5" />
                        Location Profiles
                        <Badge variant="outline" className="ml-2 text-sm font-medium bg-secondary/50">
                            {filteredData.length} total
                        </Badge>
                    </div>
                    <Button
                        onClick={handleExport}
                        disabled={filteredData.length === 0}
                        className="bg-primary hover:bg-primary/90 text-white shadow-sm"
                    >
                        <Download className="mr-2 h-4 w-4" />
                        Export Data
                    </Button>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="rounded-md border-0 overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                                <TableHead className="font-semibold text-foreground h-12 whitespace-nowrap min-w-[150px]">Location</TableHead>
                                <TableHead className="font-semibold text-foreground h-12 whitespace-nowrap min-w-[200px]">Business Name</TableHead>
                                <TableHead className="font-semibold text-foreground h-12 text-center whitespace-nowrap">Website</TableHead>
                                <TableHead className="font-semibold text-foreground h-12 text-center whitespace-nowrap">Timings</TableHead>
                                <TableHead className="font-semibold text-foreground h-12 text-center whitespace-nowrap">Phone</TableHead>
                                <TableHead className="font-semibold text-foreground h-12 text-center whitespace-nowrap">Address</TableHead>
                                <TableHead className="font-semibold text-foreground h-12 text-center whitespace-nowrap">Keywords</TableHead>
                                <TableHead className="font-semibold text-foreground h-12 text-center whitespace-nowrap">Cover Photo</TableHead>
                                <TableHead className="font-semibold text-foreground h-12 text-center whitespace-nowrap">Logo</TableHead>
                                <TableHead className="font-semibold text-foreground h-12 text-right whitespace-nowrap min-w-[150px]">GMB Profile</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedData.length > 0 ? (
                                paginatedData.map((item, idx) => (
                                    <TableRow key={item._id || idx} className="hover:bg-muted/20 transition-colors border-b last:border-0">
                                        <TableCell className="py-4 align-top font-medium">
                                            {item.Location || "N/A"}
                                        </TableCell>
                                        <TableCell className="py-4 align-top">
                                            {item["Business Name"] || "N/A"}
                                        </TableCell>
                                        <TableCell className="py-4 align-top text-center">
                                            <Badge variant={item.Website === "Yes" ? "default" : "secondary"} className={item.Website === "Yes" ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20" : ""}>
                                                {item.Website || "No"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="py-4 align-top text-center">
                                            <Badge variant={item.Timings === "Yes" ? "default" : "secondary"} className={item.Timings === "Yes" ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20" : ""}>
                                                {item.Timings || "No"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="py-4 align-top text-center">
                                            <Badge variant={item["Phone number"] === "Yes" ? "default" : "secondary"} className={item["Phone number"] === "Yes" ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20" : ""}>
                                                {item["Phone number"] || "No"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="py-4 align-top text-center">
                                            <Badge variant={item.Address === "Yes" ? "default" : "secondary"} className={item.Address === "Yes" ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20" : ""}>
                                                {item.Address || "No"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="py-4 align-top text-center">
                                            <Badge variant={item.Keywords === "Yes" ? "default" : "secondary"} className={item.Keywords === "Yes" ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20" : ""}>
                                                {item.Keywords || "No"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="py-4 align-top text-center">
                                            <Badge variant={item["Cover Photo"] === "Yes" ? "default" : "secondary"} className={item["Cover Photo"] === "Yes" ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20" : ""}>
                                                {item["Cover Photo"] || "No"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="py-4 align-top text-center">
                                            <Badge variant={item.Logo === "Yes" ? "default" : "secondary"} className={item.Logo === "Yes" ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20" : ""}>
                                                {item.Logo || "No"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="py-4 align-top text-right">
                                            {item["Profile Url"] && item["Profile Url"] !== "N/A" && (
                                                <a
                                                    href={item["Profile Url"]}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center text-xs font-semibold text-primary hover:text-primary/80 hover:underline"
                                                >
                                                    View Profile
                                                    <Globe className="h-3 w-3 ml-1" />
                                                </a>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                                        No optimizations data found matching your current filters.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                
                {/* Pagination Controls */}
                {filteredData.length > 0 && (
                    <div className="flex items-center justify-between p-4 border-t bg-muted/10">
                        <div className="text-sm text-muted-foreground flex-1">
                            Showing <span className="font-medium text-foreground">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium text-foreground">{Math.min(currentPage * itemsPerPage, filteredData.length)}</span> of <span className="font-medium text-foreground">{filteredData.length}</span> entries
                        </div>
                        <div className="flex items-center space-x-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="h-8 shadow-sm"
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                Previous
                            </Button>
                            <div className="flex items-center justify-center text-sm font-medium w-8 h-8 rounded-md border bg-background text-foreground shadow-sm">
                                {currentPage}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages || totalPages === 0}
                                className="h-8 shadow-sm"
                            >
                                Next
                                <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    </DashboardLayout>
  );
};

export default PanIndiaOptimization;
