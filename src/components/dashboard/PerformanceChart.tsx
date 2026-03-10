import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { InsightData } from "@/hooks/useMongoData";

interface PerformanceChartProps {
  data: InsightData[];
}

const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface ChartSeries {
  name: string;
  data: (number | null)[];
  color: string;
}

interface ChartItemProps {
  title: string;
  series: ChartSeries[];
  delay?: number;
}

const MiniChart = ({ title, series, delay = 0 }: ChartItemProps) => {
  const options: Highcharts.Options = {
    chart: {
      type: 'line',
      height: 300,
      backgroundColor: 'transparent',
      spacingTop: 30,
      spacingRight: 20,
      spacingBottom: 10,
      spacingLeft: 10,
      style: {
        fontFamily: 'inherit'
      }
    },
    title: {
      text: undefined
    },
    credits: {
      enabled: false
    },
    xAxis: {
      categories: monthOrder,
      labels: {
        style: {
          fontSize: '10px',
          color: 'hsl(var(--muted-foreground))'
        }
      },
      lineColor: 'hsl(var(--border))',
      tickColor: 'hsl(var(--border))'
    },
    yAxis: {
      title: {
        text: undefined
      },
      labels: {
        style: {
          fontSize: '10px',
          color: 'hsl(var(--muted-foreground))'
        }
      },
      gridLineColor: 'hsl(var(--muted))',
      gridLineDashStyle: 'Dash'
    },
    legend: {
      enabled: series.length > 1,
      itemStyle: {
        fontSize: '11px',
        color: 'hsl(var(--muted-foreground))'
      }
    },
    tooltip: {
      backgroundColor: 'white',
      borderRadius: 8,
      shared: true,
      useHTML: true,
      headerFormat: '<span style="font-size: 10px">{point.key}</span><br/>',
      pointFormat: '<span style="color:{point.color}">\u25CF</span> {series.name}: <b>{point.y}</b><br/>'
    },
    plotOptions: {
      line: {
        dataLabels: {
          enabled: true,
          style: {
            fontSize: '11px',
            fontWeight: '600',
            color: 'hsl(var(--foreground))',
            textOutline: 'none'
          },
          formatter: function () {
            return this.y?.toLocaleString();
          },
          crop: false,
          overflow: 'allow',
          padding: 5
        },
        enableMouseTracking: true,
        marker: {
          radius: 4,
          lineWidth: 2,
          lineColor: '#FFFFFF'
        }
      }
    },
    series: series.map(s => ({
      name: s.name,
      data: s.data,
      color: s.color,
      lineWidth: 2.5,
      type: 'line'
    }))
  };

  return (
    <Card className="animate-fade-in h-[385px]" style={{ animationDelay: `${delay}ms` }}>
      <CardHeader className="py-4">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <HighchartsReact
          highcharts={Highcharts}
          options={options}
        />
      </CardContent>
    </Card>
  );
};

export const PerformanceChart = ({ data }: PerformanceChartProps) => {
  const chartData = useMemo(() => {
    // Group data by Year -> Month
    const groupedData: Record<string, Record<string, {
      overallSearches: number;
      mobilePerformance: number;
      desktopPerformance: number;
      websiteClicks: number;
      directions: number;
      calls: number;
    }>> = {};

    data.forEach((item) => {
      const month = item.month.substring(0, 3);
      const d = item.date ? new Date(item.date) : new Date();
      const year = !isNaN(d.getFullYear()) ? d.getFullYear().toString() : "2024";

      if (!groupedData[year]) {
        groupedData[year] = {};
      }
      if (!groupedData[year][month]) {
        groupedData[year][month] = {
          overallSearches: 0,
          mobilePerformance: 0,
          desktopPerformance: 0,
          websiteClicks: 0,
          directions: 0,
          calls: 0,
        };
      }

      groupedData[year][month].overallSearches += (item.googleSearchMobile + item.googleSearchDesktop);
      groupedData[year][month].mobilePerformance += (item.googleSearchMobile + item.googleMapsMobile);
      groupedData[year][month].desktopPerformance += (item.googleSearchDesktop + item.googleMapsDesktop);
      groupedData[year][month].websiteClicks += item.websiteClicks;
      groupedData[year][month].directions += item.directions;
      groupedData[year][month].calls += item.calls;
    });

    // Available years sorted descending
    const availableYears = Object.keys(groupedData).sort((a, b) => parseInt(b) - parseInt(a));

    // Distinct contrasting colors per year (recent to oldest)
    const yearColors = [
      "hsl(var(--primary))", // Typically blue/main brand
      "#f97316",             // Orange (opposite distinction)
      "#10b981",             // Emerald Green
      "#8b5cf6",             // Purple
      "#ef4444",             // Red
    ];

    const generateSeries = (dataKey: keyof typeof groupedData[string][string], baseColorIndex = 0) => {
      return availableYears.map((year, index) => {
        // Map data in strictly chronological month order (Jan-Dec) missing months = null
        const seriesData = monthOrder.map(month => {
          return groupedData[year][month] ? groupedData[year][month][dataKey] : null;
        });

        // Use distinct base color for single year, or high contrast colors for multi-year
        const color = availableYears.length === 1 ? yearColors[baseColorIndex] : yearColors[index % yearColors.length];

        return {
          name: year,
          data: seriesData,
          color: color
        }
      });
    };

    return {
      overallSearches: generateSeries("overallSearches", 0),
      mobilePerformance: generateSeries("mobilePerformance", 1),
      desktopPerformance: generateSeries("desktopPerformance", 2),
      websiteClicks: generateSeries("websiteClicks", 3),
      directions: generateSeries("directions", 0), // Loop back to primary
      calls: generateSeries("calls", 4),
    };
  }, [data]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold tracking-tight">Monthly Performance Trends</h2>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
        <MiniChart
          title="Overall Searches Performance"
          series={chartData.overallSearches}
          delay={0}
        />
        <MiniChart
          title="Mobile (Searches + Maps) Performance"
          series={chartData.mobilePerformance}
          delay={50}
        />
        <MiniChart
          title="Desktop (Searches + Maps) Performance"
          series={chartData.desktopPerformance}
          delay={100}
        />
        <MiniChart
          title="Website Clicks Performance"
          series={chartData.websiteClicks}
          delay={150}
        />
        <MiniChart
          title="Directions Performance"
          series={chartData.directions}
          delay={200}
        />
        <MiniChart
          title="Calls Performance"
          series={chartData.calls}
          delay={250}
        />
      </div>
    </div>
  );
};
