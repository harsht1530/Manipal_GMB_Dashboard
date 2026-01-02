import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InsightData } from "@/data/dummyData";
import { Star, TrendingUp, MapPin, Phone, Globe } from "lucide-react";

interface PerformanceTableProps {
  data: InsightData[];
}

export const PerformanceTable = ({ data }: PerformanceTableProps) => {
  return (
    <Card className="animate-slide-up" style={{ animationDelay: "300ms" }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Doctor Performance Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold">Doctor</TableHead>
                <TableHead className="text-center font-semibold">Search</TableHead>
                <TableHead className="text-center font-semibold">Maps</TableHead>
                <TableHead className="text-center font-semibold">Directions</TableHead>
                <TableHead className="text-center font-semibold">Website</TableHead>
                <TableHead className="text-center font-semibold">Calls</TableHead>
                <TableHead className="text-center font-semibold">Rating</TableHead>
                <TableHead className="font-semibold">Branch</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item, index) => (
                <TableRow
                  key={item.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">{item.businessName}</p>
                      <p className="text-sm text-muted-foreground">{item.speciality}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center">
                      <span className="font-medium">
                        {item.googleSearchMobile + item.googleSearchDesktop}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        M: {item.googleSearchMobile} | D: {item.googleSearchDesktop}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center">
                      <span className="font-medium">
                        {item.googleMapsMobile + item.googleMapsDesktop}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        M: {item.googleMapsMobile} | D: {item.googleMapsDesktop}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{item.directions}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{item.websiteClicks}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{item.calls}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {item.rating > 0 ? (
                      <div className="flex items-center justify-center gap-1">
                        <Star className="h-4 w-4 fill-warning text-warning" />
                        <span className="font-medium">{item.rating.toFixed(1)}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-accent text-accent-foreground">
                      {item.branch}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
