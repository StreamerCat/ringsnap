import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useStripe, useElements } from "@stripe/react-stripe-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft } from "lucide-react";

// Import shared atomic components
import { UserInfoForm } from "./shared/UserInfoForm";
import { BusinessBasicsForm } from "./shared/BusinessBasicsForm";
import { BusinessAdvancedForm } from "./shared/BusinessAdvancedForm";
import { VoiceSelector } from "./shared/VoiceSelector";
import { PlanSelector } from "./shared/PlanSelector";
import { PaymentForm } from "./shared/PaymentForm";
import { ProvisioningStatus } from "./shared/ProvisioningStatus";
import { PhoneReadyPanel } from "./shared/PhoneReadyPanel";

// Self-serve flow schema
const selfServeSchema = z.object({
  // Step 1: User Info
  name: z.string().min(1, "Name required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(10, "Phone required"),

  // Step 2: Business Basics
  companyName: z.string().min(1, "Company name required"),
  trade: z.string().min(1, "Trade required"),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),

  // Step 3: Business Advanced
  primaryGoal: z.enum(["book_appointments", "capture_leads", "answer_questions", "take_orders"]).optional(),
  businessHours: z.string().optional(),

  // Step 4: Voice
  assistantGender: z.enum(["male", "female"]).default("female"),

  // Step 5: Plan
  planType: z.enum(["starter", "professional", "premium"]),
});

type SelfServeFormData = z.infer<typeof selfServeSchema>;

interface SelfServeTrialFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * Self-Serve Trial Flow Orchestrator
 * 8-step conversion-optimized flow for website users
 *
 * Steps:
 * 1. User Info (name, email, phone)
 * 2. Business Basics (company, trade, website)
 * 3. Business Advanced (primary goal, hours)
 * 4. Voice Selection
 * 5. Plan Selection
 * 6. Payment
 * 7. Provisioning (async)
 * 8. Phone Ready
 */
