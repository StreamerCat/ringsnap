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
 * Polls account provisioning status and shows progress
 * Used in both self-serve and sales-guided flows
 *
 * @example Self-serve usage (detailed progress)
 * <ProvisioningStatus
 *   accountId={accountId}
 *   onComplete={(phoneNumber) => {
 *     setPhoneNumber(phoneNumber);
 *     setStep(8);
 *   }}
 *   showProgress={true}
 *   pollingInterval={3000}
 * />
 *
 * @example Sales usage (faster polling)
 * <ProvisioningStatus
 *   accountId={accountId}
 *   onComplete={(phoneNumber) => {
 *     setPhoneNumber(phoneNumber);
 *     setStep(5);
 *   }}
 *   showProgress={true}
 *   pollingInterval={2000}
 * />
 */
export function ProvisioningStatus({
  accountId,
  onComplete,
  onError,
  showProgress = true,
  pollingInterval = 3000,
  disabled = false,
}: ProvisioningStatusProps) {
  const [status, setStatus] = useState<"idle" | "provisioning" | "active" | "failed">("provisioning");
  const [progress, setProgress] = useState(10);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Poll provisioning status
  useEffect(() => {
    if (disabled) return;

    let intervalId: number;
    let timeIntervalId: number;

    const pollStatus = async () => {
      try {
        const { data, error: queryError } = await supabase
          .from("accounts")
          .select("provisioning_status, vapi_phone_number, provisioning_error")
          .eq("id", accountId)
          .single();

        if (queryError) throw queryError;

        setStatus(data.provisioning_status);

        // Update progress (simulate progress for UX)
        if (data.provisioning_status === "provisioning" && showProgress) {
          setProgress((prev) => Math.min(prev + 5, 95));
        }

        // Handle completion
        if (data.provisioning_status === "active" && data.vapi_phone_number) {
          setProgress(100);
          setPhoneNumber(data.vapi_phone_number);
          onComplete(data.vapi_phone_number);
          clearInterval(intervalId);
          clearInterval(timeIntervalId);
        }

        // Handle failure
        if (data.provisioning_status === "failed") {
          const errorMsg = data.provisioning_error || "Provisioning failed. Please contact support.";
          setError(errorMsg);
          onError?.(errorMsg);
          clearInterval(intervalId);
          clearInterval(timeIntervalId);
        }
      } catch (err) {
        console.error("Error polling provisioning status:", err);
        const errorMsg = err instanceof Error ? err.message : "Failed to check status";
        setError(errorMsg);
        onError?.(errorMsg);
        clearInterval(intervalId);
        clearInterval(timeIntervalId);
      }
    };

    // Start polling
    intervalId = window.setInterval(pollStatus, pollingInterval);

    // Track elapsed time
    timeIntervalId = window.setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    // Initial poll
    pollStatus();

    return () => {
      clearInterval(intervalId);
      clearInterval(timeIntervalId);
    };
  }, [accountId, pollingInterval, disabled, showProgress, onComplete, onError]);

  const handleRetry = async () => {
    setStatus("provisioning");
    setError(null);
    setProgress(10);

    try {
      // Call retry endpoint (or re-invoke provision-resources)
      const { error: retryError } = await supabase.functions.invoke("provision-resources", {
        body: { accountId },
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
      {status === "provisioning" && (
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

      {/* Success State */}
      {status === "active" && phoneNumber && (
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
