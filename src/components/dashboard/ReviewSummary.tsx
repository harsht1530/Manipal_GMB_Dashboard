import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, MessageSquare } from "lucide-react";

interface ReviewSummaryProps {
    totalReviews: number;
    averageRating: number;
    ratingDistribution?: { name: string; value: number; color: string }[];
}

export const ReviewSummary = ({ totalReviews, averageRating, ratingDistribution = [] }: ReviewSummaryProps) => {
    // Calculate total for percentage calculation
    const totalInDist = ratingDistribution.reduce((acc, curr) => acc + curr.value, 0);

    return (
        <Card className="animate-slide-up h-full overflow-hidden" style={{ animationDelay: "250ms" }}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-primary" />
                    Reviews & Ratings
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex flex-col h-[calc(100%-60px)]">
                {/* Metrics Section - Standard Dashboard Styling */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-4 bg-secondary/50 rounded-xl border border-primary/5 hover:border-primary/20 transition-all group">
                        <div className="flex items-center gap-2 text-muted-foreground mb-2">
                            <Star className="h-4 w-4 text-warning fill-warning" />
                            <span className="text-[10px] uppercase tracking-wider font-bold">Avg Rating</span>
                        </div>
                        <p className="text-3xl font-bold text-foreground">{averageRating.toFixed(1)}</p>
                    </div>

                    <div className="p-4 bg-secondary/50 rounded-xl border border-primary/5 hover:border-primary/20 transition-all group">
                        <div className="flex items-center gap-2 text-muted-foreground mb-2">
                            <MessageSquare className="h-4 w-4 text-primary" />
                            <span className="text-[10px] uppercase tracking-wider font-bold">Total Reviews</span>
                        </div>
                        <p className="text-3xl font-bold text-foreground">{Math.round(totalReviews).toLocaleString()}</p>
                    </div>
                </div>

                {/* Rating Breakdown List */}
                <div className="flex-1 flex flex-col gap-3 justify-center">
                    {ratingDistribution.map((item, index) => {
                        const percentage = totalInDist > 0 ? (item.value / totalInDist) * 100 : 0;
                        return (
                            <div key={index} className="flex items-center gap-3">
                                <span className="text-[11px] font-bold text-muted-foreground w-12 flex items-center gap-1 shrink-0">
                                    {5 - index} <Star className="h-2.5 w-2.5 fill-muted-foreground" />
                                </span>
                                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-1000"
                                        style={{
                                            width: `${percentage}%`,
                                            backgroundColor: item.color
                                        }}
                                    />
                                </div>
                                <div className="w-24 text-right flex items-center justify-end gap-2 shrink-0">
                                    <span className="text-[11px] font-bold text-foreground">
                                        {item.value.toLocaleString()}
                                    </span>
                                    <span className="text-[10px] font-medium text-muted-foreground min-w-[35px]">
                                        {percentage.toFixed(0)}%
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
};
