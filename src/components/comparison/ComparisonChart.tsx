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

const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const ComparisonChart = ({ entity1Name, entity2Name, entity1Data, entity2Data }: ComparisonChartProps) => {

    const chartData = useMemo(() => {
        const monthlyData: Record<string, {
            month: string;
            e1Searches: number;
            e2Searches: number;
            e1Calls: number;
            e2Calls: number;
            e1Directions: number;
            e2Directions: number;
        }> = {};

        const processData = (data: InsightData[], isEntity1: boolean) => {
            data.forEach(item => {
                const month = item.month.substring(0, 3);
                if (!monthlyData[month]) {
                    monthlyData[month] = {
                        month,
                        e1Searches: 0,
                        e2Searches: 0,
                        e1Calls: 0,
                        e2Calls: 0,
                        e1Directions: 0,
                        e2Directions: 0
                    };
                }
                if (isEntity1) {
                    monthlyData[month].e1Searches += (item.googleSearchMobile + item.googleSearchDesktop + item.googleMapsMobile + item.googleMapsDesktop);
                    monthlyData[month].e1Calls += item.calls;
                    monthlyData[month].e1Directions += item.directions;
                } else {
                    monthlyData[month].e2Searches += (item.googleSearchMobile + item.googleSearchDesktop + item.googleMapsMobile + item.googleMapsDesktop);
                    monthlyData[month].e2Calls += item.calls;
                    monthlyData[month].e2Directions += item.directions;
                }
            });
        };

        processData(entity1Data, true);
        processData(entity2Data, false);

        return Object.values(monthlyData).sort(
            (a, b) => monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month)
        );
    }, [entity1Data, entity2Data]);

    if (!entity1Name || !entity2Name) {
        return null;
    }

    const getOptions = (title: string, e1Key: 'e1Searches' | 'e1Calls' | 'e1Directions', e2Key: 'e2Searches' | 'e2Calls' | 'e2Directions'): Highcharts.Options => ({
        chart: {
            type: 'column',
            height: 350,
            backgroundColor: 'transparent',
            style: { fontFamily: 'inherit' }
        },
        title: { text: undefined },
        credits: { enabled: false },
        xAxis: {
            categories: chartData.map(d => d.month),
            labels: { style: { color: 'hsl(var(--muted-foreground))' } },
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
            headerFormat: '<span style="font-size: 11px">{point.key}</span><br/>'
        },
        plotOptions: {
            column: {
                borderRadius: 4,
                borderWidth: 0,
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
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
        </div>
    );
};
