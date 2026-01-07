import { useMemo } from "react";
import { InsightData, getAggregatedMetrics } from "@/hooks/useMongoData";
import { Search, Map, Navigation, Phone, Globe, Smartphone, Monitor, MapPin } from "lucide-react";

interface DoctorAggregatedStatsProps {
    data: InsightData[];
    doctorName: string;
}

export const DoctorAggregatedStats = ({ data, doctorName }: DoctorAggregatedStatsProps) => {
    const stats = useMemo(() => {
        const doctorData = data.filter((d) => d.businessName === doctorName);
        return getAggregatedMetrics(doctorData);
    }, [data, doctorName]);

    const statItems = [
        { label: "Search Mobile", value: stats.googleSearchMobile, icon: Smartphone, color: "text-primary" },
        { label: "Search Desktop", value: stats.googleSearchDesktop, icon: Monitor, color: "text-blue-500" },
        { label: "Maps Mobile", value: stats.googleMapsMobile, icon: Map, color: "text-green-500" },
        { label: "Maps Desktop", value: stats.googleMapsDesktop, icon: MapPin, color: "text-emerald-500" },
        { label: "Phone Calls", value: stats.totalCalls, icon: Phone, color: "text-warning" },
        { label: "Directions", value: stats.totalDirections, icon: Navigation, color: "text-success" },
        { label: "Website Clicks", value: stats.totalWebsiteClicks, icon: Globe, color: "text-warning" },
        { label: "Total Searches", value: stats.totalSearchImpressions, icon: Search, color: "text-primary" },
    ];

    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {statItems.map((item, idx) => (
                <div key={idx} className="bg-secondary/50 rounded-lg p-3 border border-primary/5 hover:border-primary/20 transition-colors">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
                        <span className="text-[10px] uppercase tracking-wider font-semibold">{item.label}</span>
                    </div>
                    <p className="text-lg font-bold">
                        {item.value >= 1000 ? (item.value / 1000).toFixed(1) + "k" : item.value}
                    </p>
                </div>
            ))}
        </div>
    );
};
