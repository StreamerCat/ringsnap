import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/components/ui/use-toast";
import { CheckCircle2, Lock, CreditCard, Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useUser } from "@/lib/auth/useUser";
import { SalesSuccessModal, type SalesSuccessModalData } from "@/components/SalesSuccessModal";
import { TRADES } from "@/components/wizard/types";

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
  phone: z.string().trim().regex(/^(\+1[\s\-]?)?(\(?\d{3}\)?[\s\-]?)\d{3}[\s\-]?\d{4}$/, "Enter a valid US phone number"),
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

// Plan data
const plans = [
  {
    value: 'starter' as const,
    name: 'Starter',
    price: 297,
    calls: '≤80',
    features: ['Basic AI voice', '24/7 coverage', 'Email support']
  },
  {
    value: 'professional' as const,
    name: 'Professional',
    price: 797,
    calls: '≤160',
    features: ['Advanced AI voice', 'Priority routing', 'Phone support']
  },
  {
    value: 'premium' as const,
    name: 'Premium',
    price: 1497,
    calls: '>160',
    features: ['Voice cloning', 'Dedicated support', 'Custom integrations']
  }
];

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
// Inner form component that has access to Stripe
function SalesSignupFormInner() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardComplete, setCardComplete] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState<SalesSuccessModalData | null>(null);
  const [customTrade, setCustomTrade] = useState("");
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
  const selectedTrade = form.watch('trade');
  const selectedPlanDetails = plans.find(p => p.value === selectedPlan);

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

  const daysOfWeek = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Customer Info Section */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                {...form.register("name")}
                placeholder="John Smith"
                className="text-base"
              />
              {form.formState.errors.name && (
                <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                {...form.register("email")}
                placeholder="john@example.com"
                className="text-base"
              />
              {form.formState.errors.email && (
                <p className="text-sm text-red-500">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                {...form.register("phone")}
                placeholder="(555) 123-4567"
                maxLength={17}
                className="text-base"
              />
              {form.formState.errors.phone && (
                <p className="text-sm text-red-500">{form.formState.errors.phone.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name *</Label>
              <Input
                id="companyName"
                {...form.register("companyName")}
                placeholder="ABC Plumbing"
                className="text-base"
              />
              {form.formState.errors.companyName && (
                <p className="text-sm text-red-500">{form.formState.errors.companyName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Company Website *</Label>
              <Input
                id="website"
                {...form.register("website")}
                placeholder="yourcompany.com or company@domain.com"
                className="text-base"
              />
              {form.formState.errors.website && (
                <p className="text-sm text-red-500">{form.formState.errors.website.message}</p>
              )}
            </div>

            <FormField
              control={form.control}
              name="trade"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Trade *</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      if (value === "other") {
                        field.onChange("other");
                        setCustomTrade("");
                      } else {
                        field.onChange(value);
                      }
                    }}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="text-base">
                        <SelectValue placeholder="Select your trade" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TRADES.map((trade) => (
                        <SelectItem key={trade.value} value={trade.value}>
                          {trade.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedTrade === "other" && (
                    <Input
                      value={customTrade}
                      onChange={(e) => {
                        const value = e.target.value;
                        setCustomTrade(value);
                        field.onChange(value);
                      }}
                      placeholder="Enter your trade or industry"
                      className="text-base mt-2"
                    />
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Business Details Section */}
        <Card>
          <CardHeader>
            <CardTitle>Business Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="serviceArea">Service Area *</Label>
              <Input
                id="serviceArea"
                {...form.register("serviceArea")}
                placeholder="Dallas/Fort Worth Metro"
                className="text-base"
              />
              {form.formState.errors.serviceArea && (
                <p className="text-sm text-red-500">{form.formState.errors.serviceArea.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Business Hours *</Label>
              <div className="grid grid-cols-1 gap-2 rounded-lg border p-4">
                {daysOfWeek.map((day) => (
                  <FormField
                    key={day}
                    control={form.control}
                    name={`businessHours.${day}`}
                    render={({ field }) => (
                      <FormItem className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between rounded-md p-2 transition-colors hover:bg-muted/50">
                        <div className="flex items-center gap-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value.open}
                              onCheckedChange={(checked) => {
                                field.onChange({ ...field.value, open: !!checked });
                              }}
                            />
                          </FormControl>
                          <span className="w-20 font-medium capitalize">{day}</span>
                        </div>
                        <div className={`flex items-center gap-2 ${field.value.open ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                          <Input
                            type="time"
                            value={field.value.openTime}
                            onChange={(e) => field.onChange({ ...field.value, openTime: e.target.value })}
                            className="h-9 w-32"
                            disabled={!field.value.open}
                          />
                          <span className="text-muted-foreground">-</span>
                          <Input
                            type="time"
                            value={field.value.closeTime}
                            onChange={(e) => field.onChange({ ...field.value, closeTime: e.target.value })}
                            className="h-9 w-32"
                            disabled={!field.value.open}
                          />
                        </div>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
              {form.formState.errors.businessHours && (
                <p className="text-sm text-red-500">Please review business hours settings.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="emergencyPolicy">Emergency Call Policy *</Label>
              <Textarea
                id="emergencyPolicy"
                {...form.register("emergencyPolicy")}
                placeholder="Describe how emergency calls should be handled..."
                className="text-base min-h-[100px]"
              />
              {form.formState.errors.emergencyPolicy && (
                <p className="text-sm text-red-500">{form.formState.errors.emergencyPolicy.message}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="zipCode">ZIP Code *</Label>
                <Input
                  id="zipCode"
                  {...form.register("zipCode")}
                  placeholder="12345"
                  className="text-base"
                />
                {form.formState.errors.zipCode && (
                  <p className="text-sm text-red-500">{form.formState.errors.zipCode.message}</p>
                )}
              </div>

              <FormField
                control={form.control}
                name="assistantGender"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Assistant Voice</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="female" id="sales-female" />
                          <label htmlFor="sales-female" className="text-sm cursor-pointer">Female</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="male" id="sales-male" />
                          <label htmlFor="sales-male" className="text-sm cursor-pointer">Male</label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="referralCode">Referral Code</Label>
              <Input
                id="referralCode"
                {...form.register("referralCode")}
                placeholder="Enter referral code (optional)"
                className="text-base uppercase"
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  form.setValue('referralCode', val);
                }}
              />
              {form.formState.errors.referralCode && (
                <p className="text-sm text-red-500">{form.formState.errors.referralCode.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Plan Selection Section */}
        <Card>
          <CardHeader>
            <CardTitle>Select Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-3">
              {plans.map(plan => (
                <button
                  key={plan.value}
                  type="button"
                  onClick={() => {
                    form.setValue('planType', plan.value, { shouldValidate: true });
                    form.clearErrors('planType');
                  }}
                  className={cn(
                    "p-5 sm:p-6 rounded-2xl border-2 text-left transition-all touch-manipulation min-h-[56px] w-full",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary",
                    "hover:scale-[1.02] active:scale-95",
                    selectedPlan === plan.value
                      ? "border-primary bg-primary/5 shadow-lg"
                      : "border-slate-200 hover:border-primary/50"
                  )}
                >
                  <div className="text-lg font-bold">{plan.name}</div>
                  <div className="text-2xl font-bold text-primary mt-2">${plan.price}/mo</div>
                  <div className="text-sm text-muted-foreground mt-1">{plan.calls} calls/mo</div>
                  <ul className="mt-4 space-y-2">
                    {plan.features.map(feature => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
            {form.formState.errors.planType && (
              <p className="text-sm text-red-500 mt-2">{form.formState.errors.planType.message}</p>
            )}
          </CardContent>
        </Card>

        {/* Sales Rep Section */}
        <Card>
          <CardHeader>
            <CardTitle>Sales Representative</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="salesRepName">Sales Rep Name *</Label>
              <Input
                id="salesRepName"
                {...form.register("salesRepName")}
                placeholder="Your name"
                className="text-base"
              />
              {form.formState.errors.salesRepName && (
                <p className="text-sm text-red-500">{form.formState.errors.salesRepName.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Order Summary Card */}
        {selectedPlanDetails && (
          <Card className="border-2 border-primary/20">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg">{selectedPlanDetails.name} Plan</h3>
                  <p className="text-sm text-muted-foreground">{selectedPlanDetails.calls} calls/month</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-primary">${selectedPlanDetails.price}</div>
                  <div className="text-sm text-muted-foreground">per month</div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t">
                <p className="text-sm font-medium">Included features:</p>
                {selectedPlanDetails.features.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Billing cycle:</span>
                  <span className="font-medium">Monthly</span>
                </div>
                <div className="flex justify-between text-base">
                  <span className="font-semibold">Due today:</span>
                  <span className="font-bold text-primary">${selectedPlanDetails.price}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Section */}
        {!isStripeReady ? (
          <Card>
            <CardContent className="py-8">
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <p className="text-sm text-muted-foreground">Loading secure payment...</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CardTitle>Payment Information</CardTitle>
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">All transactions are secure and encrypted</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-2 text-sm">
                  <Lock className="h-4 w-4 text-emerald-600" />
                  <span className="font-medium">Secure checkout</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">Powered by Stripe</span>
                  <div className="flex gap-1">
                    {[1,2,3,4].map(i => <CreditCard key={i} className="h-4 w-4 text-muted-foreground" />)}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-base">Card information</Label>
                  <p className="text-xs text-muted-foreground mt-1">Securely enter your card number, expiry, and CVC</p>
                </div>
                <div className="rounded-lg border-2 border-input px-4 py-3 bg-background transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                  <CardElement
                    onChange={(event) => {
                      setCardComplete(event.complete);
                      setCardError(event.error ? event.error.message ?? "" : null);
                    }}
                    options={{
                      style: {
                        base: {
                          color: '#2C3639',
                          fontSize: '16px',
                          fontFamily: 'system-ui, -apple-system, sans-serif',
                          fontSmoothing: 'antialiased',
                          '::placeholder': { color: '#88A096' },
                        },
                        invalid: { color: '#ef4444' },
                      },
                      hidePostalCode: true,
                    }}
                  />
                </div>
                {cardError && <p className="text-sm text-red-500 flex items-center gap-1">{cardError}</p>}
              </div>

              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
                <Lock className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <p>Your payment information is encrypted and secure. We never store your card details.</p>
              </div>
            </CardContent>
          </Card>
        )}

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
