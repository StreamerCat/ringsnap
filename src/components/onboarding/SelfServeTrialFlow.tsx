import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useStripe, useElements } from "@stripe/react-stripe-js";
import { toast } from "sonner";
import * as Sentry from "@sentry/react";
import { capture, identify } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { ArrowLeft, Send, Bot, User, RotateCcw } from "lucide-react";

// Import enhanced atomic components
import { EnhancedUserInfoForm } from "./shared/EnhancedUserInfoForm";
import { EnhancedBusinessBasicsForm } from "./shared/EnhancedBusinessBasicsForm";
import { BusinessAdvancedForm } from "./shared/BusinessAdvancedForm";
import { VoiceSelector } from "./shared/VoiceSelector";
import { PlanSelector } from "./shared/PlanSelector";
import { PaymentForm } from "./shared/PaymentForm";
import { ProvisioningStatus } from "./shared/ProvisioningStatus";
import { PhoneReadyPanel } from "./shared/PhoneReadyPanel";

// Import enhanced validation schemas
import {
  nameSchema,
  emailSchema,
  phoneSchema,
  companyNameSchema,
  tradeSchema,
  websiteSchema,
  zipCodeSchema,
  assistantGenderSchema,
  planTypeSchema,
  primaryGoalSchema,
} from "@/components/signup/shared/enhanced-schemas";

// Self-serve flow schema with enhanced validation
const selfServeSchema = z.object({
  // Step 1: User Info
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,

  // Step 2: Business Basics
  companyName: companyNameSchema,
  trade: tradeSchema,
  website: websiteSchema,
  zipCode: zipCodeSchema,

  // Step 3: Business Advanced
  primaryGoal: primaryGoalSchema,
  businessHours: z.string().optional(),

  // Step 4: Voice
  assistantGender: assistantGenderSchema,

  // Step 5: Plan
  planType: planTypeSchema,
});

type SelfServeFormData = z.infer<typeof selfServeSchema>;

