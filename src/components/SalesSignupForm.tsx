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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder');

// Form schema
const salesFormSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(100),
  email: z.string().trim().email("Invalid email").max(255),
  phone: z.string().trim().min(10, "Phone required").max(20),
  companyName: z.string().trim().min(1, "Company name required").max(200),
  trade: z.string().min(1, "Trade required"),
  serviceArea: z.string().trim().min(1, "Service area required").max(200),
  businessHours: z.string().trim().min(1, "Business hours required"),
  emergencyPolicy: z.string().trim().min(10, "Emergency policy required").max(1000),
  planType: z.enum(['starter', 'professional', 'premium']),
  salesRepName: z.string().trim().min(1, "Sales rep name required").max(100),
  skipPayment: z.boolean().default(false)
});

type FormData = z.infer<typeof salesFormSchema>;

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

// Parse business hours text to JSONB
function parseBusinessHours(hoursText: string): object {
  try {
    // If it's already JSON, parse it
    return JSON.parse(hoursText);
  } catch {
    // Otherwise, return as a simple text field
    return { text: hoursText };
  }
}

// Inner form component that has access to Stripe
function SalesSignupFormInner() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const stripe = useStripe();
  const elements = useElements();

  const form = useForm<FormData>({
    resolver: zodResolver(salesFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      companyName: "",
      trade: "",
      serviceArea: "",
      businessHours: "",
      emergencyPolicy: "",
      planType: "starter",
      salesRepName: "",
      skipPayment: false
    }
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      let paymentMethodId = null;

      // Create payment method if not skipping payment
      if (!data.skipPayment && stripe && elements) {
        const cardElement = elements.getElement(CardElement);
        if (!cardElement) {
          throw new Error("Card element not found");
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

        if (stripeError) {
          throw new Error(stripeError.message);
        }
        paymentMethodId = paymentMethod.id;
      }

      // Call edge function
      const { data: result, error: functionError } = await supabase.functions.invoke(
        'create-sales-account',
        {
          body: {
            customerInfo: {
              name: data.name,
              email: data.email,
              phone: data.phone,
              companyName: data.companyName,
              trade: data.trade,
              serviceArea: data.serviceArea,
              businessHours: parseBusinessHours(data.businessHours),
              emergencyPolicy: data.emergencyPolicy,
              salesRepName: data.salesRepName,
              planType: data.planType
            },
            paymentMethodId,
            skipPayment: data.skipPayment
          }
        }
      );

      if (functionError) throw functionError;

      // Show success with temp password
      toast({
        title: "Account Created!",
        description: `Login credentials sent to ${data.email}. Temp password: ${result.tempPassword}`,
        duration: 10000
      });

      // Redirect to onboarding
      setTimeout(() => {
        navigate('/onboarding');
      }, 2000);

    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
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

          <FormField
            control={form.control}
            name="trade"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Trade *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="text-base">
                      <SelectValue placeholder="Select your trade" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="hvac">HVAC</SelectItem>
                    <SelectItem value="plumbing">Plumbing</SelectItem>
                    <SelectItem value="electrician">Electrician</SelectItem>
                    <SelectItem value="landscaping">Landscaping</SelectItem>
                    <SelectItem value="general_contractor">General Contractor</SelectItem>
                    <SelectItem value="roofing">Roofing</SelectItem>
                    <SelectItem value="pest_control">Pest Control</SelectItem>
                    <SelectItem value="garage_door">Garage Door Repair</SelectItem>
                    <SelectItem value="carpentry">Carpentry</SelectItem>
                    <SelectItem value="painting">Painting</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
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
            <Label htmlFor="businessHours">Business Hours *</Label>
            <Input
              id="businessHours"
              {...form.register("businessHours")}
              placeholder="Mon-Fri 8am-5pm"
              className="text-base"
            />
            {form.formState.errors.businessHours && (
              <p className="text-sm text-red-500">{form.formState.errors.businessHours.message}</p>
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
        </CardContent>
      </Card>

      {/* Plan Selection Section */}
      <Card>
        <CardHeader>
          <CardTitle>Select Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            {plans.map(plan => (
              <button
                key={plan.value}
                type="button"
                onClick={() => form.setValue('planType', plan.value)}
                className={cn(
                  "p-4 sm:p-6 rounded-xl border-2 text-left transition-all touch-manipulation min-h-[44px]",
                  "hover:scale-[1.02] active:scale-95",
                  form.watch('planType') === plan.value
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

      {/* Payment Section */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="skipPayment">Skip Payment (Trial Mode)</Label>
              <p className="text-sm text-muted-foreground">Create account without payment capture</p>
            </div>
            <Switch
              id="skipPayment"
              checked={form.watch('skipPayment')}
              onCheckedChange={(checked) => form.setValue('skipPayment', checked)}
            />
          </div>

          {!form.watch('skipPayment') && (
            <div className="space-y-2">
              <Label>Card Details</Label>
              <div className="border rounded-lg p-3 bg-white">
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
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-600">
          {error}
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        size="lg"
        className="w-full min-h-[44px]"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Creating Account..." : "Create Account & Start"}
      </Button>
    </form>
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
