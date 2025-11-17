import { Helmet } from 'react-helmet';
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SalesPasswordGate } from "@/components/SalesPasswordGate";
import { SalesGuidedTrialFlowEmbedded } from "@/components/onboarding/SalesGuidedTrialFlowEmbedded";
import { Users, TrendingUp } from "lucide-react";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY!);

export default function Sales() {
  return (
    <SalesPasswordGate>
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
        <title>Sales Workspace - RingSnap</title>
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
        {/* Header Section */}
        <section className="bg-white border-b">
          <div className="container mx-auto max-w-7xl px-4 py-8 sm:py-12">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
                    Sales Workspace
                  </h1>
                </div>
                <p className="text-base sm:text-lg text-muted-foreground max-w-2xl">
                  Create new customer accounts and start trials. Use this page to onboard customers during sales calls or in-person meetings.
                </p>
              </div>
              <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground bg-slate-50 px-4 py-2 rounded-lg">
                <TrendingUp className="w-4 h-4" />
                <span>Staff Access</span>
              </div>
            </div>
          </div>
        </section>

        {/* Main Content */}
        <section className="py-8 sm:py-12 px-4">
          <div className="container mx-auto max-w-5xl">
            {/* Info Card */}
            <Card className="mb-8 border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-lg">Quick Start Guide</CardTitle>
                <CardDescription>
                  Follow these steps to onboard a new customer:
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="font-semibold text-primary">1.</span>
                    <span>Collect customer information and business details</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-semibold text-primary">2.</span>
                    <span>Help them select the right plan for their needs</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-semibold text-primary">3.</span>
                    <span>Process payment and activate their account</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-semibold text-primary">4.</span>
                    <span>Demo the AI receptionist with their new phone number</span>
                  </li>
                </ol>
              </CardContent>
            </Card>

            {/* Embedded Signup Form */}
            <Elements stripe={stripePromise}>
              <SalesGuidedTrialFlowEmbedded />
            </Elements>
          </div>
        </section>

        {/* Bottom Padding */}
        <div className="pb-12"></div>
      </div>
    </SalesPasswordGate>
  );
}