interface SelfServeTrialFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function SelfServeTrialFlow({
  open,
  onOpenChange,
  onSuccess,
}: SelfServeTrialFlowProps) {
  const navigate = useNavigate();
  const stripe = useStripe();
  const elements = useElements();
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [useClassicLayout, setUseClassicLayout] = useState(false);

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

  // Auto-scroll to bottom of "chat" when step changes
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [currentStepIndex]);

  // Capture lead after Step 1
  const captureLead = async () => {
    if (leadCaptured) return;

    const { name, email, phone } = form.getValues();

    try {
      const leadPayload = {
        email: email,
        full_name: name,
        phone: phone,
        source: "website",
        signup_flow: "self_serve_trial",
        ip_address: null,
        user_agent: navigator.userAgent,
      };

      console.log("[self-serve trial] Inserting into signup_leads", { payload: leadPayload });

      // TEMPORARY FIX (go-green): Disable direct client-side inserts
      console.warn("[go-green] Direct insert to signup_leads disabled. Backend writes only.");
      const lead = null;
      const error = null;

      if (error) {
        console.error("[self-serve trial] signup_leads insert failed", { error: error, payload: leadPayload });
        console.warn("[self-serve trial] Continuing without lead tracking");
      } else if (lead) {
        setLeadCaptured(true);
        // @ts-expect-error - Assuming lead has id based on original query shape
        setLeadId(lead.id);
        // @ts-expect-error - Assuming lead has email based on original query shape
        console.log("[self-serve trial] signup_leads created successfully", { leadId: lead?.id, email: lead?.email });
      }
    } catch (error) {
      console.error("[self-serve trial] Unexpected error during lead capture:", error);
      console.warn("[self-serve trial] Continuing without lead tracking");
    }
  };

  const FLOW_STEPS = [
    {
      id: "user-info",
      botMessage: "Welcome to Ringsnap! 👋 Let's get you set up with a 3-day free trial. What's your contact info?",
      fieldsToValidate: ["name", "email", "phone"] as (keyof SelfServeFormData)[],
      onSuccess: async () => await captureLead(),
      render: (triggerNext: () => Promise<void>) => (
        <EnhancedUserInfoForm form={form} requiredFields={["name", "email", "phone"]} showLabels={false} enableSmartEmail={true} />
      ),
    },
    {
      id: "business-basics",
      botMessage: "Nice to meet you! Tell me a bit about your business so I can customize your Agent.",
      fieldsToValidate: ["companyName", "trade", "website", "zipCode"] as (keyof SelfServeFormData)[],
      render: (triggerNext: () => Promise<void>) => (
        <EnhancedBusinessBasicsForm form={form} requiredFields={["companyName", "trade", "website", "zipCode"]} showOptionalBadges={true} />
      ),
    },
    {
      id: "business-advanced",
      botMessage: "Got it. How should your Agent handle calls?",
      fieldsToValidate: [] as (keyof SelfServeFormData)[],
      render: (triggerNext: () => Promise<void>) => (
        <BusinessAdvancedForm form={form} fields={["primaryGoal", "businessHours"]} />
      ),
    },
    {
      id: "voice-selection",
      botMessage: "Awesome. Now, select the voice your customers will hear.",
      fieldsToValidate: ["assistantGender"] as (keyof SelfServeFormData)[],
      render: (triggerNext: () => Promise<void>) => (
        <VoiceSelector form={form} showSamples={true} layout="horizontal" onAutoAdvance={triggerNext} />
      ),
    },
    {
      id: "plan-selection",
      botMessage: "Great choice! Which plan fits you best? (3-day free trial, cancel anytime).",
      fieldsToValidate: ["planType"] as (keyof SelfServeFormData)[],
      render: (triggerNext: () => Promise<void>) => (
        <PlanSelector form={form} variant="detailed" highlight="professional" onAutoAdvance={triggerNext} />
      ),
    },
    {
      id: "payment",
      botMessage: "Almost done! Secure your trial below. You won't be charged today.",
      fieldsToValidate: [] as (keyof SelfServeFormData)[],
      customValidation: () => {
        if (!cardComplete) return "Please complete your card information";
        if (!termsAccepted) return "Please accept the terms and conditions";
        return null;
      },
      render: (triggerNext: () => Promise<void>) => (
        <PaymentForm
          onCardChange={(complete, error) => {
            setCardComplete(complete);
            setCardError(error);
          }}
          showTerms={true}
          termsAccepted={termsAccepted}
          onTermsChange={setTermsAccepted}
        />
      ),
    },
  ];

  const handleNext = async () => {
    if (isTransitioning || isSubmitting) return;
    setIsTransitioning(true);

    try {
      const currentConfig = FLOW_STEPS[currentStepIndex];

      if (currentConfig.fieldsToValidate.length > 0) {
        const isValid = await form.trigger(currentConfig.fieldsToValidate);
        if (!isValid) {
          toast.error("Please complete all required fields");
          setIsTransitioning(false);
          return;
        }
      }

      if (currentConfig.customValidation) {
        const errorMsg = currentConfig.customValidation();
        if (errorMsg) {
          toast.error(errorMsg);
          setIsTransitioning(false);
          return;
        }
      }

      if (currentConfig.onSuccess) {
        await currentConfig.onSuccess();
      }

      // Track step completion in PostHog
      capture('onboarding_step_completed', {
        step_id: currentConfig.id,
        step_index: currentStepIndex,
        funnel: 'self_serve_trial',
      });

      if (currentStepIndex === FLOW_STEPS.length - 1) {
        await handleSubmit();
      } else {
        setCurrentStepIndex((prev) => prev + 1);
      }
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleBack = () => setCurrentStepIndex((prev) => Math.max(0, prev - 1));

  const handleSubmit = async () => {
    if (!stripe || !elements) {
      toast.error("Payment system not ready. Please try again.");
      return;
    }

    setIsSubmitting(true);

    try {
      const cardElement = elements.getElement("card");
      if (!cardElement) throw new Error("Card element not found");

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
        capture('trial_signup_payment_error', { error_message: stripeError.message, error_code: stripeError.code });
        setIsSubmitting(false);
        return;
      }

      capture('trial_signup_submitted', { plan_type: form.getValues("planType"), funnel: 'self_serve_trial' });

      const formData = form.getValues();
      const { data, error } = await supabase.functions.invoke("create-trial", {
        body: {
          ...formData,
          source: "website",
          paymentMethodId: paymentMethod.id,
          leadId: leadId,
        },
      });

      if (error) throw error;

      if (!data.ok) {
        throw new Error(data.error || "Trial creation failed");
      }

      // Re-identify with confirmed user_id and account context
      if (data.user_id) {
        identify(data.user_id, {
          account_id: data.account_id,
          plan_key: data.plan_type,
          billing_status: 'trialing',
          last_active_at: new Date().toISOString(),
        });
      }

      capture('trial_signup_success', {
        plan_type: data.plan_type,
        account_id: data.account_id,
        source: 'self_serve',
      });

      setAccountId(data.account_id);
      toast.success("Trial started! Setting up your Agent...");
    } catch (error) {
      console.error("Trial signup error:", error);
      Sentry.captureException(error, { tags: { flow: 'self_serve_trial', step: 'create_trial' } });
      capture('trial_signup_failed', {
        error_message: error instanceof Error ? error.message : String(error),
        funnel: 'self_serve_trial',
      });
      toast.error(error instanceof Error ? error.message : "Signup failed");
      setIsSubmitting(false);
    }
  };

  if (accountId && !phoneNumber) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md py-8">
          <DialogTitle className="sr-only">Provisioning your account</DialogTitle>
          <DialogDescription className="sr-only">We are creating your assistant and phone number now.</DialogDescription>
          <ProvisioningStatus
            accountId={accountId}
            onComplete={setPhoneNumber}
            showProgress={true}
            pollingInterval={3000}
          />
        </DialogContent>
      </Dialog>
    );
  }

  if (phoneNumber) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md py-4">
          <DialogTitle className="sr-only">Your trial phone number is ready</DialogTitle>
          <DialogDescription className="sr-only">Review your new number and next steps.</DialogDescription>
          <PhoneReadyPanel
            phoneNumber={phoneNumber}
            onTestCall={() => window.open(`tel:${phoneNumber}`, "_self")}
            onViewDashboard={() => {
              onOpenChange(false);
              navigate("/dashboard");
              onSuccess?.();
            }}
            showForwardingInstructions={true}
            variant="full"
          />
        </DialogContent>
      </Dialog>
    );
  }

  const currentStep = FLOW_STEPS[currentStepIndex];

  if (useClassicLayout) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogTitle className="sr-only">Self-Serve Trial Setup</DialogTitle>
          <DialogDescription className="sr-only">Classic onboarding rollback layout for trial setup.</DialogDescription>
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-center justify-between gap-2">
            <span>Rollback mode enabled: classic onboarding layout active.</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => setUseClassicLayout(false)}>
              Switch to new chat
            </Button>
          </div>

          <Form {...form}>
            <div className="space-y-6 py-2">
              <div>
                <h2 className="text-lg font-semibold">Step {currentStepIndex + 1} of {FLOW_STEPS.length}</h2>
                <p className="text-sm text-muted-foreground mt-1">{currentStep.botMessage}</p>
              </div>

              {currentStep.render(handleNext)}

              {currentStep.id === "payment" && cardError && (
                <p className="text-sm text-destructive font-medium">{cardError}</p>
              )}

              <div className="flex justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={currentStepIndex === 0 || isSubmitting || isTransitioning}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>

                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={isSubmitting || isTransitioning}
                >
                  {isSubmitting || isTransitioning
                    ? "Processing..."
                    : currentStepIndex === FLOW_STEPS.length - 1
                      ? "Start Free Trial"
                      : "Continue"}
                </Button>
              </div>
            </div>
          </Form>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 overflow-hidden flex flex-col bg-slate-50/50">
        <DialogTitle className="sr-only">Self-Serve Trial Setup</DialogTitle>
        <DialogDescription className="sr-only">Complete setup for your Ringsnap trial in a chat-style flow.</DialogDescription>
        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-xs text-emerald-800 flex items-center justify-between">
          <span>New chat onboarding experience enabled.</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => setUseClassicLayout(true)}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            Roll back to classic
          </Button>
        </div>

        <div className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm z-10">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Agent Setup</h2>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Ringsnap Assistant is online
            </p>
          </div>
          <div className="text-xs font-medium text-slate-400">
            Step {currentStepIndex + 1} of {FLOW_STEPS.length}
          </div>
        </div>

        <Form {...form}>
          <div
            ref={chatScrollRef}
            className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth"
          >
            <div className="flex gap-4 max-w-[85%]">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1 shadow-sm">
                <Bot className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="bg-white border shadow-sm rounded-2xl rounded-tl-sm px-5 py-3 text-sm leading-relaxed text-slate-700">
                {currentStep.botMessage}
              </div>
            </div>

            <div className="flex gap-4 justify-end">
              <div className="bg-white border shadow-md rounded-2xl rounded-tr-sm p-5 w-full max-w-[90%]">
                {currentStep.render(handleNext)}

                {currentStep.id === "payment" && cardError && (
                  <p className="text-sm text-destructive mt-3 font-medium">{cardError}</p>
                )}
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-1 shadow-sm">
                <User className="w-4 h-4 text-slate-600" />
              </div>
            </div>
          </div>

          <div className="bg-white border-t p-4 flex justify-between items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={handleBack}
              disabled={currentStepIndex === 0 || isSubmitting || isTransitioning}
              className="text-slate-500 hover:text-slate-800"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>

            <Button
              type="button"
              onClick={handleNext}
              disabled={isSubmitting || isTransitioning}
              className="w-full sm:w-auto px-8 rounded-full transition-all shadow-md hover:shadow-lg"
            >
              {isSubmitting || isTransitioning ? (
                "Processing..."
              ) : currentStepIndex === FLOW_STEPS.length - 1 ? (
                "Start Free Trial"
              ) : (
                <>Continue <Send className="ml-2 h-4 w-4" /></>
              )}
            </Button>
          </div>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
