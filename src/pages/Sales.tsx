import { useState } from "react";
import { jsPDF } from 'jspdf';
import { Helmet } from 'react-helmet-async';
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { SalesPasswordGate } from "@/components/SalesPasswordGate";
import { CallValueCalculator } from "@/components/CallValueCalculator";
import { VoiceDemoWidget } from "@/components/VoiceDemoWidget";
import { SalesSignupForm } from "@/components/SalesSignupForm";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import RSLogo from "@/assets/RS_logo_color.svg";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY!);

export default function Sales() {
  const [companyName, setCompanyName] = useState("");
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);

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
    doc.text('RingSnap - Virtual Receptionist for Contractors', pageWidth / 2, 280, { align: 'center' });
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

      <div className="min-h-screen bg-background">
        {/* Header with Logo */}
        <header className="border-b border-border bg-white sticky top-0 z-50 shadow-sm">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <img
                src={RSLogo}
                alt="RingSnap Logo"
                className="h-8 sm:h-10 w-auto"
              />
              <div className="text-sm text-muted-foreground">
                Sales Workspace
              </div>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="bg-gradient-to-b from-background to-muted/20 py-12 sm:py-16 lg:py-20">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-4xl mx-auto space-y-6">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
                Experience RingSnap Live
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
                See how our Virtual Receptionist handles calls 24/7, captures every lead, and helps contractors never miss an opportunity.
              </p>
              <div className="pt-4">
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-white text-lg px-8 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
                  onClick={() => setShowDemoModal(true)}
                >
                  <svg
                    className="w-6 h-6 mr-2"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Start Live Demo
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* ROI Calculator Section */}
        <section className="bg-background">
          <CallValueCalculator
            showPdfDownload={true}
            companyName={companyName}
            onPdfDownload={handlePdfDownload}
          />
        </section>

        {/* CTA Section */}
        <section className="py-16 sm:py-20 lg:py-24 bg-gradient-to-b from-muted/20 to-background">
          <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="text-center space-y-8">
              <div className="space-y-4">
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground">
                  Ready to Get Started?
                </h2>
                <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
                  Set up a new customer account in minutes. Complete onboarding, plan selection, and payment all in one seamless flow.
                </p>
              </div>
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 text-white text-xl px-12 py-7 rounded-2xl shadow-xl hover:shadow-2xl transition-all transform hover:scale-105"
                onClick={() => setShowSignupModal(true)}
              >
                Start Sign-Up
              </Button>
            </div>
          </div>
        </section>

        {/* Bottom padding */}
        <div className="pb-16"></div>
      </div>

      {/* Demo Modal */}
      <Dialog open={showDemoModal} onOpenChange={setShowDemoModal}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <VoiceDemoWidget />
        </DialogContent>
      </Dialog>

      {/* Signup Modal */}
      <Dialog open={showSignupModal} onOpenChange={setShowSignupModal}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <div className="py-4">
            <Elements stripe={stripePromise}>
              <SalesSignupForm />
            </Elements>
          </div>
        </DialogContent>
      </Dialog>
    </SalesPasswordGate>
  );
}
