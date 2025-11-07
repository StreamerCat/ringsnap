import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

// Validation schema
const areaCodeSchema = z.object({
  areaCode: z
    .string()
    .length(3, "Area code must be exactly 3 digits")
    .regex(/^\d{3}$/, "Area code must contain only digits")
});

type AreaCodeFormData = z.infer<typeof areaCodeSchema>;

type ProvisionStatus = "idle" | "loading" | "success" | "pending" | "error";

interface OnboardingNumberStepProps {
  accountId: string;
  onSuccess?: (phoneNumber: string) => void;
  onPending?: () => void;
}

export function OnboardingNumberStep({
  accountId,
  onSuccess,
  onPending
}: OnboardingNumberStepProps) {
  const [status, setStatus] = useState<ProvisionStatus>("idle");
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [phoneId, setPhoneId] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm<AreaCodeFormData>({
    resolver: zodResolver(areaCodeSchema),
    defaultValues: {
      areaCode: ""
    }
  });

  const handleSubmit = async (data: AreaCodeFormData) => {
    await provisionNumber(data.areaCode);
  };

  const provisionNumber = async (areaCode: string) => {
    setStatus("loading");
    setErrorMessage(null);

    try {
      console.log("[OnboardingNumberStep] Starting provisioning for area code:", areaCode, "account:", accountId);

      const { data, error } = await supabase.functions.invoke("provision_number", {
        body: {
          areaCode,
          accountId
        }
      });

      console.log("[OnboardingNumberStep] Response received:", { data, error });

      if (error) {
        const errorMsg = error.message || "Failed to provision number";
        console.error("[OnboardingNumberStep] Function error:", errorMsg);
        throw new Error(errorMsg);
      }

      if (!data) {
        throw new Error("No response from provisioning service");
      }

      // Handle success - number is immediately active
      if (data.status === "active" && data.number) {
        console.log("[OnboardingNumberStep] Number activated:", data.number);
        setPhoneNumber(data.number);
        setPhoneId(data.phoneId);
        setStatus("success");
        setErrorMessage(null);
        onSuccess?.(data.number);
      }
      // Handle pending - number will be ready soon
      else if (data.status === "pending") {
        console.log("[OnboardingNumberStep] Number provisioning in background");
        setPhoneNumber(data.number || null);
        setPhoneId(data.phoneId || null);
        setStatus("pending");
        setErrorMessage(null);
        onPending?.();
      }
      // Handle error response from the function
      else if (data.status === "failed" || data.error) {
        const errorMsg = data.error || "Phone provisioning failed";
        console.error("[OnboardingNumberStep] Provisioning failed:", errorMsg);

        let friendlyMsg = errorMsg;
        if (errorMsg.includes("Invalid area code")) {
          friendlyMsg = "The area code is invalid. Please enter a valid 3-digit area code (e.g., 303).";
        } else if (errorMsg.includes("not available") || errorMsg.includes("exhausted")) {
          friendlyMsg = "This area code is not currently available. Try nearby codes like 720, 970, or 719.";
        } else if (errorMsg.includes("VAPI") || errorMsg.includes("api")) {
          friendlyMsg = "Unable to connect to provisioning service. Please try again in a moment.";
        }

        setErrorMessage(friendlyMsg);
        setStatus("error");
      } else {
        console.error("[OnboardingNumberStep] Unexpected response status:", data.status);
        throw new Error("Unexpected response from provisioning service");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred";
      console.error("[OnboardingNumberStep] Provisioning error:", message, err);

      let friendlyMsg = message;
      if (message.includes("network") || message.includes("fetch")) {
        friendlyMsg = "Network error. Please check your connection and try again.";
      } else if (message.includes("timeout")) {
        friendlyMsg = "Request timed out. Please try again.";
      } else if (!message.includes("area code") && message.length > 100) {
        friendlyMsg = "Failed to provision number. Please try again.";
      }

      setErrorMessage(friendlyMsg);
      setStatus("error");
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    await provisionNumber(form.getValues("areaCode"));
    setIsRetrying(false);
  };

  const handleReset = () => {
    setStatus("idle");
    setPhoneNumber(null);
    setPhoneId(null);
    setErrorMessage(null);
    form.reset();
  };

  return (
    <div className="w-full space-y-6">
      {/* Error Alert - Show at top on all states except success/pending */}
      {errorMessage && status !== "success" && status !== "pending" && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Provisioning Failed</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Form - Show when idle or error */}
      {(status === "idle" || status === "error") && (
        <Card>
          <CardHeader>
            <CardTitle>Get your local phone number</CardTitle>
            <CardDescription>
              Enter your preferred area code to provision a number for RingSnap.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="areaCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Area Code</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="text"
                          inputMode="numeric"
                          placeholder="e.g., 303"
                          maxLength={3}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, "").slice(0, 3);
                            field.onChange(value);
                          }}
                          disabled={form.formState.isSubmitting}
                          className="font-mono text-lg text-center"
                        />
                      </FormControl>
                      <FormDescription>
                        Enter the 3-digit area code you prefer (e.g., 303, 720, 970)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting || form.getValues("areaCode").length !== 3}
                  className="w-full"
                >
                  {form.formState.isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Provisioning...
                    </>
                  ) : (
                    "Get Number"
                  )}
                </Button>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    💡 Tip: If your preferred area code is not available, try nearby codes like 720,
                    970, or 719 (for Colorado).
                  </AlertDescription>
                </Alert>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {status === "loading" && (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      )}

      {/* Success State */}
      {status === "success" && phoneNumber && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-900">Number Ready!</span>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-green-700">Your new RingSnap number:</p>
                <p className="font-mono text-2xl font-bold text-green-900">{phoneNumber}</p>
              </div>
              <p className="text-sm text-green-700">
                You can now forward calls to your RingSnap workspace. Check your email for
                setup instructions.
              </p>
              <Button onClick={handleReset} variant="outline" className="w-full">
                Provision Another Number
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending State */}
      {status === "pending" && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-blue-600 animate-pulse" />
                <span className="font-medium text-blue-900">Number Provisioning</span>
              </div>
              <p className="text-sm text-blue-700">
                Your phone number is being set up. This usually takes a few minutes. We're
                finishing the setup in the background.
              </p>
              <div className="space-y-2 rounded border border-blue-100 bg-white p-3">
                <p className="text-xs font-medium text-blue-900">What happens next:</p>
                <ul className="ml-4 space-y-1 text-xs text-blue-700 list-disc">
                  <li>We'll send you an email and SMS when your number is ready</li>
                  <li>
                    You can close this page and return when you receive the notification
                  </li>
                  <li>Set up call forwarding in your workspace settings</li>
                </ul>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleRetry} disabled={isRetrying} variant="outline" className="flex-1">
                  {isRetrying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    "Check Status"
                  )}
                </Button>
                <Button onClick={handleReset} variant="outline" className="flex-1">
                  Continue Later
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default OnboardingNumberStep;
