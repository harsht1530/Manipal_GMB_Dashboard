import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InsightData } from "@/data/dummyData";
import { Award, Star, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface TopPerformersProps {
  data: InsightData[];
}

export const TopPerformers = ({ data }: TopPerformersProps) => {
  // Sort by total impressions
  const topByImpressions = [...data]
    .sort(
      (a, b) =>
        b.googleSearchMobile +
        b.googleSearchDesktop +
        b.googleMapsMobile +
        b.googleMapsDesktop -
        (a.googleSearchMobile +
          a.googleSearchDesktop +
          a.googleMapsMobile +
          a.googleMapsDesktop)
    )
    .slice(0, 5);

  return (
    <Card className="animate-slide-up h-full" style={{ animationDelay: "200ms" }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" />
          Top Performers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {topByImpressions.map((doctor, index) => {
          const totalImpressions =
            doctor.googleSearchMobile +
            doctor.googleSearchDesktop +
            doctor.googleMapsMobile +
            doctor.googleMapsDesktop;

          return (
            <div
              key={doctor.id}
              className={cn(
                "flex items-center gap-4 p-3 rounded-lg transition-all duration-200 hover:bg-secondary animate-fade-in",
                index === 0 && "bg-accent/50"
              )}
              style={{ animationDelay: `${index * 75}ms` }}
            >
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
                  index === 0
                    ? "bg-warning text-warning-foreground"
                    : index === 1
                      ? "bg-muted-foreground/20 text-foreground"
                      : index === 2
                        ? "bg-warning/30 text-foreground"
                        : "bg-secondary text-muted-foreground"
                )}
              >
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">
                  {doctor.businessName}
                </p>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span>{doctor.speciality}</span>
                  {doctor.rating > 0 && (
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-warning text-warning" />
                      {doctor.rating.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-foreground">
                  {totalImpressions.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                  <TrendingUp className="h-3 w-3 text-success" />
                  impressions
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
