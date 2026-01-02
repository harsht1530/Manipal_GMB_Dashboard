import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DoctorData } from "@/hooks/useMongoData";
import { Trophy, Target, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface KeywordRankingsProps {
  doctors: DoctorData[];
}

export const KeywordRankings = ({ doctors }: KeywordRankingsProps) => {
  // Flatten all labels from all doctors
  const allLabels = doctors.flatMap((doctor) =>
    doctor.labels.map((label) => ({
      ...label,
      doctorName: doctor.name,
      branch: doctor.branch,
    }))
  );

  // Sort by rank (0 means not ranking, so put them last)
  const sortedLabels = allLabels
    .sort((a, b) => {
      if (a.rank === 0 && b.rank === 0) return 0;
      if (a.rank === 0) return 1;
      if (b.rank === 0) return -1;
      return a.rank - b.rank;
    })
    .slice(0, 8);

  const getRankBadge = (rank: number) => {
    if (rank === 0) {
      return (
        <Badge variant="secondary" className="bg-muted text-muted-foreground">
          Not Ranking
        </Badge>
      );
    }
    if (rank === 1) {
      return (
        <Badge className="bg-warning text-warning-foreground">
          <Trophy className="h-3 w-3 mr-1" />
          #1
        </Badge>
      );
    }
    if (rank <= 3) {
      return (
        <Badge className="bg-success text-success-foreground">
          #{rank}
        </Badge>
      );
    }
    if (rank <= 10) {
      return (
        <Badge variant="secondary" className="bg-accent text-accent-foreground">
          #{rank}
        </Badge>
      );
    }
    return (
      <Badge variant="outline">
        #{rank}
      </Badge>
    );
  };

  return (
    <Card className="animate-slide-up" style={{ animationDelay: "400ms" }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Keyword Rankings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {sortedLabels.map((label, index) => (
          <div
            key={`${label.doctorName}-${label.label}-${index}`}
            className={cn(
              "flex items-start justify-between p-4 rounded-lg bg-secondary/50 border border-border/50 transition-all duration-200 hover:bg-secondary animate-fade-in"
            )}
            style={{ animationDelay: `${index * 75}ms` }}
          >
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {getRankBadge(label.rank)}
                <Badge variant="outline" className="text-xs">
                  {label.branch}
                </Badge>
              </div>
              <p className="font-medium text-foreground">{label.label}</p>
              <p className="text-sm text-muted-foreground">{label.doctorName}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                <span>{label.competitors.length} competitors</span>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
