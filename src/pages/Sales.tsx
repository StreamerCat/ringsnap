import { useState } from "react";
import { jsPDF } from 'jspdf';
import { Helmet } from 'react-helmet';
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SalesPasswordGate } from "@/components/SalesPasswordGate";
import { SalesGuidedTrialFlowEmbedded } from "@/components/onboarding/SalesGuidedTrialFlowEmbedded";
import { CallValueCalculator } from "@/components/CallValueCalculator";
import { VapiDemoWidget } from "@/components/VapiDemoWidget";
import { Users, Calculator, Phone } from "lucide-react";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY!);

export default function Sales() {
  const [companyName, setCompanyName] = useState("");

  const handlePdfDownload = (metrics: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(22);
    doc.setTextColor(217, 119, 87); // Primary color
    doc.text('RingSnap ROI Report', pageWidth / 2, 20, { align: 'center' });

    // Company info
    doc.setFontSize(12);
    doc.setTextColor(44, 54, 57); // Charcoal
    doc.text(`Company: ${companyName}`, 20, 35);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 42);

    // Metrics section
    doc.setFontSize(16);
    doc.text('Revenue Impact Analysis', 20, 55);

    doc.setFontSize(12);
    let y = 68;
    const metricsData = [
      { label: 'Recovered Revenue (Monthly)', value: `$${metrics.recoveredRevenue.toLocaleString()}` },
      { label: 'Net Profit Lift', value: `$${metrics.netGain.toLocaleString()}` },
      { label: 'Return on Investment', value: `${metrics.roi}%` },
      { label: 'Payback Period', value: `${metrics.paybackDays} days` },
      { label: 'Monthly Investment', value: `$${metrics.aiCost.toLocaleString()}` },
      { label: 'Missed Calls Recovered', value: `${metrics.recoveredCallCapture}` }
    ];

    metricsData.forEach(metric => {
      doc.text(`${metric.label}:`, 20, y);
      doc.setFont(undefined, 'bold');
      doc.text(metric.value, 120, y);
      doc.setFont(undefined, 'normal');
      y += 10;
    });

    // Footer
    doc.setFontSize(10);
    doc.setTextColor(128, 128, 128);
    doc.text('RingSnap - AI Receptionist for Contractors', pageWidth / 2, 280, { align: 'center' });
    doc.text('www.getringsnap.com', pageWidth / 2, 287, { align: 'center' });

    // Save
    doc.save(`ringsnap-roi-${companyName.toLowerCase().replace(/\s+/g, '-')}.pdf`);
  };

  return (
    <SalesPasswordGate>
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
        <title>Sales Workspace - RingSnap</title>
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
        {/* Header Section */}
        <section className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-b border-primary/10">
          <div className="container mx-auto max-w-7xl px-4 py-8 sm:py-10">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 bg-primary/15 rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
                    Sales Workspace
                  </h1>
                </div>
                <p className="text-base sm:text-lg text-muted-foreground max-w-2xl">
                  Create new customer accounts and start trials. Use this page to onboard customers during sales calls or in-person meetings.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Main Content - Two Column Layout */}
        <section className="py-8 sm:py-12 px-4">
          <div className="container mx-auto max-w-7xl">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Left Column - Customer Onboarding Form (2 cols on large screens) */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="border-primary/20">
                  <CardHeader className="bg-primary/5 border-b border-primary/10">
                    <CardTitle className="text-xl text-foreground">Customer Onboarding</CardTitle>
                    <CardDescription>
                      Guide customers through account creation, plan selection, and activation
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <Elements stripe={stripePromise}>
                      <SalesGuidedTrialFlowEmbedded />
                    </Elements>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column - Tools & Demo (1 col on large screens) */}
              <div className="lg:col-span-1 space-y-6">
                {/* ROI Calculator */}
                <Card className="border-primary/20 bg-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Calculator className="w-5 h-5 text-primary" />
                      <CardTitle className="text-lg">ROI Calculator</CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                      Show customers their potential revenue recovery
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Customer Company Name
                      </label>
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Enter company name"
                        className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                      />
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Used for personalized PDF reports
                      </p>
                    </div>

                    <div className="pt-2">
                      <a
                        href="#calculator"
                        className="text-sm text-primary hover:text-primary/80 underline underline-offset-4 inline-flex items-center gap-1"
                      >
                        Open Full Calculator Below
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </a>
                    </div>
                  </CardContent>
                </Card>

                {/* Demo Widget */}
                <Card className="border-primary/20 bg-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Phone className="w-5 h-5 text-primary" />
                      <CardTitle className="text-lg">AI Demo</CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                      Let customers experience the AI receptionist
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <VapiDemoWidget />
                  </CardContent>
                </Card>

                {/* Quick Tips */}
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-primary">Sales Tips</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <span className="text-primary font-bold shrink-0">1.</span>
                        <span>Run the demo first to build excitement</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary font-bold shrink-0">2.</span>
                        <span>Use the calculator to show ROI</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary font-bold shrink-0">3.</span>
                        <span>Complete onboarding while they're engaged</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary font-bold shrink-0">4.</span>
                        <span>Have them test-call their new AI number</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Full ROI Calculator Section */}
        <div className="bg-background">
          <CallValueCalculator
            showPdfDownload={true}
            companyName={companyName}
            onPdfDownload={handlePdfDownload}
          />
        </div>

        {/* Bottom Padding */}
        <div className="pb-12"></div>
      </div>
    </SalesPasswordGate>
  );
}
