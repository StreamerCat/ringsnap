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
import { PhoneNumberSelectionStep } from "./PhoneNumberSelectionStep";
import { SetupCompleteStep } from "./SetupCompleteStep";
import {
  WizardStep,
  WizardFormData,
  businessEssentialsSchema,
  planSelectionSchema,
  businessDetailsSchema,
  phoneSelectionSchema,
  parseBusinessHours,
} from "./types";
import * as z from "zod";

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const STORAGE_KEY = "ringsnap_wizard_progress";

// Inner wizard component with Stripe context
function WizardInner() {
  const [currentStep, setCurrentStep] = useState<WizardStep>(WizardStep.BusinessEssentials);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  const stripe = useStripe();
  const elements = useElements();

  const form = useForm<WizardFormData>({
    mode: "onChange",
    defaultValues: {
      companyName: "",
      trade: "",
      serviceArea: "",
      zipCode: "",
      planType: undefined,
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      businessHours: "",
      emergencyPolicy: "",
      assistantGender: "female",
      salesRepName: "",
      selectedAreaCode: "",
      selectedPhoneNumber: undefined,
      selectedPhoneId: undefined,
    },
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
        form.reset(data);
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

        case WizardStep.PhoneNumberSelection:
          phoneSelectionSchema.parse({
            selectedAreaCode: values.selectedAreaCode,
            selectedPhoneNumber: values.selectedPhoneNumber,
            selectedPhoneId: values.selectedPhoneId,
          });
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

      // Call edge function to create account
      const { data, error } = await supabase.functions.invoke("create-sales-account", {
        body: {
          customerInfo: {
            name: form.getValues("customerName"),
            email: form.getValues("customerEmail"),
            phone: form.getValues("customerPhone"),
            companyName: form.getValues("companyName"),
            trade: form.getValues("trade"),
            serviceArea: form.getValues("serviceArea"),
            businessHours: parseBusinessHours(form.getValues("businessHours")),
            emergencyPolicy: form.getValues("emergencyPolicy"),
            salesRepName: form.getValues("salesRepName"),
            planType: form.getValues("planType"),
            zipCode: form.getValues("zipCode"),
            assistantGender: form.getValues("assistantGender"),
          },
          paymentMethodId: paymentMethod.id,
        },
      });

      if (error) throw error;

      // Store backend response
      form.setValue("accountId", data.accountId);
      form.setValue("userId", data.userId);
      form.setValue("stripeCustomerId", data.stripeCustomerId);
      form.setValue("subscriptionId", data.subscriptionId);
      form.setValue("tempPassword", data.tempPassword);

      toast.success("Payment successful!");
      setCurrentStep(WizardStep.PhoneNumberSelection);
    } catch (err) {
      console.error("Payment error:", err);
      const message = err instanceof Error ? err.message : "Payment failed";
      setCardError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProvision = async () => {
    setIsProvisioning(true);

    try {
      const { data, error } = await supabase.functions.invoke("provision-sales-account", {
        body: {
          accountId: form.getValues("accountId"),
          userId: form.getValues("userId"),
          selectedPhoneNumber: form.getValues("selectedPhoneNumber"),
          selectedPhoneId: form.getValues("selectedPhoneId"),
          areaCode: form.getValues("selectedAreaCode"),
        },
      });

      if (error) throw error;

      // Store provisioned data
      form.setValue("vapiPhoneNumber", data.vapiPhoneNumber);
      form.setValue("vapiAssistantId", data.vapiAssistantId);

      toast.success("Your AI assistant is now active!");
      setCurrentStep(WizardStep.SetupComplete);

      // Clear saved progress
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error("Provisioning error:", err);
      toast.error("Provisioning failed. Please try selecting a different number.");
    } finally {
      setIsProvisioning(false);
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
      case WizardStep.PhoneNumberSelection:
        return (
          <PhoneNumberSelectionStep
            form={form}
            onProvision={handleProvision}
            isProvisioning={isProvisioning}
          />
        );
      case WizardStep.SetupComplete:
        return <SetupCompleteStep formData={form.getValues()} />;
      default:
        return null;
    }
  };

  const canGoNext =
    currentStep < WizardStep.PhoneNumberSelection && currentStep !== WizardStep.Payment;
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
              disabled={!canGoBack || isSubmitting || isProvisioning}
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
