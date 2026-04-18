import { useState } from "react";
import { IS_DEV } from "@/lib/analytics";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, CheckCircle, Info, Sparkles, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

import { CustomerInfoSection } from "@/components/sales/sections/CustomerInfoSection";
import { BusinessDetailsSection } from "@/components/sales/sections/BusinessDetailsSection";
import { PlanSelectionSection } from "@/components/sales/sections/PlanSelectionSection";
import { SalesRepSection } from "@/components/sales/sections/SalesRepSection";
import { PaymentSection } from "@/components/sales/sections/PaymentSection";

import { enhancedSalesSignupSchema } from "@/components/signup/shared/enhanced-schemas";
import { SalesFormData } from "@/components/sales/types";

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

/**
 * Preview/Test Page for New Signup Form Components
 *
 * This page demonstrates all the new improvements:
 * - Smart email detection
 * - Enhanced validation messages
 * - Modular components
 * - Visual feedback
 * - Better copy and UX
 */
function FormPreviewInner() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const form = useForm<SalesFormData>({
    resolver: zodResolver(enhancedSalesSignupSchema),
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

  const onSubmit = async (data: SalesFormData) => {
    setIsSubmitting(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (IS_DEV) console.log("Form Data (Preview Mode - Not Submitted):", data);

    setShowSuccess(true);
    setIsSubmitting(false);
  };

  const handleCardChange = (complete: boolean, error: string | null) => {
    setCardComplete(complete);
    setCardError(error);
  };

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full border-2 border-primary">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
            </div>
            <CardTitle className="text-2xl">Preview Mode - Form Validated! ✅</CardTitle>
            <CardDescription className="text-base">
              All form fields passed validation successfully
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>This is a preview/test page</AlertTitle>
              <AlertDescription>
                No data was submitted to the server. Check the browser console to see the validated form data.
              </AlertDescription>
            </Alert>
            <div className="flex gap-4 justify-center">
              <Button onClick={() => setShowSuccess(false)} variant="outline">
                Test Again
              </Button>
              <Link to="/sales">
                <Button>
                  Go to Production Form
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background">
      {/* Header */}
      <div className="bg-background border-b sticky top-0 z-50">
        <div className="container max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/sales">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Sales Form
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  Form Preview
                  <Badge variant="secondary" className="text-xs">
                    Test Mode
                  </Badge>
                </h1>
                <p className="text-sm text-muted-foreground">
                  Test the new signup form improvements
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Highlights Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-b">
        <div className="container max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h2 className="font-semibold text-lg mb-2">✨ What's New in This Preview</h2>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Smart Email Detection</strong> - Auto-fills company & website</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Better Error Messages</strong> - Clear, actionable guidance</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Visual Feedback</strong> - Green checkmarks on valid fields</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Modular Components</strong> - Easier to maintain</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Test Instructions */}
      <div className="container max-w-5xl mx-auto px-4 py-6">
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertTitle>Try Smart Email Detection!</AlertTitle>
          <AlertDescription>
            Enter a business email like <code className="bg-muted px-1 py-0.5 rounded">john@acmeplumbing.com</code> in the email field below.
            Watch as the Company Name and Website fields automatically populate! 🎉
          </AlertDescription>
        </Alert>
      </div>

      {/* Form */}
      <div className="container max-w-5xl mx-auto px-4 pb-16">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <CustomerInfoSection form={form} isSubmitting={isSubmitting} />
            <BusinessDetailsSection form={form} isSubmitting={isSubmitting} />
            <PlanSelectionSection form={form} isSubmitting={isSubmitting} />
            <SalesRepSection form={form} isSubmitting={isSubmitting} />
            <PaymentSection
              form={form}
              isSubmitting={isSubmitting}
              onCardChange={handleCardChange}
            />

            {/* Preview Mode Notice */}
            <Alert className="border-primary bg-primary/5">
              <Info className="h-4 w-4" />
              <AlertTitle>Preview Mode - No Data Will Be Submitted</AlertTitle>
              <AlertDescription>
                This form will only validate your inputs. No account will be created and no payment will be processed.
                Check the browser console after clicking submit to see the validated data.
              </AlertDescription>
            </Alert>

            {/* Submit Button */}
            <div className="space-y-4">
              <Button
                type="submit"
                size="lg"
                className="w-full min-h-[44px]"
                disabled={isSubmitting || !form.watch("planType")}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validating form...
                  </>
                ) : (
                  "Test Form Validation"
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Preview mode - no data will be submitted to the server
              </p>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}

// Main component wrapped in Stripe Elements
export default function FormPreview() {
  return (
    <Elements stripe={stripePromise}>
      <FormPreviewInner />
    </Elements>
  );
}
