import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { InsightData } from "@/hooks/useMongoData";

interface PerformanceChartProps {
  data: InsightData[];
}

const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface ChartItemProps {
  title: string;
  data: any[];
  dataKey: string;
  color: string;
  delay?: number;
}

const MiniChart = ({ title, data, dataKey, color, delay = 0 }: ChartItemProps) => {
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
      categories: data.map(d => d.month),
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
      enabled: false
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
          fillColor: color,
          lineWidth: 2,
          lineColor: '#FFFFFF'
        }
      }
    },
    series: [{
      name: title,
      data: data.map(d => d[dataKey]),
      color: color,
      lineWidth: 2.5,
      type: 'line'
    }]
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
    const monthlyData: Record<string, {
      month: string;
      overallSearches: number;
      mobilePerformance: number;
      desktopPerformance: number;
      websiteClicks: number;
      directions: number;
      calls: number;
    }> = {};

    data.forEach((item) => {
      const month = item.month.substring(0, 3);
      if (!monthlyData[month]) {
        monthlyData[month] = {
          month,
          overallSearches: 0,
          mobilePerformance: 0,
          desktopPerformance: 0,
          websiteClicks: 0,
          directions: 0,
          calls: 0,
        };
      }
      monthlyData[month].overallSearches += (item.googleSearchMobile + item.googleSearchDesktop);
      monthlyData[month].mobilePerformance += (item.googleSearchMobile + item.googleMapsMobile);
      monthlyData[month].desktopPerformance += (item.googleSearchDesktop + item.googleMapsDesktop);
      monthlyData[month].websiteClicks += item.websiteClicks;
      monthlyData[month].directions += item.directions;
      monthlyData[month].calls += item.calls;
    });

    return Object.values(monthlyData).sort(
      (a, b) => monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month)
    );
  }, [data]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold tracking-tight">Monthly Performance Trends</h2>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
        <MiniChart
          title="Overall Searches Performance"
          data={chartData}
          dataKey="overallSearches"
          color="hsl(var(--chart-1))"
          delay={0}
        />
        <MiniChart
          title="Mobile (Searches + Maps) Performance"
          data={chartData}
          dataKey="mobilePerformance"
          color="hsl(var(--chart-2))"
          delay={50}
        />
        <MiniChart
          title="Desktop (Searches + Maps) Performance"
          data={chartData}
          dataKey="desktopPerformance"
          color="hsl(var(--chart-3))"
          delay={100}
        />
        <MiniChart
          title="Website Clicks Performance"
          data={chartData}
          dataKey="websiteClicks"
          color="hsl(var(--chart-4))"
          delay={150}
        />
        <MiniChart
          title="Directions Performance"
          data={chartData}
          dataKey="directions"
          color="hsl(var(--primary))"
          delay={200}
        />
        <MiniChart
          title="Calls Performance"
          data={chartData}
          dataKey="calls"
          color="hsl(var(--chart-5))"
          delay={250}
        />
      </div>
    </div>
  );
};
