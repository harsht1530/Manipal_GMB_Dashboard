import { useState } from "react";
import { ChevronDown, ChevronRight, Building, Star } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface SidebarFiltersProps {
  collapsed: boolean;
  selectedDepartments: string[];
  onDepartmentsChange: (departments: string[]) => void;
  selectedRatings: number[];
  onRatingsChange: (ratings: number[]) => void;
}

const departments = ["Clinic", "Department", "Doctors", "Hospitals", "MARS"];
const ratings = [5, 4, 3, 2, 1];

export const SidebarFilters = ({
  collapsed,
  selectedDepartments,
  onDepartmentsChange,
  selectedRatings,
  onRatingsChange,
}: SidebarFiltersProps) => {
  const [departmentOpen, setDepartmentOpen] = useState(true);
  const [ratingOpen, setRatingOpen] = useState(true);

  const handleDepartmentChange = (dept: string, checked: boolean) => {
    if (checked) {
      onDepartmentsChange([...selectedDepartments, dept]);
    } else {
      onDepartmentsChange(selectedDepartments.filter((d) => d !== dept));
    }
  };

  const handleRatingChange = (rating: number, checked: boolean) => {
    if (checked) {
      onRatingsChange([...selectedRatings, rating]);
    } else {
      onRatingsChange(selectedRatings.filter((r) => r !== rating));
    }
  };

  if (collapsed) return null;

  return (
    <div className="space-y-2 px-3 py-2">
      <div className="text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider mb-3">
        Filters
      </div>

      {/* Department Filter */}
      <Collapsible open={departmentOpen} onOpenChange={setDepartmentOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-2 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            <span>Profile Type</span>
          </div>
          {departmentOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-1 pl-4 pt-2">
          {departments.map((dept) => (
            <label
              key={dept}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-sidebar-accent cursor-pointer transition-colors"
            >
              <Checkbox
                checked={selectedDepartments.includes(dept)}
                onCheckedChange={(checked) =>
                  handleDepartmentChange(dept, checked as boolean)
                }
                className="border-sidebar-border"
              />
              <span className="text-sm text-sidebar-foreground">{dept}</span>
            </label>
          ))}
          {selectedDepartments.length > 0 && (
            <button
              onClick={() => onDepartmentsChange([])}
              className="text-xs text-primary hover:underline px-2 py-1"
            >
              Clear all
            </button>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Rating Filter */}
      <Collapsible open={ratingOpen} onOpenChange={setRatingOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-2 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            <span>Rating</span>
          </div>
          {ratingOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-1 pl-4 pt-2">
          {ratings.map((rating) => (
            <label
              key={rating}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-sidebar-accent cursor-pointer transition-colors"
            >
              <Checkbox
                checked={selectedRatings.includes(rating)}
                onCheckedChange={(checked) =>
                  handleRatingChange(rating, checked as boolean)
                }
                className="border-sidebar-border"
              />
              <div className="flex items-center gap-1">
                {Array.from({ length: rating }).map((_, i) => (
                  <Star
                    key={i}
                    className="h-3 w-3 fill-yellow-400 text-yellow-400"
                  />
                ))}
                {Array.from({ length: 5 - rating }).map((_, i) => (
                  <Star key={i} className="h-3 w-3 text-sidebar-border" />
                ))}
                <span className="text-sm text-sidebar-foreground ml-1">
                  {rating}+
                </span>
              </div>
            </label>
          ))}
          {selectedRatings.length > 0 && (
            <button
              onClick={() => onRatingsChange([])}
              className="text-xs text-primary hover:underline px-2 py-1"
            >
              Clear all
            </button>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
