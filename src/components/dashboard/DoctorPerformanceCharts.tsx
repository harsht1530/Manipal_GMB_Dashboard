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
    const doctorData = data.filter((d) => d.businessName === doctorName);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    return months.map((month) => {
      const monthData = doctorData.find((d) => d.month === month);
      if (!monthData) {
        return { month, value: 0 };
      }
      return {
        month,
        googleSearchMobile: monthData.googleSearchMobile,
        googleSearchDesktop: monthData.googleSearchDesktop,
        googleMapsMobile: monthData.googleMapsMobile,
        googleMapsDesktop: monthData.googleMapsDesktop,
        calls: monthData.calls,
        directions: monthData.directions,
        websiteClicks: monthData.websiteClicks,
        overall: monthData.googleSearchMobile + monthData.googleSearchDesktop + monthData.googleMapsMobile + monthData.googleMapsDesktop,
      };
    }).filter((d) => d.googleSearchMobile || d.googleSearchDesktop);
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
