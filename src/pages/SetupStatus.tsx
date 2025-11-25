import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Phone, XCircle, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase";

export default function SetupStatus() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [onboardingStatus, setOnboardingStatus] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    checkAuth();

    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        toast.error("Please sign in to continue");
        navigate("/start");
        return;
      }

      setUserId(user.id);

      // Get profile and account
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("account_id, onboarding_status")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        toast.error("Failed to load your profile");
        return;
      }

      setAccountId(profile.account_id);
      setOnboardingStatus(profile.onboarding_status);

      // Get account details
      const { data: account, error: accountError } = await supabase
        .from("accounts")
        .select("company_name, vapi_phone_number, provisioning_stage, provisioning_status")
        .eq("id", profile.account_id)
        .single();

      if (!accountError && account) {
        setCompanyName(account.company_name || "");
        setPhoneNumber(account.vapi_phone_number);
      }

      setIsLoading(false);

      // Start polling if provisioning
      if (profile.onboarding_status === "provisioning") {
        startPolling(user.id, profile.account_id);
      }

    } catch (error) {
      console.error("Setup status error:", error);
      toast.error("Something went wrong");
      setIsLoading(false);
    }
  };

  const startPolling = (userId: string, accountId: string) => {
    const interval = setInterval(async () => {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_status")
          .eq("id", userId)
          .single();

        if (profile) {
          setOnboardingStatus(profile.onboarding_status);

          if (profile.onboarding_status === "active" || profile.onboarding_status === "provision_failed") {
            clearInterval(interval);
            setPollingInterval(null);

            // Refresh account data
            const { data: account } = await supabase
              .from("accounts")
              .select("vapi_phone_number")
              .eq("id", accountId)
              .single();

            if (account) {
              setPhoneNumber(account.vapi_phone_number);
            }
          }
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 3000); // Poll every 3 seconds

    setPollingInterval(interval);
  };

  const handleRetry = async () => {
    if (!accountId || !userId) return;

    setIsRetrying(true);

    try {
      // Update status to provisioning
      await supabase
        .from("profiles")
        .update({ onboarding_status: "provisioning" })
        .eq("id", userId);

      setOnboardingStatus("provisioning");

      // Call provision-account edge function
      const { error } = await supabase.functions.invoke("provision-account", {
        body: {
          account_id: accountId,
          user_id: userId,
          source: "trial"
        }
      });

      if (error) {
        console.error("Retry provisioning error:", error);
        toast.error("Failed to retry. Please contact support.");
      } else {
        toast.success("Retrying setup...");
        startPolling(userId, accountId);
      }
    } catch (error) {
      console.error("Retry error:", error);
      toast.error("Something went wrong");
    } finally {
      setIsRetrying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          {onboardingStatus === "provisioning" && (
            <>
              <div className="flex justify-center mb-4">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
              </div>
              <CardTitle className="text-2xl">Setting Up Your Assistant</CardTitle>
              <CardDescription>
                We're provisioning your phone number and configuring your AI assistant.
                This usually takes under a minute.
              </CardDescription>
            </>
          )}

          {onboardingStatus === "active" && (
            <>
              <div className="flex justify-center mb-4">
                <CheckCircle2 className="h-16 w-16 text-green-500" />
              </div>
              <CardTitle className="text-2xl">Your Assistant is Ready!</CardTitle>
              <CardDescription>
                {companyName && `${companyName}'s AI assistant is now active and ready to take calls.`}
              </CardDescription>
            </>
          )}

          {onboardingStatus === "provision_failed" && (
            <>
              <div className="flex justify-center mb-4">
                <XCircle className="h-16 w-16 text-destructive" />
              </div>
              <CardTitle className="text-2xl">Setup Failed</CardTitle>
              <CardDescription>
                We encountered an issue while setting up your assistant.
                This is usually temporary. Please try again.
              </CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {onboardingStatus === "provisioning" && (
            <div className="space-y-2">
              <Progress value={60} className="h-2" />
              <p className="text-sm text-muted-foreground text-center">
                Provisioning in progress...
              </p>
            </div>
          )}

          {onboardingStatus === "active" && phoneNumber && (
            <div className="bg-muted rounded-lg p-6 text-center">
              <Phone className="h-8 w-8 mx-auto mb-3 text-primary" />
              <p className="text-sm text-muted-foreground mb-2">Your AI Phone Number</p>
              <p className="text-3xl font-bold tracking-tight">
                {formatPhoneNumber(phoneNumber)}
              </p>
              <p className="text-sm text-muted-foreground mt-4">
                Share this number with your customers. Your AI assistant will answer calls 24/7.
              </p>
            </div>
          )}

          {onboardingStatus === "active" && (
            <div className="flex gap-3">
              <Button
                className="flex-1"
                onClick={() => navigate("/dashboard")}
                size="lg"
              >
                Go to Dashboard
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (phoneNumber) {
                    navigator.clipboard.writeText(phoneNumber);
                    toast.success("Phone number copied!");
                  }
                }}
                size="lg"
              >
                Copy Number
              </Button>
            </div>
          )}

          {onboardingStatus === "provision_failed" && (
            <div className="space-y-3">
              <Button
                className="w-full"
                onClick={handleRetry}
                disabled={isRetrying}
                size="lg"
              >
                {isRetrying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RotateCw className="mr-2 h-4 w-4" />
                    Retry Setup
                  </>
                )}
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                If the problem persists, please contact our support team.
              </p>
            </div>
          )}

          {onboardingStatus === "provisioning" && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                This page will automatically update when your assistant is ready.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  const match = cleaned.match(/^1?(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return phone;
}
