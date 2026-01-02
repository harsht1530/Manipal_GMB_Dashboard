import { useState, useMemo, useEffect, useTransition } from "react";
import { cn } from "@/lib/utils";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useMongoData } from "@/hooks/useMongoData";
import { Search, Trophy, TrendingUp, Users, Target, Filter, Loader2 } from "lucide-react";

interface FlattenedKeyword {
  keyword: string;
  doctorName: string;
  branch: string;
  rank: number;
  competitorCount: number;
  competitors: string[];
}

const Keywords = () => {
  const { doctors, loading } = useMongoData();
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [rankFilter, setRankFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 10);
    return () => clearTimeout(timer);
  }, []);

  // Flatten all keywords from all doctors
  const allKeywords: FlattenedKeyword[] = useMemo(() => {
    if (!mounted || loading) return [];
    return doctors.flatMap((doctor) =>
      doctor.labels.map((label) => ({
        keyword: label.label,
        doctorName: doctor.name,
        branch: doctor.branch,
        rank: label.rank,
        competitorCount: label.competitors.length,
        competitors: label.competitors,
      }))
    );
  }, [doctors, mounted, loading]);

  const filteredKeywords = useMemo(() => {
    return allKeywords.filter((kw) => {
      const matchesSearch =
        kw.keyword.toLowerCase().includes(searchQuery.toLowerCase()) ||
        kw.doctorName.toLowerCase().includes(searchQuery.toLowerCase());

      let matchesRank = true;
      if (rankFilter === "top3") {
        matchesRank = kw.rank > 0 && kw.rank <= 3;
      } else if (rankFilter === "top10") {
        matchesRank = kw.rank > 0 && kw.rank <= 10;
      } else if (rankFilter === "notranking") {
        matchesRank = kw.rank === 0;
      }

      return matchesSearch && matchesRank;
    });
  }, [allKeywords, searchQuery, rankFilter]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, rankFilter]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredKeywords.length / pageSize);
  const currentData = filteredKeywords.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const renderPaginationItems = () => {
    const items = [];
    const maxVisiblePages = 5;

    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    if (startPage > 1) {
      items.push(
        <PaginationItem key="1">
          <PaginationLink onClick={() => setCurrentPage(1)}>1</PaginationLink>
        </PaginationItem>
      );
      if (startPage > 2) {
        items.push(<PaginationEllipsis key="ellipsis-start" />);
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink
            onClick={() => setCurrentPage(i)}
            isActive={currentPage === i}
          >
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        items.push(<PaginationEllipsis key="ellipsis-end" />);
      }
      items.push(
        <PaginationItem key={totalPages}>
          <PaginationLink onClick={() => setCurrentPage(totalPages)}>{totalPages}</PaginationLink>
        </PaginationItem>
      );
    }

    return items;
  };

  // Stats
  const stats = useMemo(() => {
    if (!mounted || loading) return { total: 0, ranking: 0, top3: 0, top10: 0, notRanking: 0 };
    const ranking = allKeywords.filter((k) => k.rank > 0);
    const top3 = ranking.filter((k) => k.rank <= 3);
    const top10 = ranking.filter((k) => k.rank <= 10);

    return {
      total: allKeywords.length,
      ranking: ranking.length,
      top3: top3.length,
      top10: top10.length,
      notRanking: allKeywords.length - ranking.length,
    };
  }, [allKeywords, mounted, loading]);

  const getRankBadge = (rank: number) => {
    if (rank === 0) {
      return <Badge variant="secondary">Not Ranking</Badge>;
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
      return <Badge className="bg-success text-success-foreground">#{rank}</Badge>;
    }
    if (rank <= 10) {
      return <Badge variant="default">#{rank}</Badge>;
    }
    return <Badge variant="outline">#{rank}</Badge>;
  };

  if (!mounted || loading) {
    return (
      <DashboardLayout title="Keywords" subtitle="Track keyword rankings and competitors">
        <KeywordsSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Keywords" subtitle="Track keyword rankings and competitors">
      <div className={cn("relative transition-all duration-300", isPending ? "opacity-60" : "opacity-100")}>
        {isPending && (
          <div className="absolute inset-0 z-[60] flex items-start justify-center pt-32 bg-background/5 backdrop-blur-[1px] rounded-xl pointer-events-none">
            <div className="flex items-center gap-3 px-4 py-2 bg-background/80 border border-border shadow-lg rounded-full animate-in fade-in zoom-in duration-300">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm font-medium">Updating results...</span>
            </div>
          </div>
        )}
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-5 mb-6">
          <Card className="animate-slide-up">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Keywords</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="animate-slide-up" style={{ animationDelay: "50ms" }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/20">
                  <Trophy className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.top3}</p>
                  <p className="text-xs text-muted-foreground">Top 3 Rankings</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="animate-slide-up" style={{ animationDelay: "100ms" }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/20">
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.top10}</p>
                  <p className="text-xs text-muted-foreground">Top 10 Rankings</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="animate-slide-up" style={{ animationDelay: "150ms" }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.ranking}</p>
                  <p className="text-xs text-muted-foreground">Ranking</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="animate-slide-up" style={{ animationDelay: "200ms" }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Target className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.notRanking}</p>
                  <p className="text-xs text-muted-foreground">Not Ranking</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6 animate-fade-in">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                <span>Filters:</span>
              </div>
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search keywords or doctors..."
                  value={searchQuery}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSearchQuery(val);
                    startTransition(() => {
                      // This creates a low-priority update for the filtered list
                    });
                  }}
                  className="pl-10 bg-secondary border-0"
                />
              </div>
              <Select value={rankFilter} onValueChange={(val) => startTransition(() => setRankFilter(val))}>
                <SelectTrigger className="w-[150px] bg-secondary border-0">
                  <SelectValue placeholder="Rank filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Keywords</SelectItem>
                  <SelectItem value="top3">Top 3</SelectItem>
                  <SelectItem value="top10">Top 10</SelectItem>
                  <SelectItem value="notranking">Not Ranking</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Keywords Table */}
        <Card className="animate-slide-up" style={{ animationDelay: "250ms" }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Keyword Rankings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold">Keyword</TableHead>
                    <TableHead className="font-semibold">Doctor</TableHead>
                    <TableHead className="font-semibold">Branch</TableHead>
                    <TableHead className="text-center font-semibold">Rank</TableHead>
                    <TableHead className="text-center font-semibold">Competitors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentData.map((kw, index) => (
                    <TableRow
                      key={`${kw.doctorName}-${kw.keyword}-${index}`}
                      className="animate-fade-in"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <TableCell>
                        <span className="font-medium">{kw.keyword}</span>
                      </TableCell>
                      <TableCell>{kw.doctorName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{kw.branch}</Badge>
                      </TableCell>
                      <TableCell className="text-center">{getRankBadge(kw.rank)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{kw.competitorCount}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {filteredKeywords.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No keywords found matching your filters.
              </div>
            )}

            {/* Shadcn Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 border-t mt-4">
                <p className="text-sm text-muted-foreground font-medium">
                  Showing <span className="text-foreground">{(currentPage - 1) * pageSize + 1}</span> to <span className="text-foreground">{Math.min(currentPage * pageSize, filteredKeywords.length)}</span> of <span className="text-foreground">{filteredKeywords.length}</span> entries
                </p>

                <Pagination className="w-auto mx-0">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setCurrentPage(prev => Math.max(1, prev - 1));
                        }}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>

                    {renderPaginationItems()}

                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setCurrentPage(prev => Math.min(totalPages, prev + 1));
                        }}
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

const KeywordsSkeleton = () => {
  return (
    <div className="space-y-6">
      {/* Stats Cards Skeleton */}
      <div className="grid gap-4 md:grid-cols-5 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-6 w-12" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters Skeleton */}
      <Card className="mb-6">
        <CardContent className="p-4 flex gap-4">
          <Skeleton className="h-10 flex-1 max-w-md" />
          <Skeleton className="h-10 w-[150px]" />
        </CardContent>
      </Card>

      {/* Table Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-5" />
              ))}
            </div>
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Keywords;
