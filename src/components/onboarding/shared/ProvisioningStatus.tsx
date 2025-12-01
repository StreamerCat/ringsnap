import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

interface ProvisioningStatusProps {
  accountId: string;
  onComplete: (phoneNumber: string) => void;
  onError?: (error: string) => void;
  showProgress?: boolean;
  pollingInterval?: number; // milliseconds
  disabled?: boolean;
}

/**
 * Shared provisioning status component
 * Uses Realtime subscriptions with polling fallback
 * Used in both self-serve and sales-guided flows
 *
 * Features:
 * - Realtime subscriptions for instant updates
 * - Polling fallback if Realtime disconnects
 * - 5-minute timeout with support contact
 *
 * @example Self-serve usage (detailed progress)
 * <ProvisioningStatus
 *   accountId={accountId}
 *   onComplete={(phoneNumber) => {
 *     setPhoneNumber(phoneNumber);
 *     setStep(8);
 *   }}
 *   showProgress={true}
 *   pollingInterval={10000}
 * />
 *
 * @example Sales usage (faster polling fallback)
 * <ProvisioningStatus
 *   accountId={accountId}
 *   onComplete={(phoneNumber) => {
 *     setPhoneNumber(phoneNumber);
 *     setStep(5);
 *   }}
 *   showProgress={true}
 *   pollingInterval={5000}
 * />
 */
