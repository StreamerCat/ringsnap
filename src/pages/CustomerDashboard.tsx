
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { signOutUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { UsageWarningAlert } from "@/components/UsageWarningAlert";
import {
  Phone, Users, Settings, CreditCard, Gift, TrendingUp,
  Calendar, Loader2, Bot, UsersRound, CalendarCheck, CalendarRange, Inbox
} from "lucide-react";
import { featureFlags } from "@/lib/featureFlags";
import { getRoleDashboardUrl } from "@/lib/auth/redirects";
import { isProvisioningInProgress, isProvisioned } from "@/lib/billing/dashboardPlans";
import { UpgradeModal } from "@/components/dashboard/UpgradeModal";
import { setUserContext, trackPageLoad, trackClick } from "@/lib/sentry-tracking";
import { capture, identify, group, resetAnalytics } from "@/lib/analytics";
import * as Sentry from "@sentry/react";
import { useVapiWidget } from "@/lib/VapiWidgetContext";

// Tab Components
import { PhoneNumbersTab } from "@/components/dashboard/PhoneNumbersTab";
import { AssistantsTab } from "@/components/dashboard/AssistantsTab";
import { TeamTab } from "@/components/dashboard/TeamTab";
import { SettingsTab } from "@/components/dashboard/SettingsTab";
import { BillingTab } from "@/components/dashboard/BillingTab";
import { ReferralsTab } from "@/components/dashboard/ReferralsTab";
import { ProvisioningBanner } from "@/components/dashboard/ProvisioningBanner";
import { InboxTab } from "@/components/dashboard/InboxTab";
import { ScheduleTab } from "@/components/dashboard/ScheduleTab";


import { OnboardingUiGuardrail } from "@/components/dashboard/OnboardingUiGuardrail";
import { useOnboardingGuard } from "@/hooks/useOnboardingGuard";


import { Helmet } from "react-helmet-async";

export default function CustomerDashboard() {
  // Route guard: redirect to /activation if onboarding incomplete
  const { isLoading: guardLoading, isOnboardingComplete } = useOnboardingGuard({
    redirectToActivation: true, // Redirect if onboarding_completed_at IS NULL
  });

  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { setWidgetContext } = useVapiWidget();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "inbox");
  const [account, setAccount] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [phoneNumbers, setPhoneNumbers] = useState<any[]>([]);
  const [assistants, setAssistants] = useState<any[]>([]);
  const [usageLogs, setUsageLogs] = useState<any[]>([]);
  const [accountCredits, setAccountCredits] = useState<any[]>([]);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [recordingState, setRecordingState] = useState<any>(null);

  // Upgrade modal state
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  // Provisioning polling ref
  const [isPollingProvisioning, setIsPollingProvisioning] = useState(false);

  useEffect(() => {
    // Auth is handled by withAuthGuard wrapper in App.tsx
    const initData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Staff guard: if this user has a staff role they should not be on the
      // customer dashboard. Redirect them to the correct staff dashboard before
      // attempting to load any customer data (which would fail for staff users
      // who have no customer profile/account row).
      const { data: staffRole } = await supabase
        .from('staff_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (staffRole) {
        navigate(getRoleDashboardUrl({
          isStaff: true,
          isSales: staffRole.role === 'sales',
          isPlatformAdmin: staffRole.role === 'platform_admin',
          isPlatformOwner: staffRole.role === 'platform_owner',
          isCustomer: false,
          staffRole: staffRole.role,
        }), { replace: true });
        return;
      }

      await loadDashboardData(user.id);
      // Track page load after data is ready
      trackPageLoad('CustomerDashboard');
    };
    initData();

    // Set up Realtime subscription for calls
    let subscription: any = null;
    const setupRealtimeSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && account?.id) {
        subscription = supabase
          .channel('calls_changes')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'calls',
              filter: `account_id=eq.${account.id}`
            },
            (payload) => {
              console.log('New call received:', payload);
              // Add new log to state
              setUsageLogs(prev => [payload.new as any, ...prev]);
              // Optionally reload full dashboard data for updated stats
              if (user) {
                loadDashboardData(user.id);
              }
            }
          )
          .subscribe();
      }
    };

    if (account?.id) {
      setupRealtimeSubscription();
    }

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [account?.id]);

  // Polling for provisioning status
  useEffect(() => {
    let pollingInterval: NodeJS.Timeout;

    if (account && account.provisioning_status !== 'completed' && !account.period_end) {
      // We poll if not completed or if it looks like we are waiting for something. 
      // Checking 'completed' is the main thing.
      // Also check if vapi_phone_number is missing.
      const shouldPoll = (account.provisioning_status !== 'completed' && account.provisioning_status !== 'active') || !account.vapi_phone_number;

      if (shouldPoll) {
        pollingInterval = setInterval(async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            // Reload just the account/profile part to be lightweight?
            // Or just call loadDashboardData.
            // Let's call a lighter weight refresh or full load.
            // Full load is safer to ensure all dependent data (like phone_numbers table) is also refreshed.
            console.log("Polling for provisioning updates...");
            loadDashboardData(user.id);
          }
        }, 5000);
      }
    }

    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [account, account?.provisioning_status, account?.vapi_phone_number]);

  const loadDashboardData = async (userId: string) => {
    try {
      // Load profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*, accounts(*)")
        .eq("id", userId)
        .maybeSingle();

      if (profileError) throw new Error(`Failed to load profile: ${profileError.message}`);

      // If profile doesn't exist, stop here and let the "Account Setup in
      // Progress" UI state render.  Do NOT navigate to /onboarding — that
      // causes an infinite loop for users (e.g. staff) who land on /dashboard
      // without a customer profile.  Legitimate new customers are redirected
      // to onboarding by redirectToRoleDashboard() before they ever reach this
      // component.
      if (!profileData) {
        setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (!profileData.accounts) throw new Error("Account not found. Your account may still be setting up.");

      setProfile(profileData);
      setAccount(profileData.accounts);

      // Set Sentry context for error tracking
      setUserContext({
        userId,
        accountId: profileData.account_id,
        plan: profileData.accounts.plan_type,
      });

      // PostHog: re-identify with full context + group by account
      identify(userId, {
        plan_key: profileData.accounts.plan_key || profileData.accounts.plan_type,
        billing_status: profileData.accounts.subscription_status,
        account_id: profileData.account_id,
        last_active_at: new Date().toISOString(),
      });
      if (profileData.account_id) {
        group('account', profileData.account_id, {
          plan_key: profileData.accounts.plan_key || profileData.accounts.plan_type,
        });
      }
      capture('dashboard_viewed', { dashboard_section: activeTab });

      // Update Vapi Widget Context
      setWidgetContext({
        customerName: profileData.name,
        customerEmail: user?.email,
        accountId: profileData.account_id,
        planName: profileData.accounts.plan_type,
        minutesLimit: profileData.accounts.monthly_minutes_limit,
        minutesUsed: profileData.accounts.monthly_minutes_used,
        provisioningStatus: profileData.accounts.provisioning_status
      });

      const accountId = profileData.account_id;

      // Load parallel data (removed referral_codes fetch to avoid errors)
      // Switch from usage_logs to calls table
      const [phonesRes, assistantsRes, callsRes, creditsRes, referralsRes] = await Promise.all([
        supabase.from("phone_numbers").select("*").or(`assigned_account_id.eq.${accountId},account_id.eq.${accountId}`) as Promise<any>,
        supabase.from("assistants").select("*").eq("account_id", accountId) as Promise<any>,
        supabase.rpc("get_recent_calls", { p_account_id: accountId, p_limit: 50 }) as Promise<any>,
        supabase.from("account_credits").select("*").eq("account_id", accountId).order("created_at", { ascending: false }) as Promise<any>,
        supabase.from("referrals").select("*").eq("referrer_account_id", accountId).order("created_at", { ascending: false }) as Promise<any>,
      ]);

      if (callsRes.error) {
        console.error("Error fetching calls:", callsRes.error);
        // Fallback to empty if RPC fails (e.g. not applied yet)
      }

      setPhoneNumbers(phonesRes.data || []);
      setAssistants(assistantsRes.data || []);
      setUsageLogs(callsRes.data || []); // We'll keep the state name 'usageLogs' for now to minimize refactors in child props, or rename it. 
      // Rename state is cleaner: setUsageLogs -> setCalls
      // But to follow "Minimal changes" and since I'm passing it to OverviewTab as usageLogs, I'll keep the variable name wrapper or refactor carefully. 
      // Actually, I'll rename the state variable in a separate step or just cast it here. 
      // Let's stick to using 'usageLogs' state variable but holding 'calls' data, 
      // however 'calls' schema is different. I need to update OverviewTab to handle 'calls' schema.

      setAccountCredits(creditsRes.data || []);
      setReferrals(referralsRes.data || []);

      // Load recording laws if state is present
      if (profileData.accounts.billing_state) {
        const { data: stateData } = await supabase
          .from("state_recording_laws")
          .select("*")
          .eq("state_code", profileData.accounts.billing_state)
          .maybeSingle();
        setRecordingState(stateData);
      }

    } catch (error) {
      console.error("Failed to load dashboard data:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to load dashboard data";
      toast({
        title: "Error Loading Dashboard",
        description: errorMessage,
        variant: "destructive",
        duration: 10000,
      });
    } finally {
      setLoading(false);
    }
  };

  // Helper to calculate usage from calls
  const calculateUsagePercent = () => {
    if (!account) return 0;
    // Sum duration_seconds from usageLogs (which are now call_logs)
    // Filter for current billing period if possible, or just this month
    // MVP: Sum all loaded calls (last 30 days) or ideally respect billing cycle.
    // For MVP "Usage is not updating", we'll just sum the loaded calls for now or fetch aggregate.
    // Better: Filter logs by current month.
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const minutesUsed = usageLogs
      .filter((c: any) => c.started_at >= startOfMonth)
      .reduce((acc: number, c: any) => acc + (c.duration_seconds || 0), 0) / 60;

    return Math.round((minutesUsed / account.monthly_minutes_limit) * 100);
  };

  // Realtime subscription + burst polling for near real-time updates
  useEffect(() => {
    let subscription: any = null;
    let pollingInterval: NodeJS.Timeout | null = null;
    let burstTimeout: NodeJS.Timeout | null = null;
    let isInBurstMode = true;
    let userId: string | null = null;

    // Merge a single call into usageLogs state
    const mergeCall = (newCall: any) => {
      setUsageLogs((prev) => {
        const existingIndex = prev.findIndex((c: any) => c.id === newCall.id);
        if (existingIndex >= 0) {
          // Update existing call
          const updated = [...prev];
          updated[existingIndex] = { ...updated[existingIndex], ...newCall };
          return updated;
        } else {
          // Insert new call at the beginning
          return [newCall, ...prev];
        }
      });
    };

    const setupRealtimeAndPolling = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !account?.id) return;
      userId = user.id;

      // Subscribe to both INSERT and UPDATE events
      subscription = supabase
        .channel('call_logs_changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'call_logs',
            filter: `account_id=eq.${account.id}`
          },
          (payload) => {
            console.log('New call received:', payload.new);
            mergeCall(payload.new);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'call_logs',
            filter: `account_id=eq.${account.id}`
          },
          (payload) => {
            console.log('Call updated:', payload.new);
            mergeCall(payload.new);
          }
        )
        .subscribe();

      // Burst polling: 5 seconds for first 60 seconds (for test call UX)
      const BURST_INTERVAL = 5000;
      const NORMAL_INTERVAL = 30000;
      const BURST_DURATION = 60000;

      const startPolling = (interval: number) => {
        if (pollingInterval) clearInterval(pollingInterval);
        pollingInterval = setInterval(() => {
          // Pause polling when tab is hidden
          if (document.hidden) return;
          console.log(`Polling call logs (${isInBurstMode ? 'burst' : 'normal'})...`);
          loadDashboardData(userId!);
        }, interval);
      };

      // Start with burst polling
      startPolling(BURST_INTERVAL);

      // After 60 seconds, switch to normal polling
      burstTimeout = setTimeout(() => {
        isInBurstMode = false;
        startPolling(NORMAL_INTERVAL);
      }, BURST_DURATION);
    };

    if (account?.id) {
      setupRealtimeAndPolling();
    }

    // Visibility change listener - restart polling when tab becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden && userId && account?.id) {
        // Immediate refresh when tab becomes visible
        loadDashboardData(userId);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (subscription) supabase.removeChannel(subscription);
      if (pollingInterval) clearInterval(pollingInterval);
      if (burstTimeout) clearTimeout(burstTimeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [account?.id]);
  const calculateRemainingMinutes = () => {
    if (!account) return 0;
    return Math.max(0, account.monthly_minutes_limit - account.monthly_minutes_used);
  };

  const calculateTrialDaysRemaining = () => {
    if (!account || account.subscription_status !== 'trial') return 0;
    const endDate = new Date(account.trial_end_date);
    const now = new Date();
    const diff = endDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const getTotalCreditsBalance = () => {
    return accountCredits
      .filter(credit => credit.status === 'available')
      .reduce((sum, credit) => sum + credit.amount_cents, 0) / 100;
  };

  const getReferralStats = () => {
    const total = referrals.length;
    const converted = referrals.filter(r => r.status === 'converted').length;
    const creditsEarned = accountCredits
      .filter(c => c.source === 'referral')
      .reduce((sum, c) => sum + c.amount_cents, 0) / 100;
    return { total, converted, creditsEarned };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!account || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">Account Setup in Progress</h2>
          <p className="text-muted-foreground">Your account is being set up. This usually takes a few seconds.</p>
          <Button onClick={() => window.location.reload()}>Refresh Page</Button>
        </div>
      </div>
    );
  }

  const usagePercent = calculateUsagePercent();
  const remainingMinutes = calculateRemainingMinutes();
  const trialDaysRemaining = calculateTrialDaysRemaining();
  const creditsBalance = getTotalCreditsBalance();
  const referralStats = getReferralStats();

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Dashboard | RingSnap</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="container mx-auto py-4 sm:py-8 px-3 sm:px-4 max-w-7xl">
        {/* Header - responsive: stacks on mobile */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-3xl font-bold truncate">{account.company_name}</h1>
              {account.is_test_account && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300 whitespace-nowrap">
                  TEST
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {profile.name?.split(' ')[0] || profile.name}
            </p>
            {account.vapi_phone_number && (
              <p className="text-sm text-primary font-medium">
                {account.vapi_phone_number}
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" className="h-9" onClick={() => navigate("/")}>
              Home
            </Button>
            <Button variant="outline" size="sm" className="h-9" onClick={async () => {
              try {
                await signOutUser();
                resetAnalytics(); // PostHog: reset identity on signout
              } finally {
                navigate("/signin");
              }
            }}>
              Sign Out
            </Button>
          </div>
        </div>

        {/* Onboarding Guardrail - New System */}
        {account?.id && <OnboardingUiGuardrail accountId={account.id} />}

        {/* Provisioning Banner - shows when provisioning incomplete */}
        <ProvisioningBanner account={account} />

        {/* Usage Warning */}
        {usagePercent >= 80 && (
          <div className="mb-6">
            <UsageWarningAlert
              usagePercent={usagePercent}
              remainingMinutes={remainingMinutes}
            />
          </div>
        )}

        {/* Main Tabs - horizontal scroll on mobile */}
        <Tabs value={activeTab} onValueChange={(tab) => {
          setActiveTab(tab);
          capture('dashboard_viewed', { dashboard_section: tab });
        }}>
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 mb-4 sm:mb-8">
            <TabsList className="inline-flex w-auto min-w-full sm:grid sm:grid-cols-6 gap-1">
              <TabsTrigger value="inbox" className="flex-shrink-0 px-3">
                <Inbox className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline text-xs">Inbox</span>
              </TabsTrigger>
              <TabsTrigger value="schedule" className="flex-shrink-0 px-3">
                <CalendarCheck className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline text-xs">Schedule</span>
              </TabsTrigger>
              <TabsTrigger value="phone-numbers" className="flex-shrink-0 px-3">
                <Phone className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline text-xs">Phones</span>
              </TabsTrigger>
              <TabsTrigger value="team" className="flex-shrink-0 px-3">
                <UsersRound className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline text-xs">Team</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex-shrink-0 px-3">
                <Settings className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline text-xs">Settings</span>
              </TabsTrigger>
              <TabsTrigger value="billing" className="flex-shrink-0 px-3">
                <CreditCard className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline text-xs">Billing</span>
              </TabsTrigger>
            </TabsList>
          </div>


          {/* New Primary Tabs */}
          <TabsContent value="inbox">
            <InboxTab calls={usageLogs} companyName={account.company_name} />
          </TabsContent>

          <TabsContent value="schedule">
            <ScheduleTab calls={usageLogs} companyName={account.company_name} />
          </TabsContent>

          {/* Legacy Tabs (for redirect compatibility) */}
          <TabsContent value="today">
            <InboxTab calls={usageLogs} companyName={account.company_name} />
          </TabsContent>

          <TabsContent value="overview">
            <InboxTab calls={usageLogs} companyName={account.company_name} />
          </TabsContent>

          <TabsContent value="calendar">
            <ScheduleTab calls={usageLogs} companyName={account.company_name} />
          </TabsContent>

          <TabsContent value="appointments">
            <ScheduleTab calls={usageLogs} companyName={account.company_name} />
          </TabsContent>


          <TabsContent value="phone-numbers">
            <PhoneNumbersTab account={account} phoneNumbers={phoneNumbers} />
          </TabsContent>

          {/* Commented out - will add later */}
          {/* <TabsContent value="assistants">
            <AssistantsTab account={account} assistants={assistants} />
          </TabsContent> */}

          <TabsContent value="team">
            <TeamTab accountId={account.id} />
          </TabsContent>

          <TabsContent value="settings">
            <SettingsTab
              account={account}
              onUpdateAccount={setAccount}
              recordingState={recordingState}
              onOpenUpgradeModal={() => setUpgradeModalOpen(true)}
            />
          </TabsContent>

          <TabsContent value="billing">
            <BillingTab
              account={account}
              trialDaysRemaining={trialDaysRemaining}
              creditsBalance={creditsBalance}
              onRefresh={() => {
                if (profile?.id) loadDashboardData(profile.id);
              }}
            />
          </TabsContent>

          {/* Commented out - will add later */}
          {/* <TabsContent value="referrals">
            <ReferralsTab
              referralStats={referralStats}
            />
          </TabsContent> */}
        </Tabs>

        {/* Upgrade Modal - controlled by feature flag */}
        {featureFlags.upgradeModalEnabled && (
          <UpgradeModal
            open={upgradeModalOpen}
            onOpenChange={setUpgradeModalOpen}
            currentPlanKey={account.plan_type}
            accountId={account.id}
          />
        )}
      </div>
    </div>
  );
}