export function SelfServeTrialFlow({
  open,
  onOpenChange,
  onSuccess,
}: SelfServeTrialFlowProps) {
  const navigate = useNavigate();
  const stripe = useStripe();
  const elements = useElements();

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);

  const form = useForm<SelfServeFormData>({
    resolver: zodResolver(selfServeSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      companyName: "",
      trade: "",
      website: "",
      primaryGoal: undefined,
      businessHours: "",
      assistantGender: "female",
      planType: undefined,
    },
  });

  const totalSteps = 8;
  const progressPercent = (currentStep / totalSteps) * 100;

  const handleNext = async () => {
    let fieldsToValidate: (keyof SelfServeFormData)[] = [];

    switch (currentStep) {
      case 1:
        fieldsToValidate = ["name", "email", "phone"];
        break;
      case 2:
        fieldsToValidate = ["companyName", "trade"];
        break;
      case 3:
        // Optional fields, can skip validation
        setCurrentStep(4);
        return;
      case 4:
        fieldsToValidate = ["assistantGender"];
        break;
      case 5:
        fieldsToValidate = ["planType"];
        break;
      case 6:
        // Payment validation handled separately
        if (!cardComplete) {
          setCardError("Please complete your card information");
          return;
        }
        if (!termsAccepted) {
          toast.error("Please accept the terms and conditions");
          return;
        }
        handleSubmit();
        return;
      default:
        return;
    }

    const isValid = await form.trigger(fieldsToValidate);
    if (isValid) {
      setCurrentStep((prev) => prev + 1);
    } else {
      toast.error("Please complete all required fields");
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const handleSubmit = async () => {
    if (!stripe || !elements) {
      toast.error("Payment system not ready. Please try again.");
      return;
    }

    setIsSubmitting(true);

    try {
      const cardElement = elements.getElement("card");
      if (!cardElement) throw new Error("Card element not found");

      // Create payment method
      const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
        type: "card",
        card: cardElement,
        billing_details: {
          name: form.getValues("name"),
          email: form.getValues("email"),
          phone: form.getValues("phone"),
        },
      });

      if (stripeError) {
        setCardError(stripeError.message || "Payment failed");
        toast.error(stripeError.message || "Payment failed");
        setIsSubmitting(false);
        return;
      }

      // Call unified create-trial endpoint
      const formData = form.getValues();
      const { data, error } = await supabase.functions.invoke("create-trial", {
        body: {
          ...formData,
          source: "website",
          paymentMethodId: paymentMethod.id,
        },
      });

      if (error) throw error;

      if (!data.ok) {
        throw new Error(data.error || "Trial creation failed");
      }

      // Success - move to provisioning step
      setAccountId(data.account_id);
      setCurrentStep(7);
      toast.success("Trial started! Setting up your AI receptionist...");
    } catch (error) {
      console.error("Trial signup error:", error);
      toast.error(error instanceof Error ? error.message : "Signup failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestCall = () => {
    if (phoneNumber) {
      window.open(`tel:${phoneNumber}`, "_self");
    }
  };

  const handleViewDashboard = () => {
    onOpenChange(false);
    navigate("/dashboard");
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Progress Bar */}
        {currentStep < 7 && (
          <div className="mb-4">
            <Progress value={progressPercent} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1 text-center">
              Step {currentStep} of {totalSteps}
            </p>
          </div>
        )}

        <Form {...form}>
          {/* Step 1: User Info */}
          {currentStep === 1 && (
            <>
              <DialogHeader>
                <DialogTitle>Let's get started</DialogTitle>
                <DialogDescription>
                  Tell us about yourself to begin your 3-day free trial
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <UserInfoForm
                  form={form}
                  requiredFields={["name", "email", "phone"]}
                  showLabels={true}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button onClick={handleNext}>Continue</Button>
              </div>
            </>
          )}

          {/* Step 2: Business Basics */}
          {currentStep === 2 && (
            <>
              <DialogHeader>
                <DialogTitle>Your Business</DialogTitle>
                <DialogDescription>
                  Help us understand your business
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <BusinessBasicsForm
                  form={form}
                  requiredFields={["companyName", "trade", "website"]}
                  showOptionalBadges={true}
                />
              </div>
              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleNext}>Continue</Button>
              </div>
            </>
          )}

          {/* Step 3: Business Advanced */}
          {currentStep === 3 && (
            <>
              <DialogHeader>
                <DialogTitle>How should your AI operate?</DialogTitle>
                <DialogDescription>
                  Customize your AI receptionist's behavior
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <BusinessAdvancedForm
                  form={form}
                  fields={["primaryGoal", "businessHours"]}
                />
              </div>
              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleNext}>Continue</Button>
              </div>
            </>
          )}

          {/* Step 4: Voice Selection */}
          {currentStep === 4 && (
            <>
              <DialogHeader>
                <DialogTitle>Choose your AI voice</DialogTitle>
                <DialogDescription>
                  Select the voice your customers will hear
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <VoiceSelector
                  form={form}
                  showSamples={true}
                  layout="horizontal"
                />
              </div>
              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleNext}>Continue</Button>
              </div>
            </>
          )}

          {/* Step 5: Plan Selection */}
          {currentStep === 5 && (
            <>
              <DialogHeader>
                <DialogTitle>Choose your plan</DialogTitle>
                <DialogDescription>
                  3-day free trial, then billed monthly. Cancel anytime.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <PlanSelector
                  form={form}
                  variant="detailed"
                  highlight="professional"
                />
              </div>
              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleNext}>Continue</Button>
              </div>
            </>
          )}

          {/* Step 6: Payment */}
          {currentStep === 6 && (
            <>
              <DialogHeader>
                <DialogTitle>Payment Information</DialogTitle>
                <DialogDescription>
                  Start your 3-day free trial. No charge today.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <PaymentForm
                  onCardChange={(complete, error) => {
                    setCardComplete(complete);
                    setCardError(error);
                  }}
                  showTerms={true}
                  termsAccepted={termsAccepted}
                  onTermsChange={setTermsAccepted}
                />
                {cardError && (
                  <p className="text-sm text-destructive mt-2">{cardError}</p>
                )}
              </div>
              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={handleBack} disabled={isSubmitting}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={!cardComplete || !termsAccepted || isSubmitting}
                >
                  {isSubmitting ? "Processing..." : "Start Free Trial"}
                </Button>
              </div>
            </>
          )}

          {/* Step 7: Provisioning */}
          {currentStep === 7 && accountId && (
            <>
              <div className="py-8">
                <ProvisioningStatus
                  accountId={accountId}
                  onComplete={(phone) => {
                    setPhoneNumber(phone);
                    setCurrentStep(8);
                  }}
                  showProgress={true}
                  pollingInterval={3000}
                />
              </div>
            </>
          )}

          {/* Step 8: Phone Ready */}
          {currentStep === 8 && phoneNumber && (
            <>
              <DialogHeader>
                <DialogTitle>You're All Set!</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <PhoneReadyPanel
                  phoneNumber={phoneNumber}
                  onTestCall={handleTestCall}
                  onViewDashboard={handleViewDashboard}
                  showForwardingInstructions={true}
                  variant="full"
                />
              </div>
            </>
          )}
        </Form>
      </DialogContent>
    </Dialog>
  );
}
