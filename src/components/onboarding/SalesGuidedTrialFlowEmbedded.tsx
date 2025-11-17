import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useStripe, useElements } from "@stripe/react-stripe-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Phone } from "lucide-react";

// Import shared atomic components
import { UserInfoForm } from "./shared/UserInfoForm";
import { BusinessBasicsForm } from "./shared/BusinessBasicsForm";
import { VoiceSelector } from "./shared/VoiceSelector";
import { PlanSelector } from "./shared/PlanSelector";
import { PaymentForm } from "./shared/PaymentForm";
import { ProvisioningStatus } from "./shared/ProvisioningStatus";
import { PhoneReadyPanel } from "./shared/PhoneReadyPanel";

// Sales flow schema
const salesSchema = z.object({
  // User info
  name: z.string().min(1, "Name required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(10, "Phone required"),

  // Business info
  companyName: z.string().min(1, "Company name required"),
  trade: z.string().min(1, "Trade required"),
  serviceArea: z.string().min(1, "Service area required"),
  zipCode: z.string().regex(/^\d{5}$/, "ZIP must be 5 digits"),

  // AI config
  assistantGender: z.enum(["male", "female"]).default("female"),

  // Sales tracking
  salesRepName: z.string().min(1, "Sales rep name required"),

  // Plan
  planType: z.enum(["starter", "professional", "premium"]),
});

type SalesFormData = z.infer<typeof salesSchema>;

interface SalesGuidedTrialFlowEmbeddedProps {
  onSuccess?: () => void;
}

/**
 * Sales-Guided Trial Flow - Embedded Version (No Dialog)
 * 5-step fast flow for in-person sales reps
 *
 * Steps:
 * 1. Combined Form (all info at once - fast!)
 * 2. Plan Selection
 * 3. Payment
 * 4. Provisioning (rep uses this time to pitch)
 * 5. Phone Ready (demo time!)
 */
export function SalesGuidedTrialFlowEmbedded({
  onSuccess
}: SalesGuidedTrialFlowEmbeddedProps) {
  const navigate = useNavigate();
  const stripe = useStripe();
  const elements = useElements();

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);

  const form = useForm<SalesFormData>({
    resolver: zodResolver(salesSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      companyName: "",
      trade: "",
      serviceArea: "",
      zipCode: "",
      assistantGender: "female",
      salesRepName: "",
      planType: undefined,
    },
  });

  const handleNext = async () => {
    let fieldsToValidate: (keyof SalesFormData)[] = [];

    switch (currentStep) {
      case 1:
        fieldsToValidate = ["name", "email", "phone", "companyName", "trade", "serviceArea", "zipCode", "assistantGender", "salesRepName"];
        break;
      case 2:
        fieldsToValidate = ["planType"];
        break;
      case 3:
        // Payment validation
        if (!cardComplete) {
          setCardError("Please complete card information");
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
      toast.error("Payment system not ready");
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
          source: "sales",
          paymentMethodId: paymentMethod.id,
        },
      });

      if (error) throw error;

      if (!data.ok) {
        throw new Error(data.error || "Trial creation failed");
      }

      // Success - move to provisioning
      setAccountId(data.account_id);
      setCurrentStep(4);
      toast.success("Account activated! Setting up AI receptionist...");
    } catch (error) {
      console.error("Sales signup error:", error);
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
    navigate("/dashboard");
    onSuccess?.();
  };

  return (
    <div className="space-y-6">
      {/* Step 1: Combined Form */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>New Customer Setup</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Customer Info */}
                  <div>
                    <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wide">
                      Customer Information
                    </h3>
                    <UserInfoForm
                      form={form}
                      requiredFields={["name", "email", "phone"]}
                      showLabels={false}
                      compact={true}
                    />
                  </div>

                  {/* Business Info */}
                  <div>
                    <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wide">
                      Business Information
                    </h3>
                    <BusinessBasicsForm
                      form={form}
                      requiredFields={["companyName", "trade", "serviceArea", "zipCode"]}
                      showOptionalBadges={false}
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Voice Selection */}
                  <div>
                    <VoiceSelector
                      form={form}
                      showSamples={false}
                      layout="vertical"
                    />
                  </div>

                  {/* Sales Rep */}
                  <div>
                    <FormField
                      control={form.control}
                      name="salesRepName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sales Rep *</FormLabel>
                          <FormControl>
                            <Input placeholder="Your name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleNext} size="lg">
                    Continue to Plan Selection
                  </Button>
                </div>
              </div>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Plan Selection */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Select Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <PlanSelector
                form={form}
                variant="compact"
                highlight="professional"
              />
              <div className="flex justify-between gap-2 mt-6">
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleNext}>Continue to Payment</Button>
              </div>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Payment */}
      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Payment</CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentForm
              onCardChange={(complete, error) => {
                setCardComplete(complete);
                setCardError(error);
              }}
              showTerms={false} // Rep handles verbally
            />
            {cardError && (
              <p className="text-sm text-destructive mt-2">{cardError}</p>
            )}
            <div className="flex justify-between gap-2 mt-6">
              <Button variant="outline" onClick={handleBack} disabled={isSubmitting}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={handleNext}
                disabled={!cardComplete || isSubmitting}
                size="lg"
              >
                {isSubmitting ? "Processing..." : "Activate Account"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Provisioning */}
      {currentStep === 4 && accountId && (
        <Card>
          <CardContent className="py-12">
            <ProvisioningStatus
              accountId={accountId}
              onComplete={(phone) => {
                setPhoneNumber(phone);
                setCurrentStep(5);
              }}
              showProgress={true}
              pollingInterval={2000} // Faster polling for sales
            />
            <div className="mt-8 text-center">
              <div className="inline-block bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  Perfect time to: Explain call forwarding to the customer
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Phone Ready - Demo Time! */}
      {currentStep === 5 && phoneNumber && (
        <Card>
          <CardContent className="py-8">
            <PhoneReadyPanel
              phoneNumber={phoneNumber}
              onTestCall={handleTestCall}
              showForwardingInstructions={true}
              variant="minimal"
            />

            <div className="mt-8 space-y-3">
              <Button
                onClick={handleTestCall}
                size="lg"
                className="w-full"
              >
                <Phone className="mr-2 h-5 w-5" />
                Call Their AI Receptionist Now
              </Button>

              <Button
                onClick={handleViewDashboard}
                variant="outline"
                className="w-full"
              >
                Complete Setup
              </Button>
            </div>

            <div className="mt-6 p-4 bg-green-50 dark:bg-green-950 rounded-lg">
              <p className="text-sm text-green-900 dark:text-green-100 text-center">
                Next step: Have the customer call the number above to experience their AI receptionist
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
