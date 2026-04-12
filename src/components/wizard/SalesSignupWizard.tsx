import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Elements, useStripe, useElements, CardElement } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { WizardProgress } from "./WizardProgress";
import { BusinessEssentialsStep } from "./BusinessEssentialsStep";
import { PlanSelectionStep } from "./PlanSelectionStep";
import { BusinessDetailsStep } from "./BusinessDetailsStep";
import { PaymentStep } from "./PaymentStep";
import { SetupCompleteStep } from "./SetupCompleteStep";
import {
  WizardStep,
  WizardFormData,
  businessEssentialsSchema,
  planSelectionSchema,
  businessDetailsSchema,
  parseBusinessHours,
} from "./types";
import * as z from "zod";

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const STORAGE_KEY = "ringsnap_wizard_progress";

const WIZARD_DEFAULT_VALUES = {
  companyName: "",
  trade: "",
  serviceArea: "",
  zipCode: "",
  planType: undefined as "starter" | "professional" | "premium" | undefined,
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  businessHours: "",
  emergencyPolicy: "",
  assistantGender: "female" as "male" | "female",
  salesRepName: "",
};

// Inner wizard component with Stripe context
function WizardInner() {
  const [currentStep, setCurrentStep] = useState<WizardStep>(WizardStep.BusinessEssentials);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);

  const stripe = useStripe();
  const elements = useElements();

  const form = useForm<WizardFormData>({
    mode: "onChange",
    defaultValues: WIZARD_DEFAULT_VALUES,
  });

  // Auto-save progress to sessionStorage
  useEffect(() => {
    const subscription = form.watch((data) => {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ step: currentStep, data }));
    });
    return () => subscription.unsubscribe();
  }, [form, currentStep]);

  // Load progress from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const { step, data } = JSON.parse(saved);
        // Merge with defaults so fields absent from the saved snapshot
        // (e.g. saved before a later step was reached) keep their empty-string
        // defaults rather than becoming undefined and failing Zod validation.
        form.reset({ ...WIZARD_DEFAULT_VALUES, ...data });
        setCurrentStep(step);
        toast.info("Progress restored from your last session");
      } catch (err) {
        console.error("Failed to restore progress:", err);
      }
    }
  }, []);

  // Warn before leaving if form has data
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasData = form.getValues("companyName") || form.getValues("customerEmail");
      if (hasData && currentStep < WizardStep.SetupComplete) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [form, currentStep]);

  const validateStep = async (step: WizardStep): Promise<boolean> => {
    const values = form.getValues();

    try {
      switch (step) {
        case WizardStep.BusinessEssentials:
          businessEssentialsSchema.parse({
            companyName: values.companyName,
            trade: values.trade,
            serviceArea: values.serviceArea,
            zipCode: values.zipCode,
          });
          return true;

        case WizardStep.PlanSelection:
          planSelectionSchema.parse({ planType: values.planType });
          return true;

        case WizardStep.BusinessDetails:
          businessDetailsSchema.parse({
            customerName: values.customerName,
            customerEmail: values.customerEmail,
            customerPhone: values.customerPhone,
            businessHours: values.businessHours,
            emergencyPolicy: values.emergencyPolicy,
            assistantGender: values.assistantGender,
            salesRepName: values.salesRepName,
          });
          return true;

        case WizardStep.Payment:
          if (!stripe || !elements) {
            toast.error("Payment service not ready");
            return false;
          }
          if (!cardComplete) {
            setCardError("Please complete your card details");
            return false;
          }
          return true;

        default:
          return true;
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        err.errors.forEach((error) => {
          toast.error(error.message);
        });
      }
      return false;
    }
  };

  const handleNext = async () => {
    const isValid = await validateStep(currentStep);
    if (!isValid) return;

    // Capture lead after BusinessDetails step (when we have customer contact info)
    if (currentStep === WizardStep.BusinessDetails && !leadId) {
      try {
        const leadPayload = {
          email: form.getValues("customerEmail"),
          full_name: form.getValues("customerName"),
          phone: form.getValues("customerPhone"),
          source: "sales",
          signup_flow: "sales",
          ip_address: null,
          user_agent: navigator.userAgent,
        };

        console.log("[sales signup] Inserting into signup_leads", { payload: leadPayload });

        // TEMPORARY FIX (go-green): Disable direct client-side inserts
        // All writes MUST flow through edge functions only until backend is green
        console.warn("[go-green] Direct insert to signup_leads disabled. Backend writes only.");
        const lead = null;
        const leadError = null;

        // const { data: lead, error: leadError } = await supabase
        //   .from("signup_leads")
        //   .insert(leadPayload)
        //   .select()
        //   .single();

        if (leadError) {
          console.error("[sales signup] signup_leads insert failed", {
            error: leadError,
            payload: leadPayload
          });
          // Don't block the user - lead capture is optional
          console.warn("[sales signup] Continuing without lead tracking");
        } else if (lead) {
          console.log("[sales signup] signup_leads created successfully", {
            leadId: lead.id,
            email: lead.email
          });
          setLeadId(lead.id);
          toast.success("Customer information saved!");
        }
      } catch (err) {
        console.error("[sales signup] Unexpected error during lead capture:", err);
        // Don't block the user - lead capture is optional
        console.warn("[sales signup] Continuing without lead tracking");
      }
    }

    // Special handling for payment step
    if (currentStep === WizardStep.Payment) {
      await handlePayment();
    } else {
      setCurrentStep((prev) => Math.min(prev + 1, WizardStep.SetupComplete));
    }
  };

  const handleBack = () => {
    if (currentStep > WizardStep.BusinessEssentials) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handlePayment = async () => {
    if (!stripe || !elements) {
      toast.error("Payment service not available");
      return;
    }

    setIsSubmitting(true);
    setCardError(null);

    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) throw new Error("Card element not found");

      const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
        type: "card",
        card: cardElement,
        billing_details: {
          name: form.getValues("customerName"),
          email: form.getValues("customerEmail"),
          phone: form.getValues("customerPhone"),
        },
      });

      if (stripeError || !paymentMethod) {
        const message = stripeError?.message ?? "Unable to process payment";
        setCardError(message);
        toast.error(message);
        return;
      }

      // Call edge function to create account - using unified create-trial with source='sales'
      const { data, error } = await supabase.functions.invoke("create-trial", {
        body: {
          // Required fields
          name: form.getValues("customerName"),
          email: form.getValues("customerEmail"),
          phone: form.getValues("customerPhone"),
          companyName: form.getValues("companyName"),
          trade: form.getValues("trade"),
          zipCode: form.getValues("zipCode"),
          planType: form.getValues("planType"),
          paymentMethodId: paymentMethod.id,

          // Source tracking (CRITICAL)
          source: 'sales',
          salesRepName: form.getValues("salesRepName"),

          // Lead linking
          leadId: leadId,

          // Optional business details
          serviceArea: form.getValues("serviceArea") || "",
          businessHours: JSON.stringify(parseBusinessHours(form.getValues("businessHours"))),
          emergencyPolicy: form.getValues("emergencyPolicy") || "",

          // Assistant configuration
          assistantGender: form.getValues("assistantGender") || "female",
          wantsAdvancedVoice: false,
        },
      });

      if (error) throw error;

      // Store backend response - adapt create-trial response format
      form.setValue("accountId", data.account_id);
      form.setValue("userId", data.user_id);
      form.setValue("stripeCustomerId", data.stripe_customer_id);
      form.setValue("subscriptionId", data.subscription_id);
      form.setValue("tempPassword", data.password);
      form.setValue("vapiPhoneNumber", null); // Provisioning is async
      form.setValue("vapiAssistantId", null); // Provisioning is async

      // Sales accounts are created immediately as active
      toast.success("Payment successful! Your account is being set up. The customer will receive an email when the phone number is ready.");

      setCurrentStep(WizardStep.SetupComplete);
    } catch (err) {
      console.error("Payment error:", err);
      const message = err instanceof Error ? err.message : "Payment failed";
      setCardError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };


  const renderStep = () => {
    switch (currentStep) {
      case WizardStep.BusinessEssentials:
        return <BusinessEssentialsStep form={form} />;
      case WizardStep.PlanSelection:
        return <PlanSelectionStep form={form} />;
      case WizardStep.BusinessDetails:
        return <BusinessDetailsStep form={form} />;
      case WizardStep.Payment:
        return (
          <PaymentStep
            form={form}
            cardComplete={cardComplete}
            onCardChange={setCardComplete}
            cardError={cardError}
          />
        );
      case WizardStep.SetupComplete:
        return <SetupCompleteStep formData={form.getValues()} />;
      default:
        return null;
    }
  };

  const canGoNext = currentStep < WizardStep.Payment;
  const canGoBack = currentStep > WizardStep.BusinessEssentials && currentStep < WizardStep.SetupComplete;
  const showPaymentButton = currentStep === WizardStep.Payment;
  const isComplete = currentStep === WizardStep.SetupComplete;

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        {!isComplete && <WizardProgress currentStep={currentStep} />}

        <div className="min-h-[600px]">{renderStep()}</div>

        {!isComplete && (
          <div className="flex justify-between items-center max-w-3xl mx-auto pt-6 border-t">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={!canGoBack || isSubmitting}
              size="lg"
            >
              <ArrowLeft className="mr-2 h-5 w-5" />
              Back
            </Button>

            {showPaymentButton && (
              <Button
                onClick={handlePayment}
                disabled={isSubmitting || !stripe || !elements || !cardComplete}
                size="lg"
                className="px-12"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing Payment...
                  </>
                ) : (
                  <>
                    Complete Payment
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            )}

            {canGoNext && (
              <Button onClick={handleNext} size="lg" className="px-12">
                Continue
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Main wizard component with Stripe provider
export const SalesSignupWizard = () => {
  return (
    <Elements stripe={stripePromise}>
      <WizardInner />
    </Elements>
  );
};
