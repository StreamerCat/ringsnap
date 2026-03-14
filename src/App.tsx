import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { useRouteTracking } from "@/lib/analytics";
import { Loader2 } from "lucide-react";
import * as Sentry from "@sentry/react";

import { withAuthGuard } from "@/lib/auth/useUser";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import { VapiWidgetProvider } from "@/lib/VapiWidgetContext";
import { VapiChatWidget } from "@/components/VapiChatWidget";

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
const AdminControl = lazy(() => import("./pages/AdminControl"));
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
const Difference = lazy(() => import("./pages/Difference"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Activation = lazy(() => import("./pages/Activation"));

// Resource Center pages
const ResourceHub = lazy(() => import("./pages/resources/ResourceHub"));
const HvacDispatcherScript = lazy(() => import("./pages/resources/HvacDispatcherScript"));
const PlumbingDispatcherScript = lazy(() => import("./pages/resources/PlumbingDispatcherScript"));
const ElectricianCallScript = lazy(() => import("./pages/resources/ElectricianCallScript"));
const HvacAfterHoursScript = lazy(() => import("./pages/resources/HvacAfterHoursScript"));
const HvacPriceShopperScript = lazy(() => import("./pages/resources/HvacPriceShopperScript"));
const HvacEmergencyTriage = lazy(() => import("./pages/resources/HvacEmergencyTriage"));
const BurstPipeCallScript = lazy(() => import("./pages/resources/BurstPipeCallScript"));
const SewerBackupCallScript = lazy(() => import("./pages/resources/SewerBackupCallScript"));
const DrainCleaningUpsellScript = lazy(() => import("./pages/resources/DrainCleaningUpsellScript"));
const ElectricalSafetyTriage = lazy(() => import("./pages/resources/ElectricalSafetyTriage"));
const PanelUpgradeBookingScript = lazy(() => import("./pages/resources/PanelUpgradeBookingScript"));
const PowerOutageCallScript = lazy(() => import("./pages/resources/PowerOutageCallScript"));
const MissedCallCalculator = lazy(() => import("./pages/resources/MissedCallCalculator"));
const AfterHoursCalculator = lazy(() => import("./pages/resources/AfterHoursCalculator"));
const ServicePricingCalculator = lazy(() => import("./pages/resources/ServicePricingCalculator"));
const AverageTicketPlanner = lazy(() => import("./pages/resources/AverageTicketPlanner"));

const queryClient = new QueryClient();

const HashScrollHandler = () => {
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;

    const targetId = decodeURIComponent(hash.slice(1));
    const scrollToTarget = () => {
      const target = document.getElementById(targetId);
      if (!target) return false;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return true;
    };

    if (scrollToTarget()) return;

    const timeout = window.setTimeout(scrollToTarget, 250);
    return () => window.clearTimeout(timeout);
  }, [hash]);

  return null;
};

// Tracks route changes for PostHog page_viewed events and session replay path management
const RouteTracker = () => {
  const { pathname } = useLocation();
  useRouteTracking(pathname);
  return null;
};

const ProtectedCustomerDashboard = withAuthGuard(CustomerDashboard);
// OnboardingChat handles its own auth logic - supports both authenticated users
// and unauthenticated users with lead_id (two-step signup flow)

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <VapiWidgetProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <HashScrollHandler />
            <RouteTracker />
            <VapiChatWidget />
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
                <Route path="/activation" element={<Activation />} />
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
                {/* Unified admin control center */}
                <Route path="/admin" element={<AdminControl />} />
                {/* Legacy admin routes — redirect to new control center */}
                <Route path="/admin/monitoring" element={<Navigate to="/admin?tab=overview" replace />} />
                <Route path="/admin/users" element={<Navigate to="/admin?tab=staff" replace />} />
                {/* Dashboard tab redirects */}
                <Route path="/today" element={<Navigate to="/dashboard?tab=inbox" replace />} />
                <Route path="/overview" element={<Navigate to="/dashboard?tab=inbox" replace />} />
                <Route path="/calendar" element={<Navigate to="/dashboard?tab=schedule" replace />} />
                <Route path="/appointments" element={<Navigate to="/dashboard?tab=schedule" replace />} />
                {/* Legal pages */}
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                {/* Trade-specific landing pages */}
                <Route path="/plumbers" element={<Plumbers />} />
                <Route path="/hvac" element={<HVAC />} />
                <Route path="/electricians" element={<Electricians />} />
                <Route path="/roofing" element={<Roofing />} />
                {/* Marketing landing pages */}
                <Route path="/difference" element={<Difference />} />
                <Route path="/pricing" element={<Pricing />} />
                {/* Resource Center */}
                <Route path="/resources" element={<ResourceHub />} />
                <Route path="/resources/hvac-dispatcher-script-template" element={<HvacDispatcherScript />} />
                <Route path="/resources/plumbing-dispatcher-script-template" element={<PlumbingDispatcherScript />} />
                <Route path="/resources/electrician-call-answering-script" element={<ElectricianCallScript />} />
                <Route path="/resources/hvac-after-hours-answering-script" element={<HvacAfterHoursScript />} />
                <Route path="/resources/hvac-price-shopper-phone-script" element={<HvacPriceShopperScript />} />
                <Route path="/resources/hvac-emergency-call-triage" element={<HvacEmergencyTriage />} />
                <Route path="/resources/burst-pipe-call-script" element={<BurstPipeCallScript />} />
                <Route path="/resources/sewer-backup-call-script" element={<SewerBackupCallScript />} />
                <Route path="/resources/drain-cleaning-upsell-script" element={<DrainCleaningUpsellScript />} />
                <Route path="/resources/electrical-safety-triage-questions" element={<ElectricalSafetyTriage />} />
                <Route path="/resources/panel-upgrade-booking-script" element={<PanelUpgradeBookingScript />} />
                <Route path="/resources/power-outage-call-script" element={<PowerOutageCallScript />} />
                <Route path="/resources/missed-call-revenue-calculator" element={<MissedCallCalculator />} />
                <Route path="/resources/after-hours-call-calculator" element={<AfterHoursCalculator />} />
                <Route path="/resources/service-pricing-calculator" element={<ServicePricingCalculator />} />
                <Route path="/resources/increase-average-ticket" element={<AverageTicketPlanner />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter >
        </VapiWidgetProvider>
      </TooltipProvider>
    </QueryClientProvider >
  </ErrorBoundary>
);

export default App;
