import { MultiSelect } from "@/components/ui/multi-select";
import { Calendar } from "lucide-react";

interface FilterBarProps {
  selectedCluster: string[];
  selectedBranch: string[];
  selectedMonth: string[];
  selectedSpeciality: string[];
  clusterOptions: string[];
  branchOptions: string[];
  monthOptions: string[];
  specialityOptions: string[];
  onClusterChange: (value: string[]) => void;
  onBranchChange: (value: string[]) => void;
  onMonthChange: (value: string[]) => void;
  onSpecialityChange: (value: string[]) => void;
  hideMonth?: boolean;
  hideCluster?: boolean;
  hideBranch?: boolean;
}

export const FilterBar = ({
  selectedCluster,
  selectedBranch,
  selectedMonth,
  selectedSpeciality,
  clusterOptions,
  branchOptions,
  monthOptions,
  specialityOptions,
  onClusterChange,
  onBranchChange,
  onMonthChange,
  onSpecialityChange,
  hideMonth = false,
  hideCluster = false,
  hideBranch = false,
}: FilterBarProps) => {
  return (
    <div className="flex flex-wrap gap-4 items-center p-4 bg-card rounded-xl border border-border mb-6 animate-fade-in">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mr-2">
        <Calendar className="h-4 w-4 text-primary" />
        <span className="font-medium">Filters:</span>
      </div>

      <div className="flex flex-wrap gap-3 flex-1">
        {!hideCluster && (
          <div className="w-full sm:w-[200px]">
            <MultiSelect
              placeholder="Select Cluster"
              options={clusterOptions}
              selected={selectedCluster}
              onChange={onClusterChange}
            />
          </div>
        )}

        {!hideBranch && (
          <div className="w-full sm:w-[220px]">
            <MultiSelect
              placeholder="Select Branch"
              options={branchOptions}
              selected={selectedBranch}
              onChange={onBranchChange}
            />
          </div>
        )}

        {!hideMonth && (
          <div className="w-full sm:w-[180px]">
            <MultiSelect
              placeholder="Select Month"
              options={monthOptions}
              selected={selectedMonth}
              onChange={onMonthChange}
            />
          </div>
        )}

        <div className="w-full sm:w-[220px]">
          <MultiSelect
            placeholder="Select Speciality"
            options={specialityOptions}
            selected={selectedSpeciality}
            onChange={onSpecialityChange}
          />
        </div>
      </div>
    </div>
  );
};
