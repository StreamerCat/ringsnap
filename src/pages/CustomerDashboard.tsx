
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
  Calendar, Loader2
} from "lucide-react";
import { featureFlags } from "@/lib/featureFlags";
import { isProvisioningInProgress, isProvisioned } from "@/lib/billing/dashboardPlans";
import { UpgradeModal } from "@/components/dashboard/UpgradeModal";

// Tab Components
import { TodayTab } from "@/components/dashboard/TodayTab";
import { OverviewTab } from "@/components/dashboard/OverviewTab";
import { PhoneNumbersTab } from "@/components/dashboard/PhoneNumbersTab";
import { AssistantsTab } from "@/components/dashboard/AssistantsTab";
import { TeamTab } from "@/components/dashboard/TeamTab";
import { SettingsTab } from "@/components/dashboard/SettingsTab";
import { BillingTab } from "@/components/dashboard/BillingTab";
import { ReferralsTab } from "@/components/dashboard/ReferralsTab";

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "today");
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
      if (user) {
        await loadDashboardData(user.id);
      }
    };
    initData();

    // Set up Realtime subscription for usage_logs
    let subscription: any = null;
    const setupRealtimeSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && account?.id) {
        subscription = supabase
          .channel('usage_logs_changes')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'usage_logs',
              filter: `account_id=eq.${account.id}`
            },
            (payload) => {
              console.log('New usage log received:', payload);
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

  const loadDashboardData = async (userId: string) => {
    try {
      // Load profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*, accounts(*)")
        .eq("id", userId)
        .maybeSingle();

      if (profileError) throw new Error(`Failed to load profile: ${profileError.message}`);

      // If profile doesn't exist, they need to finish onboarding
      if (!profileData) {
        navigate("/onboarding");
        return;
      }

      if (!profileData.accounts) throw new Error("Account not found. Your account may still be setting up.");

      setProfile(profileData);
      setAccount(profileData.accounts);

      const accountId = profileData.account_id;

      // Load parallel data (removed referral_codes fetch to avoid errors)
      const [phonesRes, assistantsRes, logsRes, creditsRes, referralsRes] = await Promise.all([
        supabase.from("phone_numbers").select("*").eq("account_id", accountId),
        supabase.from("assistants").select("*").eq("account_id", accountId),
        supabase.from("usage_logs").select("*").eq("account_id", accountId).gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()).order("created_at", { ascending: false }).limit(50),
        supabase.from("account_credits").select("*").eq("account_id", accountId).order("created_at", { ascending: false }),
        supabase.from("referrals").select("*").eq("referrer_account_id", accountId).order("created_at", { ascending: false }),
      ]);

      setPhoneNumbers(phonesRes.data || []);
      setAssistants(assistantsRes.data || []);
      setUsageLogs(logsRes.data || []);
      setAccountCredits(creditsRes.data || []);
      setReferrals(referralsRes.data || []);

      // Load recording laws if state is present
      if (profileData.accounts.billing_state) {
        const { data: stateData } = await supabase
          .from("state_recording_laws")
          .select("*")
          .eq("state_code", profileData.accounts.billing_state)
          .single();
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

  const calculateUsagePercent = () => {
    if (!account) return 0;
    return Math.round((account.monthly_minutes_used / account.monthly_minutes_limit) * 100);
  };

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
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        {/* Header - shows company name, first name, and Vapi number */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{account.company_name}</h1>
              {account.is_test_account && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300">
                  TEST ACCOUNT
                </span>
              )}
            </div>
            <p className="text-muted-foreground">
              {profile.name?.split(' ')[0] || profile.name}
            </p>
            {account.vapi_phone_number && (
              <p className="text-sm text-primary font-medium">
                {account.vapi_phone_number}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/")}>
              Home
            </Button>
            <Button variant="outline" onClick={async () => {
              try {
                await signOutUser();
              } finally {
                navigate("/signin");
              }
            }}>
              Sign Out
            </Button>
          </div>
        </div>

        {/* Usage Warning */}
        {usagePercent >= 80 && (
          <div className="mb-6">
            <UsageWarningAlert
              usagePercent={usagePercent}
              remainingMinutes={remainingMinutes}
            />
          </div>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 lg:grid-cols-8 mb-8">
            <TabsTrigger value="today">
              <Calendar className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Today</span>
            </TabsTrigger>
            <TabsTrigger value="overview">
              <TrendingUp className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="phone-numbers">
              <Phone className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Phones</span>
            </TabsTrigger>
            <TabsTrigger value="assistants">
              <Users className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Assistant</span>
            </TabsTrigger>
            <TabsTrigger value="team">
              <Users className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Team</span>
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
            <TabsTrigger value="billing">
              <CreditCard className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Billing</span>
            </TabsTrigger>
            <TabsTrigger value="referrals">
              <Gift className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Earn</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="today">
            <TodayTab accountId={account.id} />
          </TabsContent>

          <TabsContent value="overview">
            <OverviewTab
              account={account}
              usageLogs={usageLogs}
              usagePercent={usagePercent}
              remainingMinutes={remainingMinutes}
              trialDaysRemaining={trialDaysRemaining}
              creditsBalance={creditsBalance}
              onOpenUpgradeModal={() => setUpgradeModalOpen(true)}
            />
          </TabsContent>

          <TabsContent value="phone-numbers">
            <PhoneNumbersTab account={account} phoneNumbers={phoneNumbers} />
          </TabsContent>

          <TabsContent value="assistants">
            <AssistantsTab account={account} assistants={assistants} />
          </TabsContent>

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

          <TabsContent value="referrals">
            <ReferralsTab
              referralStats={referralStats}
            />
          </TabsContent>
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
