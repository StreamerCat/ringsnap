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
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

// Validation schema
const areaCodeSchema = z.object({
  areaCode: z
    .string()
    .length(3, "Area code must be exactly 3 digits")
    .regex(/^\d{3}$/, "Area code must contain only digits")
});

type AreaCodeFormData = z.infer<typeof areaCodeSchema>;

interface OnboardingNumberStepProps {
  accountId: string;
  onSuccess?: (phoneNumber: string) => void;
}

export function OnboardingNumberStep({
  accountId,
  onSuccess
}: OnboardingNumberStepProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm<AreaCodeFormData>({
    resolver: zodResolver(areaCodeSchema),
    defaultValues: {
      areaCode: ""
    }
  });

  const handleSubmit = async (data: AreaCodeFormData) => {
    setStatus("loading");
    setErrorMessage(null);

    try {
      const areaCode = data.areaCode;

      if (!areaCode || areaCode.length !== 3) {
        throw new Error("Invalid area code. Must be exactly 3 digits.");
      }

      if (!accountId) {
        console.error("[OnboardingNumberStep] CRITICAL: accountId is missing", { accountId });
        throw new Error("Account ID not found. Please refresh and try again.");
      }

      console.log("[OnboardingNumberStep] Submitting provisioning request for area code:", areaCode, "account:", accountId);

      // Fire off the provisioning request without waiting for completion
      // It will run in the background and notify via email/SMS when done
      supabase.functions.invoke("provision_number", {
        body: {
          areaCode,
          accountId
        }
      }).catch((err) => {
        console.error("[OnboardingNumberStep] Background provisioning error:", err);
        // Log but don't fail - provisioning is happening in background anyway
      });

      console.log("[OnboardingNumberStep] ✓ Provisioning initiated in background");
      setStatus("success");

      // Trigger success callback so wizard can complete
      onSuccess?.("provisioning");

    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      console.error("[OnboardingNumberStep] ✗ Error:", { message, fullError: err });

      let friendlyMsg = message;
      if (message.includes("network") || message.includes("fetch")) {
        friendlyMsg = "Network error. Please check your connection and try again.";
      } else if (message.includes("Account ID")) {
        friendlyMsg = "Account information not found. Please refresh the page and try again.";
      } else if (message.includes("area code")) {
        friendlyMsg = "Area code format is invalid. Please enter a valid 3-digit code.";
      } else if (message.length > 100) {
        friendlyMsg = "Failed to submit provisioning request. Please try again.";
      }

      console.error("[OnboardingNumberStep] Using friendly message:", friendlyMsg);
      setErrorMessage(friendlyMsg);
      setStatus("error");
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Error Alert */}
      {errorMessage && status === "error" && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Form */}
      {status !== "success" && (
        <Card>
          <CardHeader>
            <CardTitle>Your Business Phone Number</CardTitle>
            <CardDescription>
              Enter your preferred area code. We'll provision your number and notify you when it's ready.
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
                          disabled={form.formState.isSubmitting || status === "loading"}
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
                  disabled={form.formState.isSubmitting || status === "loading" || form.getValues("areaCode").length !== 3}
                  className="w-full"
                >
                  {status === "loading" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Get My Number"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Success State */}
      {status === "success" && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-900">Number Provisioning Started!</span>
              </div>
              <div className="space-y-3 text-sm text-green-700">
                <p>
                  We're setting up your business phone number in the background. This usually takes a few minutes.
                </p>
                <div className="space-y-2 rounded border border-green-200 bg-white p-3">
                  <p className="font-medium text-green-900">What happens next:</p>
                  <ul className="ml-4 space-y-1 list-disc text-green-700">
                    <li>You'll receive an email with your new phone number</li>
                    <li>You can also expect an SMS to the number on file</li>
                    <li>Your dashboard will automatically update with the number</li>
                    <li>Set up call forwarding from your business line</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default OnboardingNumberStep;
