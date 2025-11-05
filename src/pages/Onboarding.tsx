import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Loader2, Phone, Settings, TestTube } from "lucide-react";
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
        setAccount(typedData.accounts ?? null);
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

        {/* Next Steps */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <Phone className="h-8 w-8 text-primary mb-2" />
              <CardTitle>1. Forward Your Phone</CardTitle>
              <CardDescription>
                Set up call forwarding from your business line to your RingSnap number
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Your dedicated number will be sent to you within the next few minutes.
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
            <CardContent>
              <p className="text-sm text-muted-foreground">
                The AI will answer professionally and capture lead information automatically.
              </p>
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
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Access your dashboard to personalize your AI assistant's behavior.
              </p>
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
          <Button size="lg" onClick={() => window.location.href = "/"}>
            Return to Homepage
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
