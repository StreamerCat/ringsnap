import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { useToast } from "@/components/ui/use-toast";
import { useUser } from "@/lib/auth/useUser";
import { SalesSuccessModal, type SalesSuccessModalData } from "@/components/SalesSuccessModal";

// Initialize Stripe - Replace with your live publishable key from https://dashboard.stripe.com/apikeys
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// Form schema
const daySchema = z.object({
  open: z.boolean(),
  openTime: z.string().optional(), // "08:00"
  closeTime: z.string().optional(), // "17:00"
});

const businessHoursSchema = z.object({
  monday: daySchema,
  tuesday: daySchema,
  wednesday: daySchema,
  thursday: daySchema,
  friday: daySchema,
  saturday: daySchema,
  sunday: daySchema,
});

const salesFormSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(100),
  email: z.string().trim().email("Invalid email").max(255),
  phone: z.string().trim().regex(/^(\+1[\s-]?)?(\(?\d{3}\)?[\s-]?)\d{3}[\s-]?\d{4}$/, "Enter a valid US phone number"),
  companyName: z.string().trim().min(1, "Company name required").max(200),
  website: z
    .string()
    .trim()
    .min(1, "Website required")
    .transform((val) => {
      const value = val.trim();
      if (value.includes("@") && !value.startsWith("http")) {
        const domain = value.split("@")[1];
        return `https://www.${domain}`;
      }
      if (!/^https?:\/\//i.test(value)) {
        return `https://${value}`;
      }
      return value;
    }),
  trade: z.string().min(1, "Trade required"),
  serviceArea: z.string().trim().min(1, "Service area required").max(200),
  businessHours: businessHoursSchema,
  emergencyPolicy: z.string().trim().min(10, "Emergency policy required").max(1000),
  planType: z.enum(['starter', 'professional', 'premium'], {
    required_error: "Select a plan to continue"
  }),
  salesRepName: z.string().trim().min(1, "Sales rep name required").max(100),
  zipCode: z.string().trim().regex(/^\d{5}$/, "Valid 5-digit ZIP required"),
  assistantGender: z.enum(['male', 'female']).default('female'),
  referralCode: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val ? val.toUpperCase() : "")),
});

type FormData = z.infer<typeof salesFormSchema>;

type CreateSalesAccountResponse = {
  success?: boolean;
  userId?: string;
  accountId?: string | null;
  stripeCustomerId?: string | null;
  subscriptionId?: string | null;
  tempPassword: string;
  subscriptionStatus?: string | null;
  ringSnapNumber?: string | null;
  provisioned?: boolean;
  provisioningMessage?: string;
};

// Parse business hours to a Vapi-friendly JSONB format
function parseBusinessHours(hours: unknown): object {
  // 1. Handle new structured object format from the form
  if (typeof hours === 'object' && hours !== null && !Array.isArray(hours)) {
    const vapiHours: { [key: string]: Array<{ start: string; end: string }> } = {};
    const days = Object.keys(hours) as Array<keyof typeof hours>;

    for (const day of days) {
      const daySchedule = hours[day];
      if (daySchedule.open && daySchedule.openTime && daySchedule.closeTime) {
        vapiHours[day] = [{ start: daySchedule.openTime, end: daySchedule.closeTime }];
      } else {
        vapiHours[day] = []; // Represent closed days as an empty array
      }
    }
    return vapiHours;
  }

  // 2. Handle old string format for backward compatibility
  if (typeof hours === 'string') {
    try {
      // If it's a valid JSON string, parse it
      return JSON.parse(hours);
    } catch {
      // Otherwise, return as a simple text field
      return { text: hours };
    }
  }

  // 3. Fallback for any other unexpected format
  return { text: "Unsupported business hours format" };
}

import { useEffect } from "react";

// Import enhanced modular sections
import { CustomerInfoSection } from "@/components/sales/sections/CustomerInfoSection";
import { BusinessDetailsSection } from "@/components/sales/sections/BusinessDetailsSection";
import { PlanSelectionSection } from "@/components/sales/sections/PlanSelectionSection";
import { SalesRepSection } from "@/components/sales/sections/SalesRepSection";
import { PaymentSection } from "@/components/sales/sections/PaymentSection";
import { PLANS } from "@/components/sales/types";

