import { ReactNode, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  selectedDepartments?: string[];
  onDepartmentsChange?: (departments: string[]) => void;
  selectedRatings?: number[];
  onRatingsChange?: (ratings: number[]) => void;
}

export const DashboardLayout = ({ 
  children, 
  title, 
  subtitle,
  selectedDepartments = [],
  onDepartmentsChange = () => {},
  selectedRatings = [],
  onRatingsChange = () => {},
}: DashboardLayoutProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Menu Toggle */}
      <div className="fixed top-4 left-4 z-50 lg:hidden">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Sidebar - Hidden on mobile, shown on desktop */}
      <div className={cn(
        "lg:block",
        mobileMenuOpen ? "block" : "hidden"
      )}>
        <Sidebar 
          selectedDepartments={selectedDepartments}
          onDepartmentsChange={onDepartmentsChange}
          selectedRatings={selectedRatings}
          onRatingsChange={onRatingsChange}
        />
      </div>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen transition-all duration-300">
        <Header title={title} subtitle={subtitle} />
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
};
