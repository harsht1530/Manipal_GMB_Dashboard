import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, Download } from "lucide-react";
import { InsightData } from "@/data/dummyData";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface PhoneDetailsTableProps {
  data: InsightData[];
}

export const PhoneDetailsTable = ({ data }: PhoneDetailsTableProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Show all records without deduplication
  const phoneData = useMemo(() => {
    return data.map((item) => ({
      businessName: item.businessName,
      phone: item.phone,
      branch: item.branch,
      department: item.department,
      calls: item.calls,
    }));
  }, [data]);

  const hasPhone = phoneData.filter((d) => d.phone !== "Not available").length;
  const noPhone = phoneData.filter((d) => d.phone === "Not available").length;

  const totalPages = Math.ceil(phoneData.length / pageSize);
  const currentData = phoneData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleDownload = () => {
    const headers = ["Business Name", "Phone", "Branch", "Department", "Total Calls"];
    const csvContent = [
      headers.join(","),
      ...phoneData.map(item => [
        `"${item.businessName}"`,
        `"${item.phone}"`,
        `"${item.branch}"`,
        `"${item.department}"`,
        item.calls
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `manipal_phone_directory_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

  return (
    <Card className="animate-fade-in overflow-hidden">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-6">
        <div className="space-y-1">
          <CardTitle className="text-xl font-bold text-primary">Phone Directory</CardTitle>
          <p className="text-sm text-muted-foreground">Manage and export contact information</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 px-3 py-1">
            <Phone className="h-3.5 w-3.5 mr-1.5" />
            {hasPhone} Available
          </Badge>
          <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 px-3 py-1">
            <PhoneOff className="h-3.5 w-3.5 mr-1.5" />
            {noPhone} Missing
          </Badge>
          <Button
            variant="default"
            size="sm"
            onClick={handleDownload}
            className="ml-auto sm:ml-2 shadow-sm"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-bold py-4">Business Name</TableHead>
                <TableHead className="font-bold py-4 text-center">Contact Number</TableHead>
                <TableHead className="font-bold py-4">Unit / Branch</TableHead>
                <TableHead className="font-bold py-4">Department</TableHead>
                <TableHead className="text-right font-bold py-4">Calls Recieved</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentData.length > 0 ? (
                currentData.map((item, index) => (
                  <TableRow key={index} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium max-w-[250px] truncate">
                      {item.businessName}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.phone === "Not available" ? (
                        <Badge variant="secondary" className="bg-muted text-muted-foreground font-normal border-transparent">
                          NA
                        </Badge>
                      ) : (
                        <span className="text-primary font-semibold tabular-nums tracking-wide">{item.phone}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{item.branch}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-medium bg-background">{item.department}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums text-primary">{item.calls}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-16">
                    <div className="flex flex-col items-center gap-2">
                      <PhoneOff className="h-10 w-10 text-muted-foreground/30" />
                      <p className="text-muted-foreground font-medium">No results found for current filters</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Shadcn Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 border-t bg-muted/5">
            <p className="text-sm text-muted-foreground font-medium">
              Showing <span className="text-foreground">{(currentPage - 1) * pageSize + 1}</span> to <span className="text-foreground">{Math.min(currentPage * pageSize, phoneData.length)}</span> of <span className="text-foreground">{phoneData.length}</span> entries
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
  );
};
