import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { withAuthGuard } from "@/lib/auth/useUser";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Start from "./pages/Start";
import SignupRedirect from "./pages/SignupRedirect";
import OnboardingRedirect from "./pages/OnboardingRedirect";
import OnboardingChat from "./pages/OnboardingChat";
import ProvisioningStatus from "./pages/ProvisioningStatus";
import SetupStatus from "./pages/SetupStatus"; // Added this line
import Sales from "./pages/Sales";
import FormPreview from "./pages/FormPreview";
import TrialFlowPreview from "./pages/TrialFlowPreview";
import Dashboard from "./pages/Dashboard";
import CustomerDashboard from "./pages/CustomerDashboard";
import AdminMonitoring from "./pages/AdminMonitoring";
import AdminUsers from "./pages/AdminUsers";
import TeamManagement from "./pages/TeamManagement";
import TrialConfirmation from "./pages/TrialConfirmation";
import AuthLogin from "./pages/AuthLogin";
import MagicCallback from "./pages/MagicCallback";
import StaffInvite from "./pages/StaffInvite";
import PasswordReset from "./pages/PasswordReset";
import SecuritySettings from "./pages/SecuritySettings";
import AuthCallback from "./pages/AuthCallback";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import JobberIntegration from "./pages/settings/integrations/JobberIntegration";
import Plumbers from "./pages/trades/Plumbers";
import HVAC from "./pages/trades/HVAC";
import Electricians from "./pages/trades/Electricians";
import Roofing from "./pages/trades/Roofing";

const queryClient = new QueryClient();
const ProtectedCustomerDashboard = withAuthGuard(CustomerDashboard);
// OnboardingChat handles its own auth logic - supports both authenticated users
// and unauthenticated users with lead_id (two-step signup flow)

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          {/* Canonical signup/onboarding flow */}
          <Route path="/start" element={<Start />} />
          <Route path="/onboarding-chat" element={<OnboardingChat />} />
          <Route path="/setup/assistant" element={<ProvisioningStatus />} />
          {/* <Route path="/setup-status" element={<SetupStatus />} /> */}

          {/* Legacy signup routes - redirect to canonical paths */}
          <Route path="/signup" element={<SignupRedirect />} />
          <Route path="/signup/form" element={<SignupRedirect />} />
          <Route path="/onboarding" element={<OnboardingRedirect />} />
          {/* Auth routes */}
          <Route path="/login" element={<AuthLogin />} />
          <Route path="/reset-password" element={<PasswordReset />} />
          <Route path="/auth/login" element={<AuthLogin />} />
          <Route path="/signin" element={<AuthLogin />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/auth/magic-callback" element={<MagicCallback />} />
          <Route path="/auth/staff-invite" element={<StaffInvite />} />
          {/* Settings */}
          <Route path="/settings/security" element={<SecuritySettings />} />
          <Route path="/settings/integrations/jobber" element={<JobberIntegration />} />
          {/* App routes */}
          <Route path="/sales" element={<Sales />} />
          <Route path="/form-preview" element={<FormPreview />} />
          <Route path="/trial-preview" element={<TrialFlowPreview />} />
          <Route path="/salesdash" element={<Dashboard />} />
          <Route path="/dashboard" element={<ProtectedCustomerDashboard />} />
          <Route path="/dashboard/team" element={<TeamManagement />} />
          <Route path="/trial-confirmation" element={<TrialConfirmation />} />
          <Route path="/admin/monitoring" element={<AdminMonitoring />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          {/* Legal pages */}
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          {/* Trade-specific landing pages */}
          <Route path="/plumbers" element={<Plumbers />} />
          <Route path="/hvac" element={<HVAC />} />
          <Route path="/electricians" element={<Electricians />} />
          <Route path="/roofing" element={<Roofing />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
