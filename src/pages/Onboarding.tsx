import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Loader2, Phone, Settings, TestTube } from "lucide-react";
import { toast } from "sonner";

export default function Onboarding() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [account, setAccount] = useState<any>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/");
        return;
      }

      // Fetch user profile and account data
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*, accounts(*)")
        .eq("id", user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        setAccount(profileData.accounts);
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      toast.error("Failed to load account information");
    } finally {
      setLoading(false);
    }
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
          <h1 className="text-4xl font-bold">Welcome to RingSnap{profile?.is_primary ? "" : `, ${profile?.name}!`}</h1>
          <p className="text-xl text-muted-foreground">
            {profile?.is_primary 
              ? `Your account is being set up for ${account?.company_name}`
              : `You've joined ${account?.company_name}'s account`
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
                Your dedicated number will be sent to {profile?.email} within the next few minutes.
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
                <p className="font-semibold text-muted-foreground">Company</p>
                <p className="text-lg">{account?.company_name}</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground">Trade</p>
                <p className="text-lg">{account?.trade || "Not specified"}</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground">Name</p>
                <p className="text-lg">{profile?.name}</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground">Phone</p>
                <p className="text-lg">{profile?.phone}</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground">Email</p>
                <p className="text-lg">{profile?.id}</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground">Role</p>
                <p className="text-lg capitalize">{profile?.is_primary ? "Owner" : "User"}</p>
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
