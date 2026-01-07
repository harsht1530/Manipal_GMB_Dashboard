import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: LucideIcon;
  iconColor?: string;
  delay?: number;
}

const formatIndianNumber = (num: number | string) => {
  const n = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(n)) return num;

  if (n >= 10000000) {
    return (n / 10000000).toFixed(2) + ' Cr';
  } else if (n >= 100000) {
    return (n / 100000).toFixed(2) + ' L';
  }
  return n.toLocaleString('en-IN');
};

export const MetricCard = ({
  title,
  value,
  change,
  icon: Icon,
  iconColor = "text-primary",
  delay = 0,
}: MetricCardProps) => {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;
  const formattedValue = formatIndianNumber(value);

  return (
    <Card
      className="animate-slide-up overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold text-foreground">{formattedValue}</p>
            {change !== undefined && (
              <div
                className={cn(
                  "flex items-center gap-1 text-sm font-medium",
                  isPositive && "text-success",
                  isNegative && "text-destructive",
                  !isPositive && !isNegative && "text-muted-foreground"
                )}
              >
                {isPositive ? (
                  <TrendingUp className="h-4 w-4" />
                ) : isNegative ? (
                  <TrendingDown className="h-4 w-4" />
                ) : null}
                <span>
                  {isPositive ? "+" : ""}
                  {change}% from last month
                </span>
              </div>
            )}
          </div>
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-xl bg-accent",
              iconColor
            )}
          >
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
