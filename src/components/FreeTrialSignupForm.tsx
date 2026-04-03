import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { COMMON_AREA_CODES } from "./signup/shared/areaCodeOptions";
const formSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be less than 100 characters"),
  email: z
    .string()
    .trim()
    .email("Please enter a valid email")
    .max(255, "Email must be less than 255 characters"),
  phone: z
    .string()
    .trim()
    .min(10, "Please enter a valid phone number")
    .max(20, "Phone number is too long"),
  areaCode: z
    .string()
    .trim()
    .regex(/^\d{3}$/, "Area code must be exactly 3 digits"),
  companyName: z.string().optional()
});

type FormData = z.infer<typeof formSchema>;

interface FreeTrialSignupFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source?: string;
}

export const FreeTrialSignupForm = ({ open, onOpenChange }: FreeTrialSignupFormProps) => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [provisionedNumber, setProvisionedNumber] = useState<string | null>(null);
  const [provisionJobId, setProvisionJobId] = useState<string | null>(null);
  const [showCustomAreaCode, setShowCustomAreaCode] = useState(false);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const runIfMounted = (callback: () => void) => {
    if (isMountedRef.current) {
      callback();
    }
  };

  const waitForSession = async (maxAttempts = 10, delayMs = 300) => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.debug("FreeTrialSignupForm: Session polling error", error);
      }

      if (data?.session?.user) {
        return data.session;
      }

      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return null;
  };

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      areaCode: "",
      companyName: ""
    }
  });

  // Check if email is generic to conditionally show company field
  const emailValue = form.watch('email');
  const emailDomain = emailValue?.split('@')[1]?.toLowerCase();
  const genericDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'protonmail.com', 'mail.com'];
  const isGenericEmail = emailDomain ? genericDomains.includes(emailDomain) : false;
  const areaCodeValue = form.watch('areaCode');

  useEffect(() => {
    if (!areaCodeValue) {
      return;
    }

    const matchesPreset = COMMON_AREA_CODES.some((option) => option.code === areaCodeValue);
    setShowCustomAreaCode(!matchesPreset);
  }, [areaCodeValue]);

  const onSubmit = async (data: FormData) => {
    runIfMounted(() => setErrorMessage(null));
    runIfMounted(() => setProvisionedNumber(null));
    runIfMounted(() => setProvisionJobId(null));
    runIfMounted(() => setIsSubmitting(true));

    const payload = {
      name: data.name.trim(),
      email: data.email.trim(),
      phone: data.phone.trim(),
      areaCode: data.areaCode.trim(),
      companyName: data.companyName?.trim() ?? ""
    };

    try {
      const { data: result, error: invokeError } = await supabase.functions.invoke('free-trial-signup', {
        body: payload
      });

      if (invokeError) {
        const httpError = invokeError as FunctionsHttpError;
        const fallbackMessage = "Could not start your trial. Please try again.";
        let detailedMessage: string | null = null;

        if (httpError?.context) {
          const contextResponse = httpError.context;
          const responseForJson = typeof contextResponse.clone === "function"
            ? contextResponse.clone()
            : contextResponse;

          try {
            const errorJson = await responseForJson.json();
            if (errorJson && typeof errorJson.error === "string") {
              detailedMessage = errorJson.error.trim();
            }
          } catch (jsonError) {
            try {
              const responseForText = responseForJson === contextResponse && typeof contextResponse.clone === "function"
                ? contextResponse.clone()
                : contextResponse;
              const errorText = await responseForText.text();
              if (errorText) {
                const parsedText = (() => {
                  try {
                    const parsedJson = JSON.parse(errorText);
                    if (parsedJson && typeof parsedJson.error === "string") {
                      return parsedJson.error.trim();
                    }
                  } catch {
                    // Swallow JSON parse errors and fall back to the raw text.
                  }
                  return errorText.trim();
                })();

                if (parsedText) {
                  detailedMessage = parsedText;
                }
              }
            } catch {
              // If parsing fails, we'll fall back to the generic message below.
            }
          }
        }

        throw new Error(detailedMessage || fallbackMessage);
      }

      if (!result?.ok) {
        const errorDetails = result?.error || "Unknown error";
        throw new Error(errorDetails);
      }

      let ringSnapNumber: string | null = null;

      if (result.phone) {
        setProvisionedNumber(result.phone);
        ringSnapNumber = result.phone;
      }

      if (result.jobId) {
        runIfMounted(() => setProvisionJobId(result.jobId));
      }

      // Sign in with returned credentials for instant login when available
      if (result.email && result.password) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: result.email,
          password: result.password,
        });

        if (signInError) {
          throw new Error('Account created but failed to sign in. Please use the login page.');
        }

        const session = await waitForSession();

        if (!session) {
          throw new Error('Account created but we could not confirm your session. Please log in manually.');
        }

        console.debug("FreeTrialSignupForm: Navigating to onboarding", {
          userId: session.user.id,
          hasPhone: Boolean(result.phone),
        });
      }

      if (ringSnapNumber) {
        try {
          const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-forwarding-instructions', {
            body: {
              email: payload.email,
              phoneNumber: ringSnapNumber,
              companyName: payload.companyName || null
            }
          });

          if (emailError) {
            console.error('Forwarding instructions invocation failed:', emailError);
          } else if (!emailResult?.success) {
            console.error('Forwarding instructions returned error:', emailResult?.error);
          }
        } catch (forwardingError) {
          console.error('Forwarding instructions request threw:', forwardingError);
        }
      }

      form.reset();
      setShowCustomAreaCode(false);
      setErrorMessage(null);
      onOpenChange(false);
      navigate("/onboarding");
    } catch (error) {
      console.error("Signup submission failed:", error);
      const errorMsg = error instanceof Error ? error.message : "Could not start your trial. Please try again.";
      runIfMounted(() => setErrorMessage(errorMsg));
    } finally {
      runIfMounted(() => setIsSubmitting(false));
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isSubmitting) {
      return;
    }

    if (!nextOpen) {
      form.reset();
      setShowCustomAreaCode(false);
      setErrorMessage(null);
      setProvisionedNumber(null);
      setProvisionJobId(null);
    }

    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle
            className="text-2xl sm:text-3xl font-bold text-center"
            style={{ color: "hsl(var(--charcoal))" }}
          >
            Start Taking Every Call in 10 Minutes
          </DialogTitle>
          <p className="text-center text-sm text-muted-foreground pt-2">
            Credit card required. Won't be charged during your 3-day trial.
          </p>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            action="javascript:void(0);"
            className="space-y-4 mt-4"
            aria-live="polite"
          >
            {provisionedNumber && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                <p className="font-medium">You're all set!</p>
                <p className="mt-1">Your RingSnap assistant is reachable at <span className="font-semibold">{provisionedNumber}</span>.</p>
                {provisionJobId && (
                  <p className="mt-1 text-xs text-emerald-800">Provisioning job ID: {provisionJobId}</p>
                )}
              </div>
            )}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="John Smith"
                      {...field}
                      aria-required="true"
                      className="px-3 sm:px-4"
                    />
                  </FormControl>
                  <FormMessage className="text-xs flex items-start gap-1" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="john@smithplumbing.com"
                      {...field}
                      aria-required="true"
                      className="px-3 sm:px-4"
                    />
                  </FormControl>
                  <FormMessage className="text-xs flex items-start gap-1" />
                </FormItem>
              )}
            />

            {isGenericEmail && (
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Smith Plumbing"
                        {...field}
                        className="px-3 sm:px-4"
                      />
                    </FormControl>
                    <FormMessage className="text-xs flex items-start gap-1" />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder="(555) 123-4567"
                      {...field}
                      aria-required="true"
                      className="px-3 sm:px-4"
                    />
                  </FormControl>
                  <FormMessage className="text-xs flex items-start gap-1" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="areaCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preferred Area Code</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <Select
                        value={showCustomAreaCode ? 'custom' : field.value || undefined}
                        onValueChange={(value) => {
                          if (value === 'custom') {
                            setShowCustomAreaCode(true);
                            field.onChange('');
                          } else {
                            setShowCustomAreaCode(false);
                            field.onChange(value);
                          }
                        }}
                      >
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Select an area code" />
                        </SelectTrigger>
                        <SelectContent>
                          {COMMON_AREA_CODES.map(({ code, label }) => (
                            <SelectItem key={code} value={code}>
                              {code} — {label}
                            </SelectItem>
                          ))}
                          <SelectItem value="custom">Other area code…</SelectItem>
                        </SelectContent>
                      </Select>

                      {showCustomAreaCode && (
                        <Input
                          value={field.value}
                          onChange={(event) => {
                            const digits = event.target.value.replace(/\D/g, '').slice(0, 3);
                            field.onChange(digits);
                          }}
                          inputMode="numeric"
                          maxLength={3}
                          placeholder="Enter 3 digits"
                          aria-label="Custom area code"
                          className="px-3 sm:px-4"
                        />
                      )}
                    </div>
                  </FormControl>
                  <FormDescription className="text-xs">
                    We’ll secure a number in this area code when provisioning your trial account.
                  </FormDescription>
                  <FormMessage className="text-xs flex items-start gap-1" />
                </FormItem>
              )}
            />

            {errorMessage && (
              <p className="text-sm text-destructive text-center">{errorMessage}</p>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold rounded-full bg-primary text-white hover:opacity-90"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating Account..." : "Start Free Trial"}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              By continuing, you agree to our Terms of Service and Privacy Policy
            </p>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