export function ProvisioningStatus({
  accountId,
  onComplete,
  onError,
  showProgress = true,
  pollingInterval = 10000, // Increased default (Realtime is primary)
  disabled = false,
}: ProvisioningStatusProps) {
  const [status, setStatus] = useState<"idle" | "provisioning" | "active" | "failed">("provisioning");
  const [progress, setProgress] = useState(10);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  const TIMEOUT_SECONDS = 300; // 5 minutes

  // Handle account status updates
  const handleStatusUpdate = (
    provisioningStatus: string,
    vapiPhoneNumber: string | null,
    provisioningError: string | null
  ) => {
    setStatus(provisioningStatus as any);

    // Update progress
    if (provisioningStatus === "processing" && showProgress) {
      setProgress((prev) => Math.min(prev + 10, 60));
    } else if (provisioningStatus === "provisioning" && showProgress) {
      setProgress((prev) => Math.min(prev + 5, 70));
    }

    // Handle completion
    if (provisioningStatus === "completed" && vapiPhoneNumber) {
      setProgress(100);
      setPhoneNumber(vapiPhoneNumber);
      onComplete(vapiPhoneNumber);
    }

    // Handle active status (backward compat)
    if (provisioningStatus === "active" && vapiPhoneNumber) {
      setProgress(100);
      setPhoneNumber(vapiPhoneNumber);
      onComplete(vapiPhoneNumber);
    }

    // Handle failure
    if (provisioningStatus === "failed") {
      const errorMsg = provisioningError || "Provisioning failed. Please contact support.";
      setError(errorMsg);
      onError?.(errorMsg);
    }
  };

  // Realtime subscription + polling fallback
  useEffect(() => {
    if (disabled) return;

    let intervalId: number | null = null;
    let timeIntervalId: number | null = null;
    let timeoutId: number | null = null;

    // Initial poll
    const pollStatus = async () => {
      try {
        const { data, error: queryError } = await supabase
          .from("accounts")
          .select("provisioning_status, vapi_phone_number, provisioning_error")
          .eq("id", accountId)
          .single();

        if (queryError) throw queryError;

        handleStatusUpdate(
          data.provisioning_status,
          data.vapi_phone_number,
          data.provisioning_error
        );
      } catch (err) {
        console.error("Error polling provisioning status:", err);
        if (!realtimeConnected) {
          const errorMsg = err instanceof Error ? err.message : "Failed to check status";
          setError(errorMsg);
          onError?.(errorMsg);
        }
      }
    };

    // Set up Realtime subscription
    const channel = supabase
      .channel(`account-${accountId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "accounts",
          filter: `id=eq.${accountId}`,
        },
        (payload: any) => {
          console.log("[ProvisioningStatus] Realtime update received", payload);
          setRealtimeConnected(true);
          handleStatusUpdate(
            payload.new.provisioning_status,
            payload.new.vapi_phone_number,
            payload.new.provisioning_error
          );
        }
      )
      .subscribe((status) => {
        console.log("[ProvisioningStatus] Subscription status:", status);
        if (status === "SUBSCRIBED") {
          setRealtimeConnected(true);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeConnected(false);
          console.warn("[ProvisioningStatus] Realtime disconnected, polling fallback active");
        }
      });

    // Start polling fallback (slower interval when Realtime is active)
    intervalId = window.setInterval(pollStatus, pollingInterval);

    // Track elapsed time
    timeIntervalId = window.setInterval(() => {
      setElapsedTime((prev) => {
        const newTime = prev + 1;
        if (newTime >= TIMEOUT_SECONDS) {
          setTimedOut(true);
        }
        return newTime;
      });
    }, 1000);

    // Set timeout for provisioning
    timeoutId = window.setTimeout(() => {
      setTimedOut(true);
    }, TIMEOUT_SECONDS * 1000);

    // Initial poll
    pollStatus();

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (timeIntervalId) clearInterval(timeIntervalId);
      if (timeoutId) clearTimeout(timeoutId);
      channel.unsubscribe();
    };
  }, [accountId, pollingInterval, disabled, showProgress, onComplete, onError, realtimeConnected]);

  const handleRetry = async () => {
    setStatus("provisioning");
    setError(null);
    setProgress(10);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, phone")
        .eq("account_id", accountId)
        .single();

      const { data: account } = await supabase
        .from("accounts")
        .select("phone_number_area_code, company_name, trade, assistant_gender")
        .eq("id", accountId)
        .single();

      // Call retry endpoint (or re-invoke provision-resources)
      const { error: retryError } = await supabase.functions.invoke("provision-resources", {
        body: {
          accountId,
          email: user?.email,
          name: profile?.name,
          phone: profile?.phone,
          areaCode: account?.phone_number_area_code,
          companyName: account?.company_name,
          trade: account?.trade,
          assistantGender: account?.assistant_gender,
        },
      });

      if (retryError) throw retryError;
    } catch (err) {
      console.error("Retry failed:", err);
      setError(err instanceof Error ? err.message : "Retry failed");
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="text-center space-y-6">
      {/* Provisioning State */}
      {(status === "provisioning" || status === "processing") && !timedOut && (
        <>
          <Loader2 className="h-16 w-16 animate-spin mx-auto text-primary" />
          <div className="space-y-2">
            <h3 className="text-xl font-semibold">Creating your AI receptionist...</h3>
            <p className="text-muted-foreground">
              This typically takes 60-90 seconds
            </p>
            {showProgress && (
              <div className="space-y-2 mt-4">
                <Progress value={progress} className="w-full max-w-md mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Elapsed time: {formatTime(elapsedTime)}
                </p>
                {realtimeConnected && (
                  <p className="text-xs text-green-600">
                    ● Live updates active
                  </p>
                )}
                {!realtimeConnected && elapsedTime > 10 && (
                  <p className="text-xs text-amber-600">
                    ● Using fallback polling
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="max-w-md mx-auto">
            <Alert>
              <AlertDescription className="text-sm text-left">
                <strong>What's happening:</strong>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  <li>Provisioning your phone number</li>
                  <li>Creating your AI assistant</li>
                  <li>Configuring call routing</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
        </>
      )}

      {/* Timeout State */}
      {timedOut && status !== "active" && status !== "completed" && (
        <>
          <AlertCircle className="h-16 w-16 text-amber-500 mx-auto" />
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-amber-600">Setup is taking longer than expected</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Your account is still being set up in the background. Please check back in a few minutes, or contact support for assistance.
            </p>
          </div>
          <div className="space-y-2">
            <Button onClick={() => window.location.reload()} variant="outline" size="lg">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Page
            </Button>
            <p className="text-xs text-muted-foreground">
              Support: help@ringsnap.ai
            </p>
          </div>
        </>
      )}

      {/* Success State */}
      {(status === "active" || status === "completed") && phoneNumber && (
        <>
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-green-600">Your AI receptionist is ready!</h3>
            <p className="text-muted-foreground">
              Setup completed in {formatTime(elapsedTime)}
            </p>
          </div>
        </>
      )}

      {/* Failed State */}
      {status === "failed" && (
        <>
          <AlertCircle className="h-16 w-16 text-destructive mx-auto" />
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-destructive">Setup encountered an issue</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              {error}
            </p>
          </div>
          <Button onClick={handleRetry} variant="outline" size="lg">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry Setup
          </Button>
          <p className="text-xs text-muted-foreground">
            If the issue persists, please contact support
          </p>
        </>
      )}
    </div>
  );
}
