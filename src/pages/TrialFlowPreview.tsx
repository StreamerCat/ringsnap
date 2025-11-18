import { useState } from "react";
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle, Info, Sparkles, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

import { SelfServeTrialFlow } from "@/components/onboarding/SelfServeTrialFlow";

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

/**
 * Preview/Test Page for Trial Signup Flow
 *
 * This page demonstrates the trial flow improvements:
 * - Smart email detection
 * - Enhanced validation messages
 * - Visual feedback
 * - Better copy and UX
 */
export default function TrialFlowPreview() {
  const [showFlow, setShowFlow] = useState(false);

  return (
    <Elements stripe={stripePromise}>
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background">
        {/* Header */}
        <div className="bg-background border-b sticky top-0 z-50">
          <div className="container max-w-5xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link to="/">
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Homepage
                  </Button>
                </Link>
                <div>
                  <h1 className="text-2xl font-bold flex items-center gap-2">
                    Trial Flow Preview
                    <Badge variant="secondary" className="text-xs">
                      Test Mode
                    </Badge>
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Test the enhanced trial signup flow
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
                    <span><strong>Enhanced UX</strong> - Better copy and help text</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="container max-w-5xl mx-auto px-4 py-8">
          <Alert className="mb-6">
            <Info className="h-4 w-4" />
            <AlertTitle>Try Smart Email Detection!</AlertTitle>
            <AlertDescription>
              When you reach the User Info step, try entering a business email like{" "}
              <code className="bg-muted px-1 py-0.5 rounded">john@acmeplumbing.com</code>.
              In the next step, watch as Company Name and Website automatically populate! 🎉
            </AlertDescription>
          </Alert>

          {!showFlow ? (
            <Card className="max-w-2xl mx-auto">
              <CardHeader className="text-center">
                <CardTitle className="text-3xl">Start Your Free Trial</CardTitle>
                <CardDescription className="text-base">
                  Experience the enhanced signup flow with smart email detection and better UX
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold">Smart Auto-Fill</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Business emails automatically populate company details
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold">Visual Feedback</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        See green checkmarks as you complete each field
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold">Better Errors</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Clear messages with examples show exactly what's needed
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold">Preview Mode</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Safe testing - no real accounts or charges created
                      </p>
                    </div>
                  </div>
                </div>

                <Alert className="border-primary bg-primary/5">
                  <Info className="h-4 w-4" />
                  <AlertTitle>This is a Preview</AlertTitle>
                  <AlertDescription>
                    This demonstration uses enhanced form components with improved validation and UX.
                    No actual trial accounts will be created.
                  </AlertDescription>
                </Alert>

                <Button
                  size="lg"
                  className="w-full min-h-[44px]"
                  onClick={() => setShowFlow(true)}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Launch Enhanced Trial Flow
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Click to see the multi-step dialog with all improvements
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="max-w-4xl mx-auto space-y-6">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Enhanced Trial Flow Active</AlertTitle>
                <AlertDescription>
                  You're now experiencing the improved signup flow. Notice the smart email detection,
                  visual feedback, and helpful validation messages as you progress through each step.
                </AlertDescription>
              </Alert>

              <div className="flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => setShowFlow(false)}
                >
                  Close Preview
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Trial Flow Dialog */}
        <SelfServeTrialFlow
          open={showFlow}
          onOpenChange={setShowFlow}
          onSuccess={() => {
            setShowFlow(false);
            // In preview mode, don't actually navigate
          }}
        />
      </div>
    </Elements>
  );
}
