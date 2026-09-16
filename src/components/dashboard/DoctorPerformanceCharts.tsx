import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { InsightData } from "@/hooks/useMongoData";
import { useMemo } from "react";

interface DoctorPerformanceChartsProps {
  data: InsightData[];
  doctorName: string;
}

const CHART_CONFIG = [
  { key: "googleSearchMobile", label: "Google Search Mobile", color: "hsl(var(--primary))" },
  { key: "googleSearchDesktop", label: "Google Search Desktop", color: "hsl(var(--chart-2))" },
  { key: "googleMapsMobile", label: "Google Maps Mobile", color: "hsl(var(--chart-3))" },
  { key: "googleMapsDesktop", label: "Google Maps Desktop", color: "hsl(var(--chart-4))" },
  { key: "calls", label: "Calls", color: "hsl(var(--chart-5))" },
  { key: "directions", label: "Directions", color: "hsl(var(--success))" },
  { key: "websiteClicks", label: "Website Clicks", color: "hsl(var(--warning))" },
  { key: "overall", label: "Overall Searches", color: "hsl(var(--destructive))" },
];

export const DoctorPerformanceCharts = ({ data, doctorName }: DoctorPerformanceChartsProps) => {
  const chartData = useMemo(() => {
    const targetName = (doctorName || "").trim().toLowerCase();
    const doctorData = data.filter((d) => (d.businessName || "").trim().toLowerCase() === targetName);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    return months.map((month) => {
      const monthRecords = doctorData.filter((d) => {
        const m = (d.month || "").trim().substring(0, 3).toLowerCase();
        return m === month.toLowerCase();
      });

      if (monthRecords.length === 0) {
        return {
          month,
          googleSearchMobile: 0,
          googleSearchDesktop: 0,
          googleMapsMobile: 0,
          googleMapsDesktop: 0,
          calls: 0,
          directions: 0,
          websiteClicks: 0,
          overall: 0,
        };
      }

      const googleSearchMobile = monthRecords.reduce((sum, d) => sum + (d.googleSearchMobile || 0), 0);
      const googleSearchDesktop = monthRecords.reduce((sum, d) => sum + (d.googleSearchDesktop || 0), 0);
      const googleMapsMobile = monthRecords.reduce((sum, d) => sum + (d.googleMapsMobile || 0), 0);
      const googleMapsDesktop = monthRecords.reduce((sum, d) => sum + (d.googleMapsDesktop || 0), 0);
      const calls = monthRecords.reduce((sum, d) => sum + (d.calls || 0), 0);
      const directions = monthRecords.reduce((sum, d) => sum + (d.directions || 0), 0);
      const websiteClicks = monthRecords.reduce((sum, d) => sum + (d.websiteClicks || 0), 0);

      return {
        month,
        googleSearchMobile,
        googleSearchDesktop,
        googleMapsMobile,
        googleMapsDesktop,
        calls,
        directions,
        websiteClicks,
        overall: googleSearchMobile + googleSearchDesktop + googleMapsMobile + googleMapsDesktop,
      };
    });
  }, [data, doctorName]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {CHART_CONFIG.map((config, idx) => (
        <Card key={config.key} className="animate-slide-up" style={{ animationDelay: `${idx * 50}ms` }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {config.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[120px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis
                    dataKey="month"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    width={30}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey={config.key}
                    stroke={config.color}
                    strokeWidth={2}
                    dot={{ r: 2, fill: config.color }}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
