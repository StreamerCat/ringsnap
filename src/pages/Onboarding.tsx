import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { signOutUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Loader2, Phone, Settings, TestTube, Copy, User, UserCircle2, Clock, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { UsageWarningAlert } from "@/components/UsageWarningAlert";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { CarrierForwardingInstructions } from "@/components/CarrierForwardingInstructions";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type AccountRow = Database["public"]["Tables"]["accounts"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type AssistantRow = Database["public"]["Tables"]["assistants"]["Row"];
type ProfileWithAccount = ProfileRow & { accounts?: AccountRow | null };

const DEBUG_ONBOARDING = import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true';
const dlog = (...args: unknown[]) => {
  if (DEBUG_ONBOARDING) {
    console.debug("[Onboarding]", ...args);
  }
};

export default function Onboarding() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileWithAccount | null>(null);
  const [account, setAccount] = useState<AccountRow | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [assistant, setAssistant] = useState<AssistantRow | null>(null);
  const [usageStats, setUsageStats] = useState({ minutesUsed: 0, minutesLimit: 150 });
  const [showSetupForm, setShowSetupForm] = useState(false);
  const [authStatus, setAuthStatus] = useState<"checking" | "ready" | "error" | "signed-out">("checking");
  const [statusMessage, setStatusMessage] = useState("Checking your session...");
  const [lastAuthError, setLastAuthError] = useState<unknown>(null);

  useEffect(() => {
    dlog("Onboarding component mounted");
    return () => {
      dlog("Onboarding component unmounted");
    };
  }, []);

  useEffect(() => {
    dlog("Auth status updated", authStatus, statusMessage, lastAuthError);
  }, [authStatus, statusMessage, lastAuthError]);

  const derivedAreaCode = useMemo(() => {
    const digits = (profile?.phone ?? "").replace(/\D/g, "");
    if (digits.length >= 10) {
      return digits.slice(-10, -7);
    }
    return digits.slice(0, 3) || null;
  }, [profile?.phone]);

  const checkAuth = useCallback(async () => {
    dlog("Starting auth check");
    setAuthStatus("checking");
    setStatusMessage("Verifying your session...");
    setLastAuthError(null);
    setProfile(null);
    setAccount(null);
    setPhoneNumber(null);
    setAssistant(null);
    setUsageStats({ minutesUsed: 0, minutesLimit: 150 });

    const maxAttempts = 5;
    const minDelay = 300;
    const maxDelay = 500;
    let user = null;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const attemptNumber = attempt + 1;
      setStatusMessage(`Verifying your session (attempt ${attemptNumber}/${maxAttempts})...`);
      try {
        const {
          data: { user: fetchedUser },
          error
        } = await supabase.auth.getUser();

        if (error) {
          dlog("getUser error", attemptNumber, error);
          lastError = error;
        } else if (fetchedUser) {
          dlog("User found", fetchedUser.id, "on attempt", attemptNumber);
          user = fetchedUser;
          break;
        } else {
          dlog("No user found on attempt", attemptNumber, "of", maxAttempts);
        }
      } catch (error) {
        dlog("getUser threw", attemptNumber, error);
        lastError = error;
      }

      if (user) {
        break;
      }

      if (attempt < maxAttempts - 1) {
        const retryDelayMs = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        dlog("Retrying auth check after delay", retryDelayMs, "ms");
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }

    if (!user) {
      dlog("Unable to resolve authenticated user after retries", lastError);
      setAuthStatus(lastError ? "error" : "signed-out");
      setStatusMessage(
        lastError
          ? "We couldn't verify your session. Please try again."
          : "No active session detected. You may need to sign in again."
      );
      setLastAuthError(lastError);
      return;
    }

    if (!user.email) {
      dlog("Authenticated user missing email, prompting sign-in");
      setAuthStatus("error");
      setStatusMessage("Your account is missing an email address. Please sign in again.");
      setLastAuthError(new Error("User missing email"));
      return;
    }

    try {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*, accounts:account_id(*)")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        dlog("Error fetching profile", profileError);
        toast.error("Failed to load account information");
        setAuthStatus("error");
        setStatusMessage("We hit a snag while loading your profile. Please try again.");
        setLastAuthError(profileError);
        return;
      }

      if (profileData) {
        dlog("Profile data loaded for user", user.id);
        const typedData = profileData as ProfileWithAccount;
        setProfile(typedData);
        const accountData = typedData.accounts ?? null;
        setAccount(accountData);

        if (accountData?.id) {
          dlog("Fetching supplemental account data", accountData.id);
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
            dlog("Primary phone number loaded");
            setPhoneNumber(phoneResult.data.phone_number);
          }

          if (assistantResult.data) {
            dlog("Primary assistant loaded");
            setAssistant(assistantResult.data);
          }

          if (usageResult.data) {
            const totalSeconds = usageResult.data.reduce(
              (sum, log) => sum + (log.call_duration_seconds || 0),
              0
            );
            const totalMinutes = Math.ceil(totalSeconds / 60);
            dlog("Usage stats computed", totalMinutes, "minutes");
            setUsageStats({
              minutesUsed: totalMinutes,
              minutesLimit: accountData.monthly_minutes_limit || 150
            });
          }
        }
      } else {
        dlog("No profile data returned for user", user.id);
      }
    } catch (error) {
      dlog("Error loading account data", error);
      toast.error("Failed to load account information");
      setAuthStatus("error");
      setStatusMessage("We couldn't load your account data. Please try again.");
      setLastAuthError(error);
      return;
    } finally {
      if (user) {
        dlog("Auth check complete with active session", user.id);
        setAuthStatus("ready");
        setStatusMessage("Session verified");
      }
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      dlog("Auth state change", event, session?.user?.id);
      if (session?.user) {
        checkAuth();
        return;
      }

      if (event === "SIGNED_OUT" || !session?.user) {
        dlog("Auth state indicates signed out, staying on onboarding");
        setAuthStatus("signed-out");
        setStatusMessage("You're signed out. Please log in again to continue.");
      }
    });

    return () => {
      dlog("Cleaning up auth state subscription");
      subscription.unsubscribe();
    };
  }, [checkAuth]);

  // Show setup form if account needs provisioning
  useEffect(() => {
    if (account && (!phoneNumber || account.provisioning_status === 'pending' || account.provisioning_status === 'provisioning')) {
      setShowSetupForm(true);
      dlog("Showing setup form - account exists and needs provisioning", account.provisioning_status);
    } else {
      setShowSetupForm(false);
      if (account) {
        dlog("Account ready - provisioning status", account.provisioning_status);
      }
    }
  }, [account, phoneNumber]);

  const handleSetupComplete = async () => {
    dlog("Setup completed by user - beginning provisioning poll");
    setShowSetupForm(false);
    toast.success("Setup complete! Provisioning your resources...");

    // Poll for provisioning completion (faster 3s polling)
    const pollInterval = setInterval(async () => {
      dlog("Polling provisioning status", account?.id);
      const { data: updatedAccount } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', account?.id)
        .single();

      if (updatedAccount?.provisioning_status === 'completed' || updatedAccount?.provisioning_status === 'active') {
        clearInterval(pollInterval);
        dlog("Provisioning completed", updatedAccount.id);
        toast.success("Your account is ready!");
        await checkAuth(); // Refresh all data
      } else if (updatedAccount?.provisioning_status === 'failed') {
        clearInterval(pollInterval);
        dlog("Provisioning failed", updatedAccount?.id);
        toast.error("Provisioning failed. Please contact support.");
      }
    }, 3000); // Poll every 3 seconds (faster)

    // Stop polling after 2 minutes
    setTimeout(() => clearInterval(pollInterval), 120000);
  };

  const handleLogout = async () => {
    dlog("User initiated logout");
    try {
      await signOutUser();
    } catch (error) {
      console.error("Failed to sign out:", error);
    }
    dlog("Logout complete, navigating to home");
    navigate("/");
  };

  if (authStatus !== "ready") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-6">
        <Card className="max-w-md w-full text-center shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">{statusMessage}</CardTitle>
            <CardDescription>
              {authStatus === "checking"
                ? "Hang tight while we verify your account details."
                : authStatus === "error"
                  ? "Something went wrong while loading your information."
                  : "You're currently signed out."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {authStatus === "checking" ? (
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
            ) : (
              <UserCircle2 className="h-10 w-10 text-primary mx-auto" />
            )}
            {lastAuthError && authStatus === "error" && (
              <pre className="bg-muted rounded-md p-3 text-xs text-left whitespace-pre-wrap break-words">
                {lastAuthError instanceof Error ? lastAuthError.message : String(lastAuthError)}
              </pre>
            )}
            <div className="flex flex-col gap-2">
              {authStatus === "checking" && (
                <Button variant="outline" disabled>
                  Still verifying...
                </Button>
              )}
              {authStatus === "error" && (
                <>
                  <Button onClick={() => {
                    dlog("Retry requested from error state");
                    checkAuth();
                  }}>
                    Retry session check
                  </Button>
                  <Button variant="outline" onClick={handleLogout}>
                    Sign out
                  </Button>
                </>
              )}
              {authStatus === "signed-out" && (
                <Button onClick={handleLogout}>
                  Return to sign in
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show setup form modal if account needs provisioning
  if (account && (!phoneNumber || account.provisioning_status === 'pending' || account.provisioning_status === 'provisioning')) {
    dlog("Rendering provisioning setup form");
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

        <OnboardingWizard
          open={showSetupForm}
          onOpenChange={setShowSetupForm}
          onSuccess={handleSetupComplete}
          initialProfile={profile}
          defaultPhone={profile?.phone ?? null}
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
                  <span className="text-sm font-medium">Configuring Agent</span>
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
              Your Voice Agent is {phoneNumber ? 'ready' : 'being set up'}
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
                Test Your Voice Agent
              </CardTitle>
              <CardDescription className="text-base">
                Call your RingSnap number to hear your {assistant?.voice_gender || 'Voice'} Agent in action
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
                The call will be answered by your Voice Agent just like a real customer call
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
                onDismiss={() => { }}
              />
            )}
            <Button
              variant="gradient"
              className="w-full"
              onClick={() => {
                dlog("Navigating to dashboard from onboarding upgrade button");
                navigate('/dashboard');
              }}
            >
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
                Your Voice Agent
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold">{assistant.name || 'RingSnap Agent'}</p>
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
                Call your business line to hear your Voice Agent in action
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                The Agent will answer professionally and capture lead information automatically.
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
                Access your dashboard to personalize your Agent's behavior.
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
              <a href="mailto:support@getringsnap.com" className="text-primary hover:underline">
                support@getringsnap.com
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
