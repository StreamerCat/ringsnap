import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { withAuthGuard } from "@/lib/auth/useUser";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Onboarding from "./pages/Onboarding";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Sales from "./pages/Sales";
import Dashboard from "./pages/Dashboard";
import CustomerDashboard from "./pages/CustomerDashboard";
import AdminMonitoring from "./pages/AdminMonitoring";
import AdminUsers from "./pages/AdminUsers";
import TeamManagement from "./pages/TeamManagement";
import TrialConfirmation from "./pages/TrialConfirmation";
// New auth pages
import AuthLogin from "./pages/AuthLogin";
import MagicCallback from "./pages/MagicCallback";
import StaffInvite from "./pages/StaffInvite";
import PasswordReset from "./pages/PasswordReset";
import SecuritySettings from "./pages/SecuritySettings";
import AuthCallback from "./pages/AuthCallback";

const queryClient = new QueryClient();
const ProtectedCustomerDashboard = withAuthGuard(CustomerDashboard);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/onboarding" element={<Onboarding />} />
          {/* Legacy login routes (keep for backward compatibility) */}
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          {/* New auth routes */}
          <Route path="/auth/login" element={<AuthLogin />} />
          <Route path="/signin" element={<AuthLogin />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/auth/magic-callback" element={<MagicCallback />} />
          <Route path="/auth/staff-invite" element={<StaffInvite />} />
          <Route path="/auth/password" element={<PasswordReset />} />
          {/* Settings */}
          <Route path="/settings/security" element={<SecuritySettings />} />
          {/* App routes */}
          <Route path="/sales" element={<Sales />} />
          <Route path="/salesdash" element={<Dashboard />} />
          <Route path="/dashboard" element={<ProtectedCustomerDashboard />} />
          <Route path="/dashboard/team" element={<TeamManagement />} />
          <Route path="/trial-confirmation" element={<TrialConfirmation />} />
          <Route path="/admin/monitoring" element={<AdminMonitoring />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
