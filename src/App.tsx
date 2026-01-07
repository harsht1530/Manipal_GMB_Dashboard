import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Doctors from "./pages/Doctors";
import DoctorDetails from "./pages/DoctorDetails";
import Keywords from "./pages/Keywords";
import Branches from "./pages/Branches";
import Settings from "./pages/Settings";
import Phone from "./pages/Phone";
import SearchPerformance from "./pages/SearchPerformance";
import NotFound from "./pages/NotFound";

import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Navigate } from "react-router-dom";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
            <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />

            {/* Protected Routes */}
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/doctors" element={<ProtectedRoute><Doctors /></ProtectedRoute>} />
            <Route path="/doctor-details/:businessName" element={<ProtectedRoute><DoctorDetails /></ProtectedRoute>} />
            <Route path="/keywords" element={<ProtectedRoute><Keywords /></ProtectedRoute>} />
            <Route path="/branches" element={<ProtectedRoute><Branches /></ProtectedRoute>} />
            <Route path="/phone" element={<ProtectedRoute><Phone /></ProtectedRoute>} />
            <Route path="/search-performance" element={<ProtectedRoute><SearchPerformance /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
