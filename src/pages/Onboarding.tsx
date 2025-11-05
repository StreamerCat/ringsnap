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
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type AccountRow = Database["public"]["Tables"]["accounts"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ProfileWithAccount = ProfileRow & { accounts?: AccountRow | null };

export default function Onboarding() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileWithAccount | null>(null);
  const [account, setAccount] = useState<AccountRow | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [assistant, setAssistant] = useState<any | null>(null);
  const [usageStats, setUsageStats] = useState({ minutesUsed: 0, minutesLimit: 150 });
  const [showSetupForm, setShowSetupForm] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        navigate("/");
        return;
      }

      if (!user.email) {
        navigate("/");
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*, accounts:account_id(*)")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
        toast.error("Failed to load account information");
        return;
      }

      if (profileData) {
        const typedData = profileData as ProfileWithAccount;
        setProfile(typedData);
        const accountData = typedData.accounts ?? null;
        setAccount(accountData);

        // Fetch additional data in parallel
        if (accountData?.id) {
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
            setPhoneNumber(phoneResult.data.phone_number);
          }

          if (assistantResult.data) {
            setAssistant(assistantResult.data);
          }

          if (usageResult.data) {
            const totalSeconds = usageResult.data.reduce(
              (sum, log) => sum + (log.call_duration_seconds || 0),
              0
            );
            const totalMinutes = Math.ceil(totalSeconds / 60);
            setUsageStats({
              minutesUsed: totalMinutes,
              minutesLimit: accountData.monthly_minutes_limit || 150
            });
          }
        }
      }
    } catch (error) {
      console.error("Error loading account:", error);
      toast.error("Failed to load account information");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    checkAuth();
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
    
    // Poll for provisioning completion
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
    }, 5000); // Poll every 5 seconds

    // Stop polling after 2 minutes
    setTimeout(() => clearInterval(pollInterval), 120000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) {
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

  // Show loading state if provisioning
  if (account?.provisioning_status === 'provisioning') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted py-12 px-4">
        <div className="max-w-2xl mx-auto text-center space-y-8">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <h1 className="text-4xl font-bold">Setting Up Your Account</h1>
          <p className="text-xl text-muted-foreground">
            We're provisioning your phone number and AI assistant. This usually takes 1-2 minutes.
          </p>
          <Card className="bg-muted">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                You'll be automatically redirected when setup is complete.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const trialDaysRemaining = account?.trial_end_date
    ? Math.ceil((new Date(account.trial_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 3;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Check className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold">
            Welcome to RingSnap{profile?.name ? `, ${profile.name}!` : ""}
          </h1>
          <p className="text-xl text-muted-foreground">
            {account?.company_name
              ? `Your account is being set up for ${account.company_name}`
              : "Your account is being prepared."
            }
          </p>
          <div className="inline-block bg-primary/10 text-primary px-4 py-2 rounded-full font-semibold">
            {trialDaysRemaining} days remaining in your trial
          </div>
        </div>

        {/* Phone Number Card */}
        {phoneNumber && (
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-primary" />
                Your RingSnap Number
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold tracking-tight">
                  {phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3")}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(phoneNumber);
                    toast.success("Phone number copied to clipboard!");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={account?.provisioning_status === 'completed' ? 'default' : 'secondary'}>
                  {account?.provisioning_status || 'pending'}
                </Badge>
                {account?.phone_number_area_code && (
                  <Badge variant="outline">Area: {account.phone_number_area_code}</Badge>
                )}
              </div>
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
