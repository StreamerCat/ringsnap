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
  businessDetailsSchema,
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
import { Lock, CreditCard, Shield, Check, Building2, Globe, Briefcase, AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

type TrialFormData = z.infer<typeof trialSignupSchema>;

// Extract area code from phone number (e.g., "(555) 123-4567" -> "555")
const extractAreaCodeFromPhone = (phoneNumber: string): string => {
  const digits = phoneNumber.replace(/\D/g, '');
  return digits.slice(0, 3);
};

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
      areaCode: "",
      companyName: "",
      companyWebsite: "",
      trade: "",
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

  // Watch for planType changes
  useEffect(() => {
    const subscription = watch((value, { name }) => {
      if (name === 'planType') {
        console.log("📋 planType changed to:", value.planType);
      }
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  const validateStep = async (step: number): Promise<boolean> => {
    switch (step) {
      case 1: {
        const leadResult = await form.trigger(['name', 'email', 'phone']);
        return leadResult;
      }
      case 2: {
        const businessResult = await form.trigger(['companyName', 'companyWebsite', 'trade']);
        return businessResult;
      }
      case 3: {
        const currentPlanType = form.getValues("planType");
        console.log("📋 Validating step 3 - planType:", currentPlanType);
        return !!currentPlanType && ['starter', 'professional', 'premium'].includes(currentPlanType);
      }
      case 4:
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

    // Validate required fields before proceeding
    const formValues = form.getValues();
    if (!formValues.planType) {
      toast.error("Please select a plan");
      console.error("❌ Missing planType");
      setCurrentStep(3); // Go back to plan selection
      return;
    }

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

      // Extract area code from phone number
      const phoneNumber = form.getValues("phone");
      const extractedAreaCode = extractAreaCodeFromPhone(phoneNumber);

      // Prepare request body
      const requestBody = {
        ...form.getValues(),
        areaCode: extractedAreaCode, // Use extracted area code from phone number
        paymentMethodId: paymentMethod.id,
        source,
      };

      // DETAILED LOGGING FOR DEBUGGING
      console.log("📞 Calling edge function with request body:");
      console.log("  - name:", requestBody.name);
      console.log("  - email:", requestBody.email);
      console.log("  - phone:", requestBody.phone);
      console.log("  - areaCode:", requestBody.areaCode);
      console.log("  - companyName:", requestBody.companyName);
      console.log("  - planType:", requestBody.planType, "(type:", typeof requestBody.planType, ")");
      console.log("  - paymentMethodId:", requestBody.paymentMethodId);
      console.log("  - acceptTerms:", requestBody.acceptTerms);
      console.log("  - source:", requestBody.source);

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
        // For 422 errors (email/data already exists)
        else if (statusCode === 422) {
          // Try to get specific error from body
          if (error.context?.body) {
            try {
              const errorBody = typeof error.context.body === 'string'
                ? JSON.parse(error.context.body)
                : error.context.body;

              if (errorBody.error) {
                errorMessage = errorBody.error;
              }
            } catch (e) {
              // Parsing failed, use default message
            }
          }
          // Customize message for email already registered
          if (errorMessage.includes("email") || errorMessage.includes("already been registered")) {
            errorMessage = "An account with this email already exists. Please sign in or use a different email address.";
          } else {
            errorMessage = "This information is already registered. Please try different details or contact support.";
          }
        }
        // For 400 errors (validation)
        else if (statusCode === 400 && error.context?.body) {
          try {
            let errorBody;

            // Handle ReadableStream
            if (error.context.body instanceof ReadableStream) {
              const reader = error.context.body.getReader();
              const decoder = new TextDecoder();
              let bodyText = '';

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                bodyText += decoder.decode(value, { stream: true });
              }

              errorBody = JSON.parse(bodyText);
            }
            // Handle string
            else if (typeof error.context.body === 'string') {
              errorBody = JSON.parse(error.context.body);
            }
            // Handle already parsed object
            else {
              errorBody = error.context.body;
            }

            console.error("❌ Parsed 400 error body:", errorBody);

            if (errorBody.error) {
              errorMessage = errorBody.error;
            } else if (errorBody.details) {
              // Format Zod validation errors
              const details = Array.isArray(errorBody.details)
                ? errorBody.details.map((d: any) => `${d.path?.join('.')}: ${d.message}`).join(', ')
                : JSON.stringify(errorBody.details);
              errorMessage = `Validation error: ${details}`;
            }
          } catch (e) {
            console.error("Failed to parse 400 error body:", e);
            errorMessage = "Invalid form data. Please check all fields and try again.";
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
        if (errorMessage.includes("planType") || errorMessage.includes("plan")) {
          errorMessage = "Please select a valid plan. Go back to step 3 and choose your plan.";
          setCurrentStep(3); // Navigate back to plan selection
        }
        else if (errorMessage.includes("paymentMethodId") || errorMessage.includes("payment method")) {
          errorMessage = "Payment method is missing. Please re-enter your card details.";
        }
        else if (errorMessage.includes("email") && (errorMessage.includes("already") || errorMessage.includes("registered") || errorMessage.includes("exists"))) {
          errorMessage = "An account with this email already exists. Please sign in or use a different email address.";
        }
        else if (errorMessage.includes("phone number") || errorMessage.includes("Phone number")) {
          errorMessage = "This phone number was recently used for a trial. Please use a different number or contact support.";
        }
        else if (errorMessage.includes("disposable") || errorMessage.includes("valid business or personal email")) {
          errorMessage = "Please use a valid business or personal email address.";
        }
        else if (errorMessage.includes("payment") || errorMessage.includes("card")) {
          errorMessage = "Payment method validation failed. Please check your card details and try again.";
        }
        else if (errorMessage.includes("subscription")) {
          errorMessage = "Failed to create your subscription. Please try again or contact support.";
        }
        else if (errorMessage.includes("timeout") || errorMessage.includes("network")) {
          errorMessage = "Connection timeout. Please check your internet and try again.";
        }
        else if (errorMessage.includes("Invalid input data")) {
          errorMessage = "Some form fields are invalid. Please review and try again.";
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
                ✓ 3-day free trial • ✓ No setup fees
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
            </div>

            <SignupButton type="submit" className="w-full">
              Continue
            </SignupButton>
          </form>
        );

      case 2:
        return (
          <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Tell Us About Your Business</h2>
              <p className="text-sm text-muted-foreground">
                This helps personalize your AI assistant
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName" className="flex items-center gap-2 text-sm font-medium">
                  <Building2 className="h-4 w-4 text-primary" />
                  Company Name
                </Label>
                <SignupInput
                  label=""
                  id="companyName"
                  placeholder="ABC Plumbing"
                  {...form.register("companyName")}
                  error={errors.companyName?.message}
                  isValid={!!watch("companyName") && !errors.companyName}
                  showValidation={false}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyWebsite" className="flex items-center gap-2 text-sm font-medium">
                  <Globe className="h-4 w-4 text-primary" />
                  Company Website <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <SignupInput
                  label=""
                  id="companyWebsite"
                  type="url"
                  placeholder="https://yourcompany.com"
                  {...form.register("companyWebsite")}
                  error={errors.companyWebsite?.message}
                  showValidation={false}
                />
                <p className="text-xs text-muted-foreground">
                  Helps your assistant provide accurate service information
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="trade" className="flex items-center gap-2 text-sm font-medium">
                  <Briefcase className="h-4 w-4 text-primary" />
                  Trade/Industry
                </Label>
                <Select
                  value={watch("trade")}
                  onValueChange={(value) => setValue("trade", value)}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select your trade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="plumbing">Plumbing</SelectItem>
                    <SelectItem value="hvac">HVAC</SelectItem>
                    <SelectItem value="electrical">Electrical</SelectItem>
                    <SelectItem value="roofing">Roofing</SelectItem>
                    <SelectItem value="general_contractor">General Contractor</SelectItem>
                    <SelectItem value="carpentry">Carpentry</SelectItem>
                    <SelectItem value="painting">Painting</SelectItem>
                    <SelectItem value="landscaping">Landscaping</SelectItem>
                    <SelectItem value="pest_control">Pest Control</SelectItem>
                    <SelectItem value="garage_door">Garage Door Repair</SelectItem>
                    <SelectItem value="appliance_repair">Appliance Repair</SelectItem>
                    <SelectItem value="restaurant">Restaurant</SelectItem>
                    <SelectItem value="local_services">Local Services</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {errors.trade && (
                  <p className="text-sm text-red-500">{errors.trade.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <SignupButton type="submit" className="w-full">
                Continue
              </SignupButton>
              <SignupButton
                type="button"
                onClick={handleBack}
                variant="outline"
                className="w-full"
              >
                Back
              </SignupButton>
            </div>
          </form>
        );

      case 3:
        return (
          <PlanSelectionStep
            selectedPlan={planType || null}
            onSelectPlan={(plan) => {
              console.log("✅ Plan selected:", plan);
              setValue("planType", plan as any);
              // Give setValue time to update, then validate
              setTimeout(async () => {
                const isValid = await validateStep(3);
                if (isValid) {
                  handleNext();
                } else {
                  toast.error("Failed to set plan. Please try again.");
                }
              }, 100);
            }}
            isTrial={true}
          />
        );

      case 4:
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
            Complete the {currentStep === 1 ? "contact information" : currentStep === 2 ? "business details" : currentStep === 3 ? "plan selection" : "payment details"} to start your 3-day free trial
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Step {currentStep} of 4</span>
            <span>{Math.round((currentStep / 4) * 100)}%</span>
          </div>
          <Progress value={(currentStep / 4) * 100} />
        </div>

        {renderStep()}
      </DialogContent>
    </Dialog>
  );
};
