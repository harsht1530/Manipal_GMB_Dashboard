import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { InsightData } from "@/hooks/useMongoData";

interface ComparisonChartProps {
    entity1Name: string;
    entity2Name: string;
    entity1Data: InsightData[];
    entity2Data: InsightData[];
}

const MONTH_ORDER = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const ComparisonChart = ({ entity1Name, entity2Name, entity1Data, entity2Data }: ComparisonChartProps) => {

    const chartData = useMemo(() => {
        const monthlyData: Record<string, {
            yearMonth: string;   // "2025-Jan" — sort key
            label: string;       // "Jan '25" — display label
            e1Searches: number;
            e2Searches: number;
            e1Calls: number;
            e2Calls: number;
            e1Directions: number;
            e2Directions: number;
            e1Clicks: number;
            e2Clicks: number;
        }> = {};

        const processData = (data: InsightData[], isEntity1: boolean) => {
            data.forEach(item => {
                const year = new Date(item.date).getFullYear();
                const month = item.month?.substring(0, 3) || "";
                if (!month || !year) return;
                const key = `${year}-${String(MONTH_ORDER.indexOf(month)).padStart(2, "0")}`; // sortable key
                const label = `${month} '${String(year).slice(2)}`;
                if (!monthlyData[key]) {
                    monthlyData[key] = {
                        yearMonth: key,
                        label,
                        e1Searches: 0, e2Searches: 0,
                        e1Calls: 0, e2Calls: 0,
                        e1Directions: 0, e2Directions: 0,
                        e1Clicks: 0, e2Clicks: 0,
                    };
                }
                const searches = item.googleSearchMobile + item.googleSearchDesktop + item.googleMapsMobile + item.googleMapsDesktop;
                if (isEntity1) {
                    monthlyData[key].e1Searches += searches;
                    monthlyData[key].e1Calls += item.calls;
                    monthlyData[key].e1Directions += item.directions;
                    monthlyData[key].e1Clicks += item.websiteClicks;
                } else {
                    monthlyData[key].e2Searches += searches;
                    monthlyData[key].e2Calls += item.calls;
                    monthlyData[key].e2Directions += item.directions;
                    monthlyData[key].e2Clicks += item.websiteClicks;
                }
            });
        };

        processData(entity1Data, true);
        processData(entity2Data, false);

        return Object.values(monthlyData).sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
    }, [entity1Data, entity2Data]);

    if (!entity1Name || !entity2Name) return null;

    const categories = chartData.map(d => d.label);

    const getOptions = (
        title: string,
        e1Key: 'e1Searches' | 'e1Calls' | 'e1Directions' | 'e1Clicks',
        e2Key: 'e2Searches' | 'e2Calls' | 'e2Directions' | 'e2Clicks'
    ): Highcharts.Options => ({
        chart: {
            type: 'column',
            height: 350,
            backgroundColor: 'transparent',
            style: { fontFamily: 'inherit' }
        },
        title: { text: undefined },
        credits: { enabled: false },
        xAxis: {
            categories,
            labels: {
                style: { color: 'hsl(var(--muted-foreground))', fontSize: '10px' },
                rotation: categories.length > 8 ? -35 : 0,
            },
            lineColor: 'hsl(var(--border))',
            tickColor: 'hsl(var(--border))'
        },
        yAxis: {
            title: { text: undefined },
            labels: { style: { color: 'hsl(var(--muted-foreground))' } },
            gridLineColor: 'hsl(var(--muted))',
            gridLineDashStyle: 'Dash'
        },
        legend: {
            itemStyle: { color: 'hsl(var(--foreground))', fontWeight: '500' }
        },
        tooltip: {
            shared: true,
            backgroundColor: 'white',
            borderRadius: 8,
            useHTML: true,
            headerFormat: '<span style="font-size: 11px; font-weight:600">{point.key}</span><br/>'
        },
        plotOptions: {
            column: {
                borderRadius: 4,
                borderWidth: 0,
                groupPadding: 0.1,
                dataLabels: { enabled: false }
            }
        },
        series: [
            {
                name: entity1Name,
                data: chartData.map(d => d[e1Key]),
                type: 'column',
                color: 'hsl(var(--primary))'
            },
            {
                name: entity2Name,
                data: chartData.map(d => d[e2Key]),
                type: 'column',
                color: 'hsl(var(--chart-2))'
            }
        ]
    });

    return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
            <Card className="animate-fade-in shadow-sm border-border">
                <CardHeader className="py-4">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Total Searches</CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                    <HighchartsReact highcharts={Highcharts} options={getOptions('Searches', 'e1Searches', 'e2Searches')} />
                </CardContent>
            </Card>

            <Card className="animate-fade-in shadow-sm border-border" style={{ animationDelay: '50ms' }}>
                <CardHeader className="py-4">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Phone Calls</CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                    <HighchartsReact highcharts={Highcharts} options={getOptions('Calls', 'e1Calls', 'e2Calls')} />
                </CardContent>
            </Card>

            <Card className="animate-fade-in shadow-sm border-border" style={{ animationDelay: '100ms' }}>
                <CardHeader className="py-4">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Directions</CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                    <HighchartsReact highcharts={Highcharts} options={getOptions('Directions', 'e1Directions', 'e2Directions')} />
                </CardContent>
            </Card>

            <Card className="animate-fade-in shadow-sm border-border" style={{ animationDelay: '150ms' }}>
                <CardHeader className="py-4">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Website Clicks</CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                    <HighchartsReact highcharts={Highcharts} options={getOptions('Clicks', 'e1Clicks', 'e2Clicks')} />
                </CardContent>
            </Card>
        </div>
    );
};
