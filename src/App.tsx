import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Doctors from "./pages/Doctors";
import DoctorDetails from "./pages/DoctorDetails";
import Keywords from "./pages/Keywords";
import Branches from "./pages/Branches";
import Settings from "./pages/Settings";
import Phone from "./pages/Phone";
import SearchPerformance from "./pages/SearchPerformance";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/doctors" element={<Doctors />} />
          <Route path="/doctor-details/:businessName" element={<DoctorDetails />} />
          <Route path="/keywords" element={<Keywords />} />
          <Route path="/branches" element={<Branches />} />
          <Route path="/phone" element={<Phone />} />
          <Route path="/search-performance" element={<SearchPerformance />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
