import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useStripe, useElements, CardElement } from "@stripe/react-stripe-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SignupInput } from "./shared/SignupInput";
import { SignupButton } from "./shared/SignupButton";
import { PlanSelectionStep } from "./shared/PlanSelectionStep";
import {
  leadCaptureSchema,
  planSelectionSchema,
  paymentSchema,
  trialSignupSchema
} from "./shared/schemas";
import {
  isGenericEmail,
  formatPhoneNumber,
  validatePhoneNumber,
  extractCompanyNameFromEmail
} from "./shared/utils";
import { Lock, CreditCard, Shield, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

type TrialFormData = z.infer<typeof trialSignupSchema>;

interface TrialSignupFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source?: string;
  onSuccess?: (data: any) => void;
}

export const TrialSignupFlow = ({
  open,
  onOpenChange,
  source = 'website',
  onSuccess
}: TrialSignupFlowProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [showCompanyName, setShowCompanyName] = useState(false);

  const stripe = useStripe();
  const elements = useElements();

  const form = useForm<TrialFormData>({
    resolver: zodResolver(trialSignupSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      companyName: "",
      planType: undefined,
      acceptTerms: false,
    },
  });

  const { watch, setValue, formState: { errors } } = form;
  const email = watch("email");
  const phone = watch("phone");
  const planType = watch("planType");

  // Auto-detect company name from email
  useEffect(() => {
    if (email && isGenericEmail(email)) {
      setShowCompanyName(true);
    } else if (email) {
      setShowCompanyName(false);
      const companyName = extractCompanyNameFromEmail(email);
      setValue("companyName", companyName);
    }
  }, [email, setValue]);

  // Format phone as user types
  useEffect(() => {
    if (phone) {
      const formatted = formatPhoneNumber(phone);
      if (formatted !== phone) {
        setValue("phone", formatted);
      }
    }
  }, [phone, setValue]);

  const validateStep = async (step: number): Promise<boolean> => {
    switch (step) {
      case 1:
        const leadResult = await form.trigger(['name', 'email', 'phone', 'companyName']);
        return leadResult;
      case 2:
        return !!planType;
      case 3:
        return cardComplete && form.getValues("acceptTerms");
      default:
        return false;
    }
  };

  const handleNext = async (skipValidation = false) => {
    if (!skipValidation) {
      const isValid = await validateStep(currentStep);
      if (!isValid) {
        toast.error("Please complete all required fields");
        return;
      }
    }
    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(1, prev - 1));
  };

  const handleSubmit = async () => {
    console.log("🚀 Starting trial signup submission...");

    if (!stripe || !elements || !cardComplete) {
      toast.error("Payment information incomplete");
      console.error("❌ Missing Stripe elements or card incomplete");
      return;
    }

    setIsSubmitting(true);

    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) throw new Error("Card element not found");

      console.log("💳 Creating Stripe payment method...");

      // Create payment method
      const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
        billing_details: {
          name: form.getValues("name"),
          email: form.getValues("email"),
          phone: form.getValues("phone"),
        },
      });

      if (stripeError) {
        console.error("❌ Stripe error:", stripeError);
        setCardError(stripeError.message || "Payment method creation failed");
        toast.error(stripeError.message || "Payment failed");
        return;
      }

      console.log("✅ Payment method created:", paymentMethod.id);

      // Prepare request body
      const requestBody = {
        ...form.getValues(),
        paymentMethodId: paymentMethod.id,
        source,
      };

      console.log("📞 Calling edge function with full body:", requestBody);
      console.log("📞 Form values:", form.getValues());

      // Call edge function
      const { data, error } = await supabase.functions.invoke('free-trial-signup', {
        body: requestBody,
      });

      console.log("📦 Edge function response:", { data, error });

      // Handle error response
      if (error) {
        console.error("❌ Edge function error:", error);

        // Log full error object for debugging
        try {
          console.error("❌ Error stringified:", JSON.stringify(error, null, 2));
        } catch (e) {
          console.error("❌ Could not stringify error");
        }

        console.error("❌ Error details:", {
          message: error.message,
          context: error.context,
          status: error.context?.status,
          body: error.context?.body
        });

        // Extract error message from various possible formats
        let errorMessage = "Signup failed. Please try again.";

        // Check HTTP status code
        const statusCode = error.context?.status;

        // For 429 errors (rate limiting)
        if (statusCode === 429) {
          errorMessage = "Trial limit reached. You can only create 3 trials per location in 30 days. Contact support@getringsnap.com for assistance.";
        }
        // For 400 errors (validation)
        else if (statusCode === 400 && error.context?.body) {
          try {
            const errorBody = typeof error.context.body === 'string'
              ? JSON.parse(error.context.body)
              : error.context.body;

            console.error("❌ Parsed 400 error body:", errorBody);

            if (errorBody.error) {
              errorMessage = errorBody.error;
            } else if (errorBody.details) {
              errorMessage = `Validation error: ${JSON.stringify(errorBody.details)}`;
            } else if (typeof errorBody === 'string') {
              errorMessage = errorBody;
            }
          } catch (e) {
            console.error("Failed to parse 400 error body:", e);
            if (typeof error.context.body === 'string') {
              errorMessage = error.context.body;
            }
          }
        }
        // Try to parse error from response body for other status codes
        else if (error.context?.body) {
          try {
            const errorBody = typeof error.context.body === 'string'
              ? JSON.parse(error.context.body)
              : error.context.body;

            console.error("❌ Parsed error body:", errorBody);

            if (errorBody.error) {
              errorMessage = errorBody.error;
            } else if (typeof errorBody === 'string') {
              errorMessage = errorBody;
            }
          } catch (e) {
            console.warn("Failed to parse error body:", e);
            // If parsing fails, check if body is a string
            if (typeof error.context.body === 'string' && error.context.body.length < 500) {
              errorMessage = error.context.body;
            }
          }
        }
        // Fallback to error message
        else if (error.message && !error.message.includes("non-2xx")) {
          errorMessage = error.message;
        }

        // Additional customization based on error content
        if (errorMessage.includes("phone number") || errorMessage.includes("Phone number")) {
          errorMessage = "This phone number was recently used for a trial. Please use a different number or contact support.";
        } else if (errorMessage.includes("disposable") || errorMessage.includes("valid business or personal email")) {
          errorMessage = "Please use a valid business or personal email address.";
        }

        console.error("❌ Final error message:", errorMessage);
        toast.error(errorMessage, { duration: 6000 });
        throw new Error(errorMessage);
      }

      // Success - validate we have data
      if (!data || !data.email) {
        console.error("❌ Missing data from signup:", data);
        toast.error("Signup completed but missing confirmation data. Please contact support.");
        throw new Error("Invalid response from server");
      }

      console.log("✅ Trial signup successful! User:", data.email);
      console.log("📦 Signup response data:", {
        email: data.email,
        hasPassword: !!data.password,
        accountId: data.account_id,
        stripeCustomerId: data.stripe_customer_id
      });

      // Auto-login the user with the returned credentials
      if (data.password) {
        console.log("🔐 Auto-logging in user...");
        try {
          const { data: authData, error: loginError } = await supabase.auth.signInWithPassword({
            email: data.email,
            password: data.password,
          });

          if (loginError) {
            console.error("❌ Auto-login failed:", loginError);
            toast.warning("Account created! Please check your email for login instructions.", { duration: 6000 });
          } else {
            console.log("✅ Auto-login successful! Session:", authData.session ? "active" : "none");
            toast.success("Welcome! Redirecting to your dashboard...", { duration: 3000 });
          }
        } catch (loginErr) {
          console.error("❌ Login error:", loginErr);
          toast.warning("Account created! Please check your email for login instructions.", { duration: 6000 });
        }
      } else {
        console.warn("⚠️ No password in response - cannot auto-login");
        toast.warning("Account created! Please check your email for login instructions.", { duration: 6000 });
      }

      // Redirect to dashboard or confirmation page
      console.log("🔄 Redirecting in 1.5 seconds...");
      setTimeout(() => {
        if (onSuccess) {
          console.log("✅ Calling onSuccess callback");
          onSuccess(data);
        } else {
          // If logged in, go to dashboard; otherwise go to confirmation page
          const redirectUrl = data.password
            ? `/dashboard`
            : `/trial-confirmation?email=${encodeURIComponent(data.email)}&password=${encodeURIComponent(data.password || '')}`;
          console.log("✅ Navigating to:", redirectUrl);
          window.location.href = redirectUrl;
        }
      }, 1500);

    } catch (error: any) {
      console.error("❌ Trial signup error:", error);
      // Error already displayed via toast above
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Start Your Free Trial</h2>
              <p className="text-sm text-muted-foreground">
                Join 500+ contractors catching every call
              </p>
              <p className="text-xs text-green-600">
                ✓ No credit card required yet • ✓ 3-day free trial
              </p>
            </div>

            <div className="space-y-4">
              <SignupInput
                label="Full Name"
                id="name"
                {...form.register("name")}
                error={errors.name?.message}
                isValid={!!watch("name") && !errors.name}
              />

              <SignupInput
                label="Email Address"
                id="email"
                type="email"
                {...form.register("email")}
                error={errors.email?.message}
                isValid={!!watch("email") && !errors.email}
              />

              <SignupInput
                label="Phone Number"
                id="phone"
                type="tel"
                placeholder="(555) 555-5555"
                {...form.register("phone")}
                error={errors.phone?.message}
                isValid={!!watch("phone") && !errors.phone}
              />

              {showCompanyName && (
                <SignupInput
                  label="Company Name"
                  id="companyName"
                  {...form.register("companyName")}
                  error={errors.companyName?.message}
                />
              )}
            </div>

            <SignupButton type="submit" className="w-full">
              Continue
            </SignupButton>
          </form>
        );

      case 2:
        return (
          <PlanSelectionStep
            selectedPlan={planType || null}
            onSelectPlan={(plan) => {
              setValue("planType", plan as any);
              setTimeout(() => handleNext(true), 300);
            }}
            isTrial={true}
          />
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Secure Payment</h2>
              <p className="text-sm text-muted-foreground">
                $0 due today • First charge in 3 days
              </p>
            </div>

            {/* Trust Signals */}
            <div className="flex justify-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Lock className="h-3 w-3" />
                256-bit SSL
              </div>
              <div className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                PCI Compliant
              </div>
              <div className="flex items-center gap-1">
                <CreditCard className="h-3 w-3" />
                Secure Payment
              </div>
            </div>

            {/* Order Summary */}
            <Card className="bg-muted/50">
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Plan:</span>
                  <span className="font-semibold capitalize">{planType}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Due Today:</span>
                  <span className="font-bold text-green-600">$0.00</span>
                </div>
                <p className="text-xs text-muted-foreground pt-2 border-t">
                  First charge on {new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>

            {/* Card Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Card Information</label>
              <div className="border rounded-md p-3">
                <CardElement
                  options={{
                    style: {
                      base: {
                        fontSize: '16px',
                        color: '#424770',
                        '::placeholder': {
                          color: '#aab7c4',
                        },
                      },
                      invalid: {
                        color: '#9e2146',
                      },
                    },
                  }}
                  onChange={(e) => {
                    setCardComplete(e.complete);
                    setCardError(e.error?.message || null);
                  }}
                />
              </div>
              {cardError && (
                <p className="text-sm text-red-500">{cardError}</p>
              )}
            </div>

            {/* Terms Checkbox */}
            <div className="flex items-start gap-2">
              <Checkbox
                id="terms"
                checked={form.watch("acceptTerms")}
                onCheckedChange={(checked) => setValue("acceptTerms", !!checked)}
              />
              <label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer">
                I agree to the Terms of Service and understand my card will be charged after the 3-day trial
              </label>
            </div>

            <div className="space-y-2">
              <SignupButton
                onClick={handleSubmit}
                isLoading={isSubmitting}
                disabled={isSubmitting || !cardComplete || !form.watch("acceptTerms")}
                className="w-full"
              >
                {isSubmitting ? "Processing..." : "Start My Free Trial"}
              </SignupButton>
              <SignupButton
                type="button"
                onClick={handleBack}
                variant="outline"
                className="w-full"
                disabled={isSubmitting}
              >
                Back
              </SignupButton>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sign Up for Free Trial</DialogTitle>
          <DialogDescription>
            Complete the {currentStep === 1 ? "contact information" : currentStep === 2 ? "plan selection" : "payment details"} to start your 3-day free trial
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Step {currentStep} of 3</span>
            <span>{Math.round((currentStep / 3) * 100)}%</span>
          </div>
          <Progress value={(currentStep / 3) * 100} />
        </div>

        {renderStep()}
      </DialogContent>
    </Dialog>
  );
};
