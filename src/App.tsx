import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import * as Sentry from "@sentry/react";

import { withAuthGuard } from "@/lib/auth/useUser";

// Eager load Index for immediate LCP
import Index from "./pages/Index";

// Lazy load all other pages for code splitting
const NotFound = lazy(() => import("./pages/NotFound"));
const Start = lazy(() => import("./pages/Start"));
const SignupRedirect = lazy(() => import("./pages/SignupRedirect"));
const OnboardingRedirect = lazy(() => import("./pages/OnboardingRedirect"));
const OnboardingChat = lazy(() => import("./pages/OnboardingChat"));
const ProvisioningStatus = lazy(() => import("./pages/ProvisioningStatus"));
const SetupStatus = lazy(() => import("./pages/SetupStatus"));
const Sales = lazy(() => import("./pages/Sales"));
const FormPreview = lazy(() => import("./pages/FormPreview"));
const TrialFlowPreview = lazy(() => import("./pages/TrialFlowPreview"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const CustomerDashboard = lazy(() => import("./pages/CustomerDashboard"));
const AdminMonitoring = lazy(() => import("./pages/AdminMonitoring"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const TeamManagement = lazy(() => import("./pages/TeamManagement"));
const TrialConfirmation = lazy(() => import("./pages/TrialConfirmation"));
const AuthLogin = lazy(() => import("./pages/AuthLogin"));
const MagicCallback = lazy(() => import("./pages/MagicCallback"));
const StaffInvite = lazy(() => import("./pages/StaffInvite"));
const PasswordReset = lazy(() => import("./pages/PasswordReset"));
const SecuritySettings = lazy(() => import("./pages/SecuritySettings"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const JobberIntegration = lazy(() => import("./pages/settings/integrations/JobberIntegration"));
const Plumbers = lazy(() => import("./pages/trades/Plumbers"));
const HVAC = lazy(() => import("./pages/trades/HVAC"));
const Electricians = lazy(() => import("./pages/trades/Electricians"));
const Roofing = lazy(() => import("./pages/trades/Roofing"));

const queryClient = new QueryClient();
const ProtectedCustomerDashboard = withAuthGuard(CustomerDashboard);
// OnboardingChat handles its own auth logic - supports both authenticated users
// and unauthenticated users with lead_id (two-step signup flow)

const App = () => (
  <Sentry.ErrorBoundary
    fallback={({ error, resetError }) => (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <h1 className="text-2xl font-bold text-foreground">Something went wrong</h1>
        <p className="max-w-md text-muted-foreground">
          We're sorry, but an unexpected error occurred. Our team has been notified.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-lg bg-primary px-6 py-2 text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Refresh Page
        </button>
      </div>
    )}
    onError={(error, componentStack) => {
      console.error("React Error Boundary caught:", error, componentStack);
    }}
  >
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={
            <div className="flex h-screen w-full items-center justify-center bg-background">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }>
            <Routes>
              <Route path="/" element={<Index />} />
              {/* Canonical signup/onboarding flow */}
              <Route path="/start" element={<Start />} />
              <Route path="/onboarding-chat" element={<OnboardingChat />} />
              <Route path="/setup/assistant" element={<ProvisioningStatus />} />
              <Route path="/onboarding-status" element={<ProvisioningStatus />} />
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
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </Sentry.ErrorBoundary>
);

export default App;