// Inner form component that has access to Stripe
function SalesSignupFormInner() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardComplete, setCardComplete] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState<SalesSuccessModalData | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const stripe = useStripe();
  const elements = useElements();
  const isStripeReady = stripe && elements;
  const { user } = useUser();

  const form = useForm<FormData>({
    resolver: zodResolver(salesFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      companyName: "",
      website: "",
      trade: "",
      serviceArea: "",
      businessHours: {
        monday: { open: true, openTime: "08:00", closeTime: "17:00" },
        tuesday: { open: true, openTime: "08:00", closeTime: "17:00" },
        wednesday: { open: true, openTime: "08:00", closeTime: "17:00" },
        thursday: { open: true, openTime: "08:00", closeTime: "17:00" },
        friday: { open: true, openTime: "08:00", closeTime: "17:00" },
        saturday: { open: false, openTime: "", closeTime: "" },
        sunday: { open: false, openTime: "", closeTime: "" },
      },
      emergencyPolicy: "",
      planType: undefined,
      salesRepName: "",
      zipCode: "",
      assistantGender: "female",
      referralCode: ""
    },
  });
  const selectedPlan = form.watch('planType');
  const selectedPlanDetails = PLANS.find(p => p.value === selectedPlan);

  useEffect(() => {
    if (user && !form.getValues("salesRepName")) {
      const fullName = user.user_metadata?.full_name || user.user_metadata?.name;
      if (fullName) {
        form.setValue("salesRepName", fullName);
      }
    }
  }, [user, form]);

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setError(null);
    setCardError(null);

    try {
      if (!stripe || !elements) {
        throw new Error("Payment service not available. Please try again.");
      }

      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error("Card element not found");
      }

      if (!cardComplete) {
        setCardError("Enter a complete payment method to continue.");
        setIsSubmitting(false);
        return;
      }

      const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
        billing_details: {
          name: data.name,
          email: data.email,
          phone: data.phone
        }
      });

      if (stripeError || !paymentMethod) {
        const message = stripeError?.message ?? "Unable to process payment details.";
        setCardError(message);
        setIsSubmitting(false);
        return;
      }

      const paymentMethodId = paymentMethod.id;

      // Call edge function - using unified create-trial with source='sales'
      const { data: result, error: functionError } = await supabase.functions.invoke(
        'create-trial',
        {
          body: {
            // Required fields
            name: data.name,
            email: data.email,
            phone: data.phone,
            companyName: data.companyName,
            trade: data.trade,
            zipCode: data.zipCode?.trim() ?? "",
            planType: data.planType,
            paymentMethodId: paymentMethodId,

            // Source tracking (CRITICAL)
            source: 'sales',
            salesRepName: data.salesRepName,

            // Optional business details
            website: data.website || "",
            serviceArea: data.serviceArea || "",
            businessHours: JSON.stringify(parseBusinessHours(data.businessHours)),
            emergencyPolicy: data.emergencyPolicy || "",

            // Assistant configuration
            assistantGender: data.assistantGender,
            wantsAdvancedVoice: false,

            // Optional metadata
            referralCode: data.referralCode?.trim() ?? ""
          }
        }
      );

      if (functionError) throw functionError;

      // Adapt create-trial response to expected format
      const typedResult = result as any;

      if (!typedResult || !typedResult.password) {
        throw new Error('Missing credentials in account creation response.');
      }

      const modalPayload: SalesSuccessModalData = {
        customerName: data.name,
        customerEmail: data.email,
        customerPhone: data.phone,
        companyName: data.companyName,
        ringSnapNumber: null, // Provisioning is async, phone not ready yet
        tempPassword: typedResult.password,
        accountId: typedResult.account_id ?? null,
        subscriptionStatus: 'active', // Sales accounts are immediately active
        planType: data.planType,
        salesRepName: data.salesRepName,
      };

      setSuccessData(modalPayload);
      setShowSuccessModal(true);

      // Show appropriate toast based on provisioning status
      const provisioningMessage = typedResult.message || 'Your AI assistant and phone number are being set up. The customer will receive an email when ready.';

      toast({
        title: "Account created successfully",
        description: provisioningMessage,
        variant: "default",
      });

    } catch (err) {
      console.error('Signup error:', err);
      const message = err instanceof Error ? err.message : 'Failed to create account. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} action="javascript:void(0);" className="space-y-8">
          {/* Customer Info Section */}
          <CustomerInfoSection form={form} isSubmitting={isSubmitting} />

          {/* Business Details Section */}
          <BusinessDetailsSection form={form} isSubmitting={isSubmitting} />

          {/* Plan Selection Section (includes Order Summary) */}
          <PlanSelectionSection form={form} isSubmitting={isSubmitting} />

          {/* Sales Rep Section */}
          <SalesRepSection form={form} isSubmitting={isSubmitting} />

          {/* Payment Section */}
          <PaymentSection
            form={form}
            isSubmitting={isSubmitting}
            onCardChange={(complete, error) => {
              setCardComplete(complete);
              setCardError(error);
            }}
          />

          {/* Error Display */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-600">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <div className="space-y-2">
            <p className="text-xs text-center text-muted-foreground">All required fields are marked with *</p>
            <Button
              type="submit"
              size="lg"
              className="w-full min-h-[44px]"
              disabled={isSubmitting || !selectedPlan || !isStripeReady}
            >
              {isSubmitting
                ? "Processing secure payment..."
                : selectedPlanDetails
                  ? `Pay $${selectedPlanDetails.price} & Create Account`
                  : "Create Account & Start"
              }
            </Button>
          </div>
        </form>
      </Form>
      <SalesSuccessModal
        open={showSuccessModal}
        onOpenChange={setShowSuccessModal}
        onDone={() => {
          setShowSuccessModal(false);
          form.reset();
          setSuccessData(null);
          // Stay on sales page so sales rep can create another account
        }}
        data={successData}
      />
    </>
  );
}

// Main component wrapped in Stripe Elements
export function SalesSignupForm() {
  return (
    <Elements stripe={stripePromise}>
      <SalesSignupFormInner />
    </Elements>
  );
}
