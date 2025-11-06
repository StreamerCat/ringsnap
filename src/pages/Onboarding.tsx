import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Loader2, Phone, Settings, TestTube, Copy, User, UserCircle2, Clock, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { UsageWarningAlert } from "@/components/UsageWarningAlert";
import { OnboardingSetupForm } from "@/components/OnboardingSetupForm";
import { CarrierForwardingInstructions } from "@/components/CarrierForwardingInstructions";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type AccountRow = Database["public"]["Tables"]["accounts"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ProfileWithAccount = ProfileRow & { accounts?: AccountRow | null };

const ENABLE_DEBUG = true;
const dbg = (...args: unknown[]) => {
  if (ENABLE_DEBUG) {
    console.debug("[Onboarding]", ...args);
  }
};

export default function Onboarding() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<ProfileWithAccount | null>(null);
  const [account, setAccount] = useState<AccountRow | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [assistant, setAssistant] = useState<any | null>(null);
  const [usageStats, setUsageStats] = useState({ minutesUsed: 0, minutesLimit: 150 });
  const [showSetupForm, setShowSetupForm] = useState(false);

  const checkAuth = useCallback(async () => {
    dbg("Starting auth check");
    setAuthReady(false);
    setLoading(true);
    setProfile(null);
    setAccount(null);
    setPhoneNumber(null);
    setAssistant(null);
    setUsageStats({ minutesUsed: 0, minutesLimit: 150 });

    const maxAttempts = 5;
    const retryDelayMs = 300;
    let user = null;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const {
          data: { user: fetchedUser },
          error
        } = await supabase.auth.getUser();

        if (error) {
          dbg("getUser error", error);
          lastError = error;
          break;
        }

        if (fetchedUser) {
          dbg("User found", fetchedUser.id, "on attempt", attempt + 1);
          user = fetchedUser;
          break;
        }

        dbg("No user found on attempt", attempt + 1, "of", maxAttempts);
      } catch (error) {
        dbg("getUser threw", error);
        lastError = error;
        break;
      }

      if (attempt < maxAttempts - 1) {
        dbg("Retrying auth check after delay");
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }

    if (!user) {
      dbg("Unable to resolve authenticated user", lastError);
      setAuthReady(true);
      setLoading(false);
      navigate("/");
      return;
    }

    if (!user.email) {
      dbg("Authenticated user missing email, redirecting");
      setAuthReady(true);
      setLoading(false);
      navigate("/");
      return;
    }

    try {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*, accounts:account_id(*)")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        dbg("Error fetching profile", profileError);
        toast.error("Failed to load account information");
        return;
      }

      if (profileData) {
        dbg("Profile data loaded for user", user.id);
        const typedData = profileData as ProfileWithAccount;
        setProfile(typedData);
        const accountData = typedData.accounts ?? null;
        setAccount(accountData);

        if (accountData?.id) {
          dbg("Fetching supplemental account data", accountData.id);
          const [phoneResult, assistantResult, usageResult] = await Promise.all([
            supabase
              .from("phone_numbers")
              .select("*")
              .eq("account_id", accountData.id)
              .eq("is_primary", true)
              .maybeSingle(),
            supabase
              .from("assistants")
              .select("*")
              .eq("account_id", accountData.id)
              .eq("is_primary", true)
              .maybeSingle(),
            supabase
              .from("usage_logs")
              .select("call_duration_seconds")
              .eq("account_id", accountData.id)
          ]);

          if (phoneResult.data) {
            dbg("Primary phone number loaded");
            setPhoneNumber(phoneResult.data.phone_number);
          }

          if (assistantResult.data) {
            dbg("Primary assistant loaded");
            setAssistant(assistantResult.data);
          }

          if (usageResult.data) {
            const totalSeconds = usageResult.data.reduce(
              (sum, log) => sum + (log.call_duration_seconds || 0),
              0
            );
            const totalMinutes = Math.ceil(totalSeconds / 60);
            dbg("Usage stats computed", totalMinutes, "minutes");
            setUsageStats({
              minutesUsed: totalMinutes,
              minutesLimit: accountData.monthly_minutes_limit || 150
            });
          }
        }
      } else {
        dbg("No profile data returned for user", user.id);
      }
    } catch (error) {
      dbg("Error loading account data", error);
      toast.error("Failed to load account information");
    } finally {
      dbg("Auth check complete");
      setAuthReady(true);
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      dbg("Auth state change", event, session?.user?.id);
      if (session?.user) {
        checkAuth();
      }
    });

    return () => {
      dbg("Cleaning up auth state subscription");
      subscription.unsubscribe();
    };
  }, [checkAuth]);

  // Show setup form if provisioning status is pending
  useEffect(() => {
    if (account?.provisioning_status === 'pending') {
      setShowSetupForm(true);
    } else {
      setShowSetupForm(false);
    }
  }, [account?.provisioning_status]);

  const handleSetupComplete = async () => {
    setShowSetupForm(false);
    toast.success("Setup complete! Provisioning your resources...");
    
    // Poll for provisioning completion (faster 3s polling)
    const pollInterval = setInterval(async () => {
      const { data: updatedAccount } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', account?.id)
        .single();
      
      if (updatedAccount?.provisioning_status === 'completed') {
        clearInterval(pollInterval);
        toast.success("Your account is ready!");
        await checkAuth(); // Refresh all data
      } else if (updatedAccount?.provisioning_status === 'failed') {
        clearInterval(pollInterval);
        toast.error("Provisioning failed. Please contact support.");
      }
    }, 3000); // Poll every 3 seconds (faster)

    // Stop polling after 2 minutes
    setTimeout(() => clearInterval(pollInterval), 120000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (!authReady || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show setup form modal if provisioning is pending
  if (account?.provisioning_status === 'pending') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted py-12 px-4">
        <div className="max-w-2xl mx-auto text-center space-y-8">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Check className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold">
            Welcome{profile?.name ? `, ${profile.name}!` : ""}
          </h1>
          <p className="text-xl text-muted-foreground">
            Let's complete your account setup
          </p>
        </div>

        <OnboardingSetupForm
          open={showSetupForm}
          onOpenChange={setShowSetupForm}
          onSuccess={handleSetupComplete}
        />
      </div>
    );
  }

  const trialDaysRemaining = account?.trial_end_date
    ? Math.ceil((new Date(account.trial_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 3;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted py-8 px-4 sm:py-12">
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
        {/* Progress Banner - Shows during provisioning */}
        {account?.provisioning_status === 'provisioning' && (
          <Card className="border-2 border-blue-500 bg-blue-50 shadow-lg sticky top-4 z-10">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <CardTitle className="text-lg sm:text-xl">Setting Up Your Account</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center">
                    <Check className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium">Creating your phone number</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${phoneNumber ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {phoneNumber ? <Check className="h-5 w-5" /> : <Loader2 className="h-4 w-4 animate-spin" />}
                  </div>
                  <span className="text-sm font-medium">Configuring AI assistant</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${assistant ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {assistant ? <Check className="h-5 w-5" /> : <span className="text-xs">3</span>}
                  </div>
                  <span className="text-sm font-medium">Finalizing account</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                This usually takes 60-90 seconds. Feel free to explore below!
              </p>
            </CardContent>
          </Card>
        )}

        {/* Welcome Header */}
        <Card className="bg-gradient-to-br from-primary/5 to-cream/20">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl sm:text-4xl font-bold mb-2">
              Welcome to RingSnap! 🎉
            </CardTitle>
            <CardDescription className="text-base sm:text-lg">
              Your AI phone assistant is {phoneNumber ? 'ready' : 'being set up'}
            </CardDescription>
            {account?.subscription_status === 'trial' && (
              <div className="inline-block bg-primary/10 text-primary px-4 py-2 rounded-full font-semibold mt-4">
                {trialDaysRemaining} days remaining in your trial
              </div>
            )}
          </CardHeader>
        </Card>

        {/* Carrier Forwarding Instructions - Hero when provisioned */}
        {phoneNumber && (
          <CarrierForwardingInstructions 
            phoneNumber={phoneNumber}
            companyName={account?.company_name}
          />
        )}

        {/* Test Assistant Card */}
        {phoneNumber && (
          <Card className="border-2 border-green-500 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Phone className="h-6 w-6 text-green-600" />
                Test Your AI Assistant
              </CardTitle>
              <CardDescription className="text-base">
                Call your RingSnap number to hear your {assistant?.voice_gender || 'AI'} assistant in action
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                size="lg"
                asChild
                className="w-full h-16 text-xl font-bold bg-green-600 hover:bg-green-700"
              >
                <a href={`tel:${phoneNumber}`}>
                  <Phone className="mr-3 h-6 w-6" />
                  Call {phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3")} Now
                </a>
              </Button>
              <p className="text-xs text-center text-muted-foreground mt-3">
                The call will be answered by your AI assistant just like a real customer call
              </p>
            </CardContent>
          </Card>
        )}

        {/* Usage Progress Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Trial Usage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Minutes Used</span>
                <span className="font-semibold">
                  {usageStats.minutesUsed} / {usageStats.minutesLimit} minutes
                </span>
              </div>
              <Progress value={(usageStats.minutesUsed / usageStats.minutesLimit) * 100} />
            </div>
            {(usageStats.minutesUsed / usageStats.minutesLimit) * 100 >= 80 && (
              <UsageWarningAlert
                usagePercent={(usageStats.minutesUsed / usageStats.minutesLimit) * 100}
                remainingMinutes={usageStats.minutesLimit - usageStats.minutesUsed}
                onDismiss={() => {}}
              />
            )}
            <Button variant="gradient" className="w-full" onClick={() => navigate('/dashboard')}>
              <TrendingUp className="h-4 w-4 mr-2" />
              Upgrade Plan
            </Button>
          </CardContent>
        </Card>

        {/* Assistant Details Card */}
        {assistant && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {assistant.voice_gender === 'male' ? (
                  <User className="h-5 w-5 text-primary" />
                ) : (
                  <UserCircle2 className="h-5 w-5 text-primary" />
                )}
                Your AI Assistant
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold">{assistant.name || 'AI Assistant'}</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {assistant.voice_gender} Voice
                  </p>
                </div>
                <Badge variant={assistant.status === 'active' ? 'default' : 'secondary'}>
                  {assistant.status}
                </Badge>
              </div>
              {phoneNumber && (
                <Button variant="outline" className="w-full" asChild>
                  <a href={`tel:${phoneNumber}`}>
                    <Phone className="h-4 w-4 mr-2" />
                    Make Test Call
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Next Steps */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Phone className="h-8 w-8 text-primary mb-2" />
                {phoneNumber && <Check className="h-5 w-5 text-green-500" />}
              </div>
              <CardTitle>1. Forward Your Phone</CardTitle>
              <CardDescription>
                Set up call forwarding from your business line to your RingSnap number
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {phoneNumber 
                  ? "✓ Your RingSnap number is ready above!"
                  : "Your dedicated number will be sent to you within the next few minutes."
                }
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <TestTube className="h-8 w-8 text-primary mb-2" />
              <CardTitle>2. Test a Call</CardTitle>
              <CardDescription>
                Call your business line to hear your AI assistant in action
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                The AI will answer professionally and capture lead information automatically.
              </p>
              {phoneNumber && (
                <Button variant="outline" size="sm" asChild className="w-full">
                  <a href={`tel:${phoneNumber}`}>
                    <Phone className="h-3 w-3 mr-2" />
                    Call Now
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Settings className="h-8 w-8 text-primary mb-2" />
              <CardTitle>3. Customize Settings</CardTitle>
              <CardDescription>
                Adjust your greeting, business hours, and notification preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Access your dashboard to personalize your AI assistant's behavior.
              </p>
              <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('/dashboard')}>
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold text-muted-foreground">Company Name</p>
                <p className="text-lg">{account?.company_name || "Not specified"}</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground">Trade</p>
                <p className="text-lg">{account?.trade || "Not specified"}</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground">Name</p>
                <p className="text-lg">{profile?.name || "Not specified"}</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground">Phone</p>
                <p className="text-lg">{profile?.phone || "Not provided"}</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground">Account Status</p>
                <p className="text-lg capitalize">{account?.subscription_status || "trial"}</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground">Plan Type</p>
                <p className="text-lg capitalize">{account?.plan_type || "starter"}</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground">Trial Ends</p>
                <p className="text-lg">
                  {account?.trial_end_date
                    ? new Date(account.trial_end_date).toLocaleString()
                    : "Pending"}
                </p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground">Provisioning Status</p>
                <p className="text-lg capitalize">{account?.provisioning_status || "pending"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" variant="gradient" onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </Button>
          <Button size="lg" variant="outline" onClick={handleLogout}>
            Sign Out
          </Button>
        </div>

        {/* Support */}
        <Card className="bg-muted">
          <CardContent className="pt-6">
            <p className="text-center text-sm text-muted-foreground">
              Need help? Contact our support team at{" "}
              <a href="mailto:support@ringsnap.com" className="text-primary hover:underline">
                support@ringsnap.com
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
