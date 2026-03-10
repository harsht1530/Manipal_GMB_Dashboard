import { Calendar } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";

interface ComparisonFilterBarProps {
  compareBy: string; // "Cluster", "Branch", "Speciality"
  entity1: string;
  entity2: string;
  selectedMonth: string[];
  selectedYear: string[];
  optionsMonth: string[];
  optionsYear: string[];
  optionsEntity: string[];
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
  onCompareByChange,
  onEntity1Change,
  onEntity2Change,
  onMonthChange,
  onYearChange,
}: ComparisonFilterBarProps) => {
  return (
    <div className="flex flex-col gap-4 p-4 bg-card rounded-xl border border-border mb-6 animate-fade-in shadow-sm">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Calendar className="h-4 w-4 text-primary" />
        <span className="font-medium">Compare Settings:</span>
      </div>

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
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5 flex flex-col justify-center items-center h-full pt-5">
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
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-3 pt-2 border-t border-border mt-2">
         <div className="w-full sm:w-[200px]">
            <MultiSelect
              placeholder="Select Year"
              options={optionsYear}
              selected={selectedYear}
              onChange={onYearChange}
            />
          </div>

          <div className="w-full sm:w-[200px]">
            <MultiSelect
              placeholder="Select Month"
              options={optionsMonth}
              selected={selectedMonth}
              onChange={onMonthChange}
            />
          </div>
      </div>
    </div>
  );
};
