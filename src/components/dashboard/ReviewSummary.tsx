import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, MessageSquare } from "lucide-react";

interface ReviewSummaryProps {
    totalReviews: number;
    averageRating: number;
}

export const ReviewSummary = ({ totalReviews, averageRating }: ReviewSummaryProps) => {
    return (
        <Card className="animate-slide-up h-full" style={{ animationDelay: "250ms" }}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-primary" />
                    Reviews & Ratings
                </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col justify-center gap-6 py-8">
                <div className="flex flex-col items-center justify-center p-6 bg-warning/10 rounded-2xl border border-warning/20">
                    <div className="flex items-center gap-2 mb-2">
                        <Star className="h-8 w-8 fill-warning text-warning" />
                        <span className="text-4xl font-bold text-foreground">{averageRating.toFixed(1)}</span>
                    </div>
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Average Rating</p>
                </div>

                <div className="flex flex-col items-center justify-center p-6 bg-primary/10 rounded-2xl border border-primary/20">
                    <div className="flex items-center gap-2 mb-2">
                        <MessageSquare className="h-8 w-8 text-primary" />
                        <span className="text-4xl font-bold text-foreground">{totalReviews.toLocaleString()}</span>
                    </div>
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Reviews</p>
                </div>
            </CardContent>
        </Card>
    );
};
