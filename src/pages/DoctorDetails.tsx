
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { InsightData, DoctorData, LabelData, useMongoData } from "@/hooks/useMongoData";
import {
    Star,
    TrendingUp,
    Phone,
    Mail,
    MapPin,
    Target,
    Users,
    Loader2,
    ArrowLeft,
    MessageSquare,
    ThumbsUp,
    ThumbsDown,
    Info,
    Download,
    FileSpreadsheet,
    FileText,
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";
import { useRef } from "react";

const CHART_COLORS = {
    googleSearchMobile: "hsl(var(--primary))",
    googleSearchDesktop: "hsl(var(--chart-2))",
    googleMapsMobile: "hsl(var(--chart-3))",
    googleMapsDesktop: "hsl(var(--chart-4))",
    calls: "hsl(var(--chart-5))",
    directions: "hsl(var(--success))",
    websiteClicks: "hsl(var(--warning))",
    overall: "hsl(var(--destructive))",
};

const PIE_COLORS = [
    "#ef4444", // 1 Star - Red
    "#f97316", // 2 Stars - Orange
    "#eab308", // 3 Stars - Yellow
    "#84cc16", // 4 Stars - Lime
    "#22c55e", // 5 Stars - Green
];

interface ReviewData {
    ratings: number[];
    goodReviews: { comment: string; author: string; date: string }[];
    badReviews: { comment: string; author: string; date: string }[];
}

import { useAuth } from "@/contexts/AuthContext";

const DoctorDetails = () => {
    const { user } = useAuth();
    const { businessName } = useParams<{ businessName: string }>();
    const navigate = useNavigate();
    const { doctors, insights, loading: globalLoading } = useMongoData();
    const [profile, setProfile] = useState<DoctorData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [mounted, setMounted] = useState(false);
    const [monthlyInsights, setMonthlyInsights] = useState<InsightData[]>([]);
    const [keywords, setKeywords] = useState<LabelData[]>([]);
    const [competitors, setCompetitors] = useState<string[]>([]);
    const [reviewData, setReviewData] = useState<ReviewData | null>(null);
    const [reviewsLoading, setReviewsLoading] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setMounted(true);
        }, 10);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        // Wait for global loading to finish
        if (globalLoading) return;

        if (businessName) {
            setIsLoading(true);
            // Find the doctor profile locally using businessName (case-insensitive and trimmed)
            const targetName = decodeURIComponent(businessName).trim().toLowerCase();

            const foundDoctor = doctors.find(d =>
                (d.businessName || "").trim().toLowerCase() === targetName ||
                (d.name || "").trim().toLowerCase() === targetName
            );

            // Find all insights for this doctor
            const foundInsights = insights.filter(i =>
                (i.businessName || "").trim().toLowerCase() === targetName
            );

            if (foundDoctor) {
                // RBAC Check
                if (user?.role !== "Admin") {
                    if (user?.branch && foundDoctor.branch !== user.branch) {
                        navigate("/doctors");
                        return;
                    }
                    if (user?.cluster && foundDoctor.cluster !== user.cluster) {
                        navigate("/doctors");
                        return;
                    }
                }

                setProfile(foundDoctor);
                setKeywords(foundDoctor.labels || []);
                setCompetitors([...new Set(foundDoctor.labels?.flatMap(l => l.competitors || []))] as string[]);

                // Fetch reviews if creds are available
                if (foundDoctor.mailId && foundDoctor.account) {
                    setReviewsLoading(true);
                    fetch('http://localhost:5000/api/reviews', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: foundDoctor.mailId, location: foundDoctor.account })
                    })
                        .then(res => res.json())
                        .then(data => {
                            if (data.success && data.data) {
                                setReviewData(data.data);
                            }
                        })
                        .catch(err => console.error("Failed to fetch reviews", err))
                        .finally(() => setReviewsLoading(false));
                }
            }

            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const sortedInsights = [...foundInsights].sort((a, b) => months.indexOf(a.month) - months.indexOf(b.month));
            setMonthlyInsights(sortedInsights);
            setIsLoading(false);
        }
    }, [businessName, doctors, insights, globalLoading, user, navigate]);

    // Prepare chart data
    const chartData = monthlyInsights.map((item) => ({
        month: item.month,
        "Search Mobile": item.googleSearchMobile,
        "Search Desktop": item.googleSearchDesktop,
        "Maps Mobile": item.googleMapsMobile,
        "Maps Desktop": item.googleMapsDesktop,
        Calls: item.calls,
        Directions: item.directions,
        "Website Clicks": item.websiteClicks,
        Overall:
            item.googleSearchMobile +
            item.googleSearchDesktop +
            item.googleMapsMobile +
            item.googleMapsDesktop,
    }));

    // Prepare chart data for Highcharts
    const performanceOptions: Highcharts.Options = {
        chart: { type: 'line', backgroundColor: 'transparent', style: { fontFamily: 'inherit' } },
        title: { text: undefined },
        xAxis: {
            categories: chartData.map(d => d.month),
            labels: { style: { color: 'hsl(var(--muted-foreground))' } },
            lineColor: 'hsl(var(--border))'
        },
        yAxis: {
            title: { text: undefined },
            labels: { style: { color: 'hsl(var(--muted-foreground))' } },
            gridLineColor: 'hsl(var(--muted))'
        },
        credits: { enabled: false },
        tooltip: { shared: true, borderRadius: 8 },
        plotOptions: {
            line: {
                marker: { radius: 4, lineWidth: 2, lineColor: '#FFFFFF' },
                lineWidth: 2.5,
                dataLabels: {
                    enabled: true,
                    style: { fontSize: '9px', fontWeight: '400' }
                }
            }
        },
        series: [
            { name: "Search Mobile", data: chartData.map(d => d["Search Mobile"]), color: CHART_COLORS.googleSearchMobile, type: 'line' },
            { name: "Search Desktop", data: chartData.map(d => d["Search Desktop"]), color: CHART_COLORS.googleSearchDesktop, type: 'line' },
            { name: "Maps Mobile", data: chartData.map(d => d["Maps Mobile"]), color: CHART_COLORS.googleMapsMobile, type: 'line' },
            { name: "Maps Desktop", data: chartData.map(d => d["Maps Desktop"]), color: CHART_COLORS.googleMapsDesktop, type: 'line' },
            { name: "Calls", data: chartData.map(d => d.Calls), color: CHART_COLORS.calls, type: 'line' },
            { name: "Directions", data: chartData.map(d => d.Directions), color: CHART_COLORS.directions, type: 'line' },
            { name: "Website Clicks", data: chartData.map(d => d["Website Clicks"]), color: CHART_COLORS.websiteClicks, type: 'line' },
            { name: "Overall", data: chartData.map(d => d.Overall), color: CHART_COLORS.overall, lineWidth: 3, dashStyle: 'Dash', type: 'line' }
        ]
    };

    const pieData = reviewData ? [
        { name: '1 Star', y: reviewData.ratings[0], color: PIE_COLORS[0] },
        { name: '2 Stars', y: reviewData.ratings[1], color: PIE_COLORS[1] },
        { name: '3 Stars', y: reviewData.ratings[2], color: PIE_COLORS[2] },
        { name: '4 Stars', y: reviewData.ratings[3], color: PIE_COLORS[3] },
        { name: '5 Stars', y: reviewData.ratings[4], color: PIE_COLORS[4] },
    ] : [];

    const pieOptions: Highcharts.Options = {
        chart: { type: 'pie', backgroundColor: 'transparent', height: 280 },
        title: { text: undefined },
        credits: { enabled: false },
        tooltip: { pointFormat: '{series.name}: <b>{point.y} ({point.percentage:.1f}%)</b>' },
        plotOptions: {
            pie: {
                innerSize: '60%',
                size: '75%',
                dataLabels: {
                    enabled: true,
                    format: '<b>{point.name}</b>: {point.y}',
                    distance: 10,
                    style: { fontSize: '10px' }
                },
                showInLegend: true
            }
        },
        series: [{
            name: 'Reviews',
            type: 'pie',
            data: pieData
        }]
    };

    const printRef = useRef<HTMLDivElement>(null);

    const handleDownloadPDF = async () => {
        if (!printRef.current) return;

        console.log("Generating PDF...");
        try {
            printRef.current.style.display = "block";
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for charts to render

            const canvas = await html2canvas(printRef.current, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: "#ffffff"
            });
            printRef.current.style.display = "none";

            const imgData = canvas.toDataURL("image/png");
            const imgWidth = 210;
            const pageHeight = (canvas.height * imgWidth) / canvas.width;

            const pdf = new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: [imgWidth, pageHeight],
            });

            pdf.addImage(imgData, "PNG", 0, 0, imgWidth, pageHeight);

            pdf.save(`${profile?.name || "Doctor"}_Detailed_Report.pdf`);
        } catch (error) {
            console.error("PDF generation failed:", error);
            if (printRef.current) printRef.current.style.display = "none";
        }
    };

    const handleDownloadExcel = () => {
        if (!monthlyInsights.length) return;

        const worksheet = XLSX.utils.json_to_sheet(monthlyInsights.map(item => ({
            Month: item.month,
            "Search Mobile": item.googleSearchMobile,
            "Search Desktop": item.googleSearchDesktop,
            "Maps Mobile": item.googleMapsMobile,
            "Maps Desktop": item.googleMapsDesktop,
            Calls: item.calls,
            Directions: item.directions,
            "Website Clicks": item.websiteClicks,
        })));

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Monthly Insights");
        XLSX.writeFile(workbook, `${profile?.name || "Doctor"}_Monthly_Data.xlsx`);
    };

    if (!mounted || globalLoading || isLoading) {
        return (
            <DashboardLayout
                title="Doctor Detail Report"
                subtitle="Loading doctor information..."
            >
                <DoctorDetailsSkeleton />
            </DashboardLayout>
        );
    }

    if (!profile) {
        return (
            <DashboardLayout
                title="Doctor Not Found"
                subtitle="The requested doctor profile could not be found."
            >
                <div className="text-center py-24">
                    <p className="text-muted-foreground mb-4">We couldn't find a doctor with the business name "{businessName}".</p>
                    <Button onClick={() => navigate("/doctors")}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Doctors List
                    </Button>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout
            title={`${profile.name}`}
            subtitle="Detailed Performance Report"
        >
            <div className="mb-6 flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={() => navigate("/doctors")}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Doctors List
                </Button>
                <Button onClick={handleDownloadPDF} className="bg-primary text-primary-foreground hover:bg-primary/90">
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF Report
                </Button>
            </div>

            <Tabs defaultValue="insights" className="w-full space-y-6">
                <div className="flex flex-col md:flex-row gap-6 items-start">
                    {/* Profile Summary Card - placed on side or top depending on layout needs, keeping original wide layout */}
                    <Card className="w-full">
                        <CardContent className="pt-6">
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-2xl font-bold text-primary">{profile.name}</h3>
                                        <Badge variant="secondary" className="text-sm px-3 py-1">{profile.primaryCategory}</Badge>
                                    </div>

                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Star className="h-5 w-5 fill-warning text-warning" />
                                        <span className="font-semibold text-foreground text-lg">{profile.averageRating.toFixed(1)}</span>
                                        <span>({profile.totalReviewCount} reviews)</span>
                                    </div>
                                </div>

                                <div className="space-y-3 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-3">
                                        <MapPin className="h-5 w-5 text-primary/70 shrink-0" />
                                        <span className="text-base">{profile.address}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Phone className="h-5 w-5 text-primary/70 shrink-0" />
                                        <span className="text-base">{profile.phone}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Mail className="h-5 w-5 text-primary/70 shrink-0" />
                                        <span className="text-base">{profile.mailId}</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <TabsList className="grid w-full grid-cols-5 h-12">
                    <TabsTrigger value="insights" className="text-base">Monthly Insights</TabsTrigger>
                    <TabsTrigger value="keywords" className="text-base">Keyword Rankings</TabsTrigger>
                    <TabsTrigger value="competitors" className="text-base">Competitors</TabsTrigger>
                    <TabsTrigger value="visuals" className="text-base">Visuals</TabsTrigger>
                    <TabsTrigger value="reviews" className="text-base">Reviews</TabsTrigger>
                </TabsList>

                {/* Monthly Insights Tab */}
                <TabsContent value="insights" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <TrendingUp className="h-5 w-5 text-primary" />
                                Performance Trends
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[400px] w-full">
                                <HighchartsReact
                                    highcharts={Highcharts}
                                    options={performanceOptions}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Monthly Data Table */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Monthly Breakdown</CardTitle>
                            <Button variant="outline" size="sm" onClick={handleDownloadExcel} className="gap-2">
                                <FileSpreadsheet className="h-4 w-4" />
                                Download Excel
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead>Month</TableHead>
                                            <TableHead className="text-center">Search Mobile</TableHead>
                                            <TableHead className="text-center">Search Desktop</TableHead>
                                            <TableHead className="text-center">Maps Mobile</TableHead>
                                            <TableHead className="text-center">Maps Desktop</TableHead>
                                            <TableHead className="text-center">Calls</TableHead>
                                            <TableHead className="text-center">Directions</TableHead>
                                            <TableHead className="text-center">Website</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {monthlyInsights.map((item, idx) => (
                                            <TableRow key={idx} className="hover:bg-muted/50">
                                                <TableCell className="font-medium">{item.month}</TableCell>
                                                <TableCell className="text-center">{item.googleSearchMobile}</TableCell>
                                                <TableCell className="text-center">{item.googleSearchDesktop}</TableCell>
                                                <TableCell className="text-center">{item.googleMapsMobile}</TableCell>
                                                <TableCell className="text-center">{item.googleMapsDesktop}</TableCell>
                                                <TableCell className="text-center">{item.calls}</TableCell>
                                                <TableCell className="text-center">{item.directions}</TableCell>
                                                <TableCell className="text-center">{item.websiteClicks}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Keywords Tab */}
                <TabsContent value="keywords">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Target className="h-5 w-5 text-primary" />
                                Keyword Rankings
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead className="w-[40%]">Keyword</TableHead>
                                            <TableHead className="text-center w-[15%]">Rank</TableHead>
                                            <TableHead className="w-[45%]">Top Competitors</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {keywords.map((keyword, idx) => (
                                            <TableRow key={idx} className="hover:bg-muted/50">
                                                <TableCell className="font-medium">{keyword.label}</TableCell>
                                                <TableCell className="text-center">
                                                    {keyword.rank > 0 ? (
                                                        <Badge
                                                            variant={keyword.rank <= 3 ? "default" : "secondary"}
                                                            className={
                                                                keyword.rank === 1
                                                                    ? "bg-emerald-500 hover:bg-emerald-600 border-emerald-500"
                                                                    : keyword.rank <= 3
                                                                        ? "bg-blue-500 hover:bg-blue-600 border-blue-500"
                                                                        : ""
                                                            }
                                                        >
                                                            #{keyword.rank}
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-muted-foreground">Not Ranked</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {keyword.competitors.slice(0, 3).map((comp, cIdx) => (
                                                            <Badge key={cIdx} variant="outline" className="text-xs bg-muted/50">
                                                                {comp}
                                                            </Badge>
                                                        ))}
                                                        {keyword.competitors.length > 3 && (
                                                            <Badge variant="secondary" className="text-xs">
                                                                +{keyword.competitors.length - 3}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {keywords.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                                    No keyword ranking data available.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Competitors Tab */}
                <TabsContent value="competitors">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5 text-primary" />
                                Competitor Analysis
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {competitors.map((competitor, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:shadow-md transition-all duration-200"
                                    >
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold shadow-sm">
                                            {idx + 1}
                                        </div>
                                        <span className="font-medium">{competitor}</span>
                                    </div>
                                ))}
                            </div>
                            {competitors.length === 0 && (
                                <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
                                    <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                    <p>No competitor data available available for this profile.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Visuals Tab */}
                <TabsContent value="visuals">
                    <div className="grid gap-6">
                        {/* GMB Profile Preview */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <MapPin className="h-5 w-5 text-primary" />
                                    GMB Profile Appearance
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex justify-center bg-muted/20 py-8">
                                {profile.profileScreenshot ? (
                                    <div className="relative rounded-lg overflow-hidden shadow-md border max-w-2xl w-full">
                                        <img
                                            src={`https://multipliersolutions.in/gmbprofiles/Manipal/${profile.profileScreenshot}`}
                                            alt="GMB Profile Screenshot"
                                            className="w-full h-auto object-cover"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = "https://placehold.co/600x400?text=Profile+Preview+Not+Available";
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <MapPin className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                        <p>No GMB profile screenshot available.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Keyword Search Results */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Target className="h-5 w-5 text-primary" />
                                    Top Keyword Search Result
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid md:grid-cols-1 gap-6">
                                    {keywords.filter(k => k.screenShot).slice(0, 1).map((keyword, idx) => (
                                        <div key={idx} className="space-y-3 max-w-2xl mx-auto w-full">
                                            <div className="flex items-center justify-between">
                                                <Badge variant="outline" className="text-sm font-medium px-3 py-1">
                                                    {keyword.label}
                                                </Badge>
                                                <Badge className={`
                          ${keyword.rank === 1 ? "bg-emerald-500" : keyword.rank <= 3 ? "bg-blue-500" : "bg-primary"}
                        `}>
                                                    #{keyword.rank}
                                                </Badge>
                                            </div>
                                            <div className="rounded-lg overflow-hidden border shadow-sm aspect-video bg-muted/20 flex items-center justify-center">
                                                <img
                                                    src={`https://multipliersolutions.in/gmbprofiles/Manipal/${keyword.screenShot}.webp`}
                                                    alt={`Search result for ${keyword.label}`}
                                                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                        (e.target as HTMLImageElement).parentElement!.innerText = 'Screenshot Load Failed';
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    {keywords.filter(k => k.screenShot).length === 0 && (
                                        <div className="col-span-full text-center py-12 text-muted-foreground bg-muted/10 rounded-lg border border-dashed">
                                            <Target className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                            <p>No search result screenshots available for ranked keywords.</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Reviews Analysis Tab */}
                <TabsContent value="reviews">
                    {reviewsLoading ? (
                        <div className="flex flex-col items-center justify-center py-24">
                            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                            <p className="text-muted-foreground">Analyzing Review Sentiment...</p>
                        </div>
                    ) : !reviewData ? (
                        <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
                            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-20" />
                            <p>No review data available for analysis.</p>
                        </div>
                    ) : (
                        <div className="grid gap-6">
                            {/* Sentiment & Ratings Overview */}
                            {/* Sentiment & Ratings Overview */}
                            <div className="grid md:grid-cols-2 gap-6">
                                <Card className="md:col-span-2">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Star className="h-5 w-5 text-warning fill-warning" />
                                            Rating Analysis
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex flex-col md:flex-row items-center justify-around gap-8">
                                            {/* Chart Section */}
                                            <div className="h-[300px] w-full max-w-[500px]">
                                                <HighchartsReact
                                                    highcharts={Highcharts}
                                                    options={pieOptions}
                                                />
                                            </div>

                                            {/* Stats Section */}
                                            <div className="flex flex-col items-center justify-center space-y-6 p-6 bg-muted/20 rounded-xl min-w-[300px]">
                                                <div className="text-center">
                                                    <h3 className="text-4xl font-bold text-foreground">
                                                        {(reviewData.ratings.reduce((acc, count, i) => acc + count * (i + 1), 0) / Math.max(1, reviewData.ratings.reduce((a, b) => a + b, 0))).toFixed(1)}
                                                    </h3>
                                                    <div className="flex items-center justify-center gap-1 my-2">
                                                        {[1, 2, 3, 4, 5].map((star) => (
                                                            <Star
                                                                key={star}
                                                                className={`h-5 w-5 ${star <= Math.round(reviewData.ratings.reduce((acc, count, i) => acc + count * (i + 1), 0) / Math.max(1, reviewData.ratings.reduce((a, b) => a + b, 0)))
                                                                    ? "text-warning fill-warning"
                                                                    : "text-muted-foreground/30"
                                                                    }`}
                                                            />
                                                        ))}
                                                    </div>
                                                    <p className="text-muted-foreground font-medium">Average Rating</p>
                                                </div>

                                                <div className="w-full h-px bg-border/50" />

                                                <div className="text-center">
                                                    <h3 className="text-3xl font-bold text-foreground">
                                                        {reviewData.ratings.reduce((a, b) => a + b, 0)}
                                                    </h3>
                                                    <p className="text-muted-foreground font-medium">Total Reviews</p>
                                                </div>

                                                <div className="w-full h-px bg-border/50" />

                                                {reviewData.ratings[3] + reviewData.ratings[4] > reviewData.ratings[0] + reviewData.ratings[1] ? (
                                                    <div className="flex items-center gap-2 text-emerald-600 font-semibold bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 rounded-full">
                                                        <ThumbsUp className="h-4 w-4" />
                                                        <span>Excellent Performance!</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-destructive font-semibold bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-full">
                                                        <ThumbsDown className="h-4 w-4" />
                                                        <span>Needs Attention</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Top Reviews List */}
                            <div className="grid md:grid-cols-2 gap-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-emerald-600">
                                            <ThumbsUp className="h-5 w-5" />
                                            Top Positive Feedback
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            {reviewData.goodReviews.length > 0 ? reviewData.goodReviews.map((review, i) => (
                                                <div key={i} className="p-4 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-lg border border-emerald-100 dark:border-emerald-900/20">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="font-semibold text-sm">{review.author}</span>
                                                        <span className="text-xs text-muted-foreground">{new Date(review.date).toLocaleDateString()}</span>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground italic">"{review.comment}"</p>
                                                </div>
                                            )) : (
                                                <div className="text-center py-8 text-muted-foreground">No positive comments found.</div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-destructive">
                                            <ThumbsDown className="h-5 w-5" />
                                            Critical Feedback
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            {reviewData.badReviews.length > 0 ? reviewData.badReviews.map((review, i) => (
                                                <div key={i} className="p-4 bg-red-50/50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/20">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="font-semibold text-sm">{review.author}</span>
                                                        <span className="text-xs text-muted-foreground">{new Date(review.date).toLocaleDateString()}</span>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground italic">"{review.comment}"</p>
                                                </div>
                                            )) : (
                                                <div className="text-center py-8 text-muted-foreground">No critical comments found.</div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    )}
                </TabsContent>
            </Tabs >
            {/* Hidden Print Layout */}
            <div ref={printRef} style={{ display: 'none' }} className="bg-white text-black p-10 w-[1200px] mx-auto absolute top-0 left-0 z-50">
                <div className="space-y-10">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b pb-6">
                        <div>
                            <h1 className="text-3xl font-bold mb-2 text-primary">{profile.name}</h1>
                            <p className="text-xl text-muted-foreground">Detailed Performance Report</p>
                        </div>
                        <div className="text-right">
                            <div className="flex items-center justify-end gap-2 mb-2">
                                <Star className="h-6 w-6 text-warning fill-warning" style={{ transform: 'translateY(2px)' }} />
                                <span className="text-2xl font-bold">{profile.averageRating.toFixed(1)}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">{profile.totalReviewCount} Reviews</p>
                        </div>
                    </div>

                    {/* Contact Info */}
                    <div className="grid grid-cols-3 gap-6 bg-muted/20 p-6 rounded-lg">
                        <div className="flex items-center gap-3">
                            <MapPin className="h-5 w-5 text-primary" style={{ transform: 'translateY(2px)' }} />
                            <span className="text-sm font-medium">{profile.address}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Phone className="h-5 w-5 text-primary" style={{ transform: 'translateY(2px)' }} />
                            <span className="text-sm font-medium">{profile.phone}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Mail className="h-5 w-5 text-primary" style={{ transform: 'translateY(2px)' }} />
                            <span className="text-sm font-medium">{profile.mailId}</span>
                        </div>
                    </div>

                    {/* Monthly Insights */}
                    <div>
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                            <TrendingUp className="h-6 w-6 text-primary" style={{ transform: 'translateY(2px)' }} />
                            Monthly Insights
                        </h2>
                        <div className="h-[450px] w-full mb-12 border rounded-lg p-4">
                            <HighchartsReact
                                highcharts={Highcharts}
                                options={{
                                    ...performanceOptions,
                                    chart: { ...performanceOptions.chart, animation: false },
                                    plotOptions: { ...performanceOptions.plotOptions, series: { animation: false } }
                                }}
                            />
                        </div>
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted">
                                        <TableHead>Month</TableHead>
                                        <TableHead className="text-center">Search Mob</TableHead>
                                        <TableHead className="text-center">Maps Mob</TableHead>
                                        <TableHead className="text-center">Calls</TableHead>
                                        <TableHead className="text-center">Directions</TableHead>
                                        <TableHead className="text-center">Website</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {monthlyInsights.map((item, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell className="font-medium">{item.month}</TableCell>
                                            <TableCell className="text-center">{item.googleSearchMobile}</TableCell>
                                            <TableCell className="text-center">{item.googleMapsMobile}</TableCell>
                                            <TableCell className="text-center">{item.calls}</TableCell>
                                            <TableCell className="text-center">{item.directions}</TableCell>
                                            <TableCell className="text-center">{item.websiteClicks}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    {/* Keywords */}
                    <div>
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                            <Target className="h-6 w-6 text-primary" style={{ transform: 'translateY(2px)' }} />
                            Top Keyword Rankings
                        </h2>
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted">
                                        <TableHead>Keyword</TableHead>
                                        <TableHead className="text-center">Rank</TableHead>
                                        <TableHead>Top Competitors</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {keywords.slice(0, 10).map((keyword, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell className="font-medium">{keyword.label}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge
                                                    className={
                                                        keyword.rank === 1 ? "bg-emerald-500" : keyword.rank <= 3 ? "bg-blue-500" : ""
                                                    }
                                                >
                                                    #{keyword.rank}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {keyword.competitors.slice(0, 2).join(", ")}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    {/* Visuals */}
                    {keywords.filter(k => k.screenShot).length > 0 && (
                        <div>
                            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                                <Target className="h-6 w-6 text-primary" style={{ transform: 'translateY(2px)' }} />
                                Top Search Result Visualization
                            </h2>
                            <div className="border rounded-lg p-2 bg-muted/20 w-[600px] mx-auto">
                                <img
                                    src={`https://multipliersolutions.in/gmbprofiles/Manipal/${keywords.filter(k => k.screenShot)[0].screenShot}.webp`}
                                    alt="Search Verification"
                                    className="w-full h-auto object-cover rounded"
                                />
                            </div>
                        </div>
                    )}

                    {/* Reviews */}
                    {reviewData && (
                        <div>
                            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                                <MessageSquare className="h-6 w-6 text-primary" style={{ transform: 'translateY(2px)' }} />
                                Review Analysis
                            </h2>
                            <div className="grid grid-cols-2 gap-8 items-start">
                                <div className="h-[300px] border rounded-lg p-4 flex items-center justify-center">
                                    <HighchartsReact
                                        highcharts={Highcharts}
                                        options={{
                                            ...pieOptions,
                                            chart: { ...pieOptions.chart, animation: false },
                                            plotOptions: { ...pieOptions.plotOptions, pie: { ...pieOptions.plotOptions?.pie, animation: false } }
                                        }}
                                    />
                                </div>
                                <div className="space-y-4">
                                    <div className="border rounded-lg p-4 bg-emerald-50">
                                        <h3 className="font-bold text-emerald-700 mb-2">Top Positive Feedback</h3>
                                        {reviewData.goodReviews.slice(0, 2).map((r, i) => (
                                            <div key={i} className="mb-2 text-sm italic">"{r.comment}"</div>
                                        ))}
                                    </div>
                                    <div className="border rounded-lg p-4 bg-red-50">
                                        <h3 className="font-bold text-red-700 mb-2">Top Critical Feedback</h3>
                                        {reviewData.badReviews.slice(0, 2).map((r, i) => (
                                            <div key={i} className="mb-2 text-sm italic">"{r.comment}"</div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout >
    );
};

const DoctorDetailsSkeleton = () => {
    return (
        <div className="space-y-6">
            {/* Action Buttons Skeleton */}
            <div className="flex items-center justify-between mb-6">
                <Skeleton className="h-9 w-32" />
                <Skeleton className="h-9 w-40" />
            </div>

            {/* Profile Summary Card Skeleton */}
            <Card>
                <CardContent className="pt-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Skeleton className="h-8 w-1/2" />
                                <Skeleton className="h-6 w-24" />
                            </div>
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-5 w-5 rounded-full" />
                                <Skeleton className="h-6 w-32" />
                            </div>
                        </div>
                        <div className="space-y-3">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-2/3" />
                            <Skeleton className="h-4 w-1/2" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tabs List Skeleton */}
            <div className="grid grid-cols-5 gap-2 h-12 bg-muted/20 p-1 rounded-lg">
                <Skeleton className="h-full w-full" />
                <Skeleton className="h-full w-full" />
                <Skeleton className="h-full w-full" />
                <Skeleton className="h-full w-full" />
                <Skeleton className="h-full w-full" />
            </div>

            {/* Content Area Skeleton */}
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-48" />
                </CardHeader>
                <CardContent className="space-y-6">
                    <Skeleton className="h-[300px] w-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default DoctorDetails;
