import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { InsightData, DoctorData, LabelData, useMongoData } from "@/hooks/useMongoData";
import {
  Star,
  TrendingUp,
  Phone,
  Mail,
  MapPin,
  Globe,
  Target,
  Users,
  Loader2,
} from "lucide-react";

interface DoctorDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctorName: string;
}

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

export const DoctorDetailModal = ({
  isOpen,
  onClose,
  doctorName, // This is actually the businessName
}: DoctorDetailModalProps) => {
  const { doctors, insights, loading: globalLoading } = useMongoData();
  const [profile, setProfile] = useState<DoctorData | null>(null);
  const [monthlyInsights, setMonthlyInsights] = useState<InsightData[]>([]);
  const [keywords, setKeywords] = useState<LabelData[]>([]);
  const [competitors, setCompetitors] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && doctorName && !globalLoading) {
      // Find the doctor profile locally using businessName (case-insensitive and trimmed)
      const targetName = doctorName.trim().toLowerCase();
      const foundDoctor = doctors.find(d =>
        (d.businessName || "").trim().toLowerCase() === targetName ||
        (d.name || "").trim().toLowerCase() === targetName
      );

      // Find all insights for this doctor
      const foundInsights = insights.filter(i =>
        (i.businessName || "").trim().toLowerCase() === targetName
      );

      if (foundDoctor) {
        setProfile(foundDoctor);
        setKeywords(foundDoctor.labels || []);
        setCompetitors([...new Set(foundDoctor.labels?.flatMap(l => l.competitors || []))] as string[]);
      }

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const sortedInsights = [...foundInsights].sort((a, b) => months.indexOf(a.month) - months.indexOf(b.month));
      setMonthlyInsights(sortedInsights);
    }
  }, [isOpen, doctorName, doctors, insights, globalLoading]);

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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-primary" />
            {doctorName} - Detailed Report
          </DialogTitle>
        </DialogHeader>

        {globalLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="insights" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="insights">Monthly Insights</TabsTrigger>
              <TabsTrigger value="keywords">Keyword Rankings</TabsTrigger>
              <TabsTrigger value="competitors">Competitors</TabsTrigger>
            </TabsList>

            {/* Profile Summary */}
            {profile && (
              <Card className="mt-4">
                <CardContent className="pt-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h3 className="font-semibold">{profile.name}</h3>
                      <Badge variant="secondary">{profile.primaryCategory}</Badge>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Star className="h-4 w-4 fill-warning text-warning" />
                        <span>{profile.averageRating.toFixed(1)}</span>
                        <span>({profile.totalReviewCount} reviews)</span>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span>{profile.address}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span>{profile.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <span>{profile.mailId}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Monthly Insights Tab */}
            <TabsContent value="insights" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Performance Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="month"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                        />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--background))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="Search Mobile"
                          stroke={CHART_COLORS.googleSearchMobile}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="Search Desktop"
                          stroke={CHART_COLORS.googleSearchDesktop}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="Maps Mobile"
                          stroke={CHART_COLORS.googleMapsMobile}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="Maps Desktop"
                          stroke={CHART_COLORS.googleMapsDesktop}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="Calls"
                          stroke={CHART_COLORS.calls}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="Directions"
                          stroke={CHART_COLORS.directions}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="Website Clicks"
                          stroke={CHART_COLORS.websiteClicks}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="Overall"
                          stroke={CHART_COLORS.overall}
                          strokeWidth={3}
                          dot={{ r: 4 }}
                          strokeDasharray="5 5"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Monthly Data Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Monthly Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
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
                          <TableRow key={idx}>
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
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Target className="h-5 w-5 text-primary" />
                    Keyword Rankings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Keyword</TableHead>
                        <TableHead className="text-center">Rank</TableHead>
                        <TableHead>Top Competitors</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {keywords.map((keyword, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{keyword.label}</TableCell>
                          <TableCell className="text-center">
                            {keyword.rank > 0 ? (
                              <Badge
                                variant={keyword.rank <= 3 ? "default" : "secondary"}
                                className={
                                  keyword.rank === 1
                                    ? "bg-success text-success-foreground"
                                    : keyword.rank <= 3
                                      ? "bg-primary text-primary-foreground"
                                      : ""
                                }
                              >
                                #{keyword.rank}
                              </Badge>
                            ) : (
                              <Badge variant="outline">Not Ranked</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {keyword.competitors.slice(0, 3).map((comp, cIdx) => (
                                <Badge key={cIdx} variant="outline" className="text-xs">
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
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Competitors Tab */}
            <TabsContent value="competitors">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="h-5 w-5 text-primary" />
                    Competitor Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {competitors.map((competitor, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-bold">
                          {idx + 1}
                        </div>
                        <span className="font-medium text-sm">{competitor}</span>
                      </div>
                    ))}
                  </div>
                  {competitors.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      No competitor data available
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};
