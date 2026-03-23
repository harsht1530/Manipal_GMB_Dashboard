import { Calendar, Info } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";

interface ComparisonFilterBarProps {
  compareBy: string;
  entity1: string;
  entity2: string;
  selectedMonth: string[];
  selectedYear: string[];
  optionsMonth: any[]; // {label, value, group} grouped format
  optionsYear: string[];
  optionsEntity: string[];
  activeWindowLabel?: string;
  onCompareByChange: (value: string) => void;
  onEntity1Change: (value: string) => void;
  onEntity2Change: (value: string) => void;
  onMonthChange: (value: string[]) => void;
  onYearChange: (value: string[]) => void;
}

export const ComparisonFilterBar = ({
  compareBy,
  entity1,
  entity2,
  selectedMonth,
  selectedYear,
  optionsMonth,
  optionsYear,
  optionsEntity,
  activeWindowLabel,
  onCompareByChange,
  onEntity1Change,
  onEntity2Change,
  onMonthChange,
  onYearChange,
}: ComparisonFilterBarProps) => {
  return (
    <div className="flex flex-col gap-4 p-4 bg-card rounded-xl border border-border mb-6 animate-fade-in shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4 text-primary" />
          <span className="font-medium">Compare Settings:</span>
        </div>
        {activeWindowLabel && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/50 border border-border/60 px-2.5 py-1 rounded-full">
            <Info className="h-3 w-3 text-primary/70" />
            <span>{activeWindowLabel}</span>
          </div>
        )}
      </div>

      {/* Entity selection row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Compare By</label>
          <Select value={compareBy} onValueChange={onCompareByChange}>
            <SelectTrigger className="w-full bg-background border-input">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Cluster">Cluster</SelectItem>
              <SelectItem value="Branch">Branch</SelectItem>
              <SelectItem value="Speciality">Speciality</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Entity 1</label>
          <Select value={entity1} onValueChange={onEntity1Change}>
            <SelectTrigger className="w-full bg-background border-input">
              <SelectValue placeholder={`Select ${compareBy}`} />
            </SelectTrigger>
            <SelectContent>
              {optionsEntity.map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col justify-center items-center h-full pt-5">
          <span className="text-sm font-bold text-muted-foreground uppercase bg-muted py-1.5 px-3 rounded-full">VS</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Entity 2</label>
          <Select value={entity2} onValueChange={onEntity2Change}>
            <SelectTrigger className="w-full bg-background border-input">
              <SelectValue placeholder={`Select ${compareBy}`} />
            </SelectTrigger>
            <SelectContent>
              {optionsEntity.map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Year & Month filter row */}
      <div className="flex flex-wrap gap-3 pt-2 border-t border-border mt-1">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Year</label>
          <div className="w-full sm:w-[160px]">
            <MultiSelect
              placeholder="Select Year"
              options={optionsYear}
              selected={selectedYear}
              onChange={onYearChange}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Month (Year-partitioned)</label>
          <div className="w-full sm:w-[220px]">
            <MultiSelect
              placeholder="Select Month"
              options={optionsMonth}
              selected={selectedMonth}
              onChange={onMonthChange}
            />
          </div>
        </div>

        {(selectedYear.length > 0 || selectedMonth.length > 0) && (
          <div className="flex items-end pb-0.5">
            <button
              onClick={() => { onYearChange([]); onMonthChange([]); }}
              className="text-[11px] text-muted-foreground hover:text-destructive transition-colors px-2 py-1.5 rounded border border-border/60 bg-background hover:border-destructive/40"
            >
              Clear filters (show last 12 months)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
