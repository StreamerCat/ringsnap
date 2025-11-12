import { useState } from "react";
import { jsPDF } from 'jspdf';
import { Helmet } from 'react-helmet';
import { Card, CardContent } from "@/components/ui/card";
import { CallValueCalculator } from "@/components/CallValueCalculator";
import { UnifiedSignupRouter } from "@/components/signup/UnifiedSignupRouter";
import { SalesPasswordGate } from "@/components/SalesPasswordGate";
import Vapi from "@vapi-ai/web";
import { useEffect, useRef } from "react";

// Reused VapiWidget component
const VapiWidget = () => {
  const [isCallActive, setIsCallActive] = useState(false);
  const [vapiConfig, setVapiConfig] = useState<{ publicKey: string; assistantId: string } | null>(null);
  const vapiRef = useRef<Vapi | null>(null);

  useEffect(() => {
    // Fetch Vapi configuration from server
    const loadVapiConfig = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vapi-demo-call`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.error('Failed to load Vapi config');
          return;
        }

        const data = await response.json();
        setVapiConfig(data);

        // Initialize Vapi instance with server-provided key
        vapiRef.current = new Vapi(data.publicKey);

        // Event listeners
        const handleCallStart = () => setIsCallActive(true);
        const handleCallEnd = () => setIsCallActive(false);
        vapiRef.current.on("call-start", handleCallStart);
        vapiRef.current.on("call-end", handleCallEnd);
      } catch (error) {
        console.error('Error loading Vapi config:', error);
      }
    };

    loadVapiConfig();

    return () => {
      vapiRef.current?.stop();
    };
  }, []);

  const startCall = () => {
    if (vapiConfig) {
      vapiRef.current?.start(vapiConfig.assistantId);
    }
  };

  const endCall = () => {
    vapiRef.current?.stop();
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
      {!isCallActive ? (
        <div className="space-y-6 max-w-2xl mx-auto">
          <div className="text-center space-y-3">
            <h3 className="text-3xl sm:text-4xl font-bold leading-tight text-[#2C3639]">
              Let Your Customer Experience RingSnap
            </h3>
            <p className="text-base text-muted-foreground max-w-xl mx-auto">
              Click below to start a live conversation with the AI receptionist. Try asking about services, pricing, or booking an appointment.
            </p>
          </div>

          <div className="space-y-4">
            <button
              onClick={startCall}
              className="w-full bg-[#D97757] text-white px-8 py-5 rounded-2xl text-xl font-semibold hover:opacity-90 transition-all shadow-xl hover:shadow-2xl hover:scale-[1.02] transform duration-200 flex items-center justify-center gap-3 group"
            >
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <span>Start Demo Call</span>
            </button>

            <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-muted-foreground/80 italic">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
              <span>Enable your microphone to talk with the AI</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-[#D97757] rounded-full mx-auto mb-4 flex items-center justify-center animate-pulse">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
            </div>
            <p className="text-xl font-semibold text-[#2C3639]">Call in Progress</p>
            <p className="text-sm text-muted-foreground mt-2">AI receptionist is listening...</p>
          </div>
          <button
            onClick={endCall}
            className="bg-red-600 text-white px-8 py-4 rounded-full text-lg font-semibold hover:bg-red-700 transition-colors shadow-lg"
          >
            End Conversation
          </button>
        </div>
      )}
    </div>
  );
};

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
      </Helmet>
      <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-slate-100 to-slate-50 py-12 sm:py-16 px-4">
        <div className="container mx-auto max-w-7xl text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            Sales Demo & Customer Onboarding
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto">
            Interactive demo → ROI calculator → Instant onboarding. Everything you need to close deals faster.
          </p>
        </div>
      </section>

      {/* Demo Section */}
      <section className="py-12 sm:py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <Card className="border-2 shadow-xl">
            <CardContent className="p-0">
              <div className="bg-primary/5 p-6 border-b">
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
                  Try the AI Receptionist
                </h2>
                <p className="text-muted-foreground">
                  Let your customer experience how RingSnap handles their calls
                </p>
              </div>
              <div className="min-h-[400px] sm:min-h-[500px] bg-[#FAF9F6] flex items-center justify-center">
                <VapiWidget />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Calculator Section */}
      <section className="py-12 sm:py-16 px-4 bg-white">
        <div className="container mx-auto max-w-5xl mb-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
              Calculate Their ROI
            </h2>
            <p className="text-muted-foreground">
              Show them the numbers that matter
            </p>
          </div>

          {/* Company Name Input for PDF */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Company Name (for ROI Report)
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Enter customer's company name"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </CardContent>
          </Card>
        </div>

        <CallValueCalculator
          showPdfDownload={true}
          companyName={companyName}
          onPdfDownload={handlePdfDownload}
        />
      </section>

      {/* Signup Form Section */}
      <section className="py-12 sm:py-16 px-4 bg-slate-50">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
              Complete Onboarding
            </h2>
            <p className="text-muted-foreground">
              Capture all details and start their trial or subscription
            </p>
          </div>

          <UnifiedSignupRouter mode="sales" />
        </div>
      </section>

      {/* Bottom Padding for Mobile */}
      <div className="pb-20"></div>
      </div>
    </SalesPasswordGate>
  );
}
