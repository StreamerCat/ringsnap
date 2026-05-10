import { Helmet } from "react-helmet-async";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { capture } from "@/lib/analytics";
import { ResourceDownloadModal } from "@/components/resources/ResourceDownloadModal";
import { trackPageLoad, trackFunnelEvent, trackClick } from "@/lib/sentry-tracking";
import * as Sentry from "@sentry/react";
import {
  PhoneMissed,
  PhoneCall,
  Clock,
  Zap,
  CheckCircle2,
  ArrowRight,
  Wrench,
  Thermometer,
  Waves,
  Home,
  AlertTriangle,
  DollarSign,
} from "lucide-react";

const CallValueCalculator = lazy(() =>
  import("@/components/CallValueCalculator").then((m) => ({
    default: m.CallValueCalculator,
  }))
);
const VoiceDemoWidget = lazy(() =>
  import("@/components/VoiceDemoWidget").then((m) => ({
    default: m.VoiceDemoWidget,
  }))
);
const ContractorFooter = lazy(() =>
  import("@/components/ContractorFooter").then((m) => ({
    default: m.ContractorFooter,
  }))
);
const MobileFooterCTA = lazy(() =>
  import("@/components/MobileFooterCTA").then((m) => ({
    default: m.MobileFooterCTA,
  }))
);

const PAGE = "missed_calls_landing";

const SECTIONS = [
  "hero",
  "pain",
  "urgency",
  "solution",
  "trades",
  "how_it_works",
  "live_demo",
  "resources",
  "objections",
  "calculator",
  "cta",
] as const;

const MissedCalls = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const calcRef = useRef<HTMLDivElement>(null);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const viewedSections = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Sentry: performance timing + funnel step
    trackPageLoad("MissedCalls");
    trackFunnelEvent("landing_page_view", { source: "missed_calls" });

    // PostHog: page-specific event
    capture("page_viewed_missed_calls", { page: PAGE });

    // Sentry: tag for session replay filtering
    Sentry.setTag("landing_page", "missed_calls");
  }, []);

  // Track section visibility via IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const sectionId = entry.target.getAttribute("data-section");
          if (!sectionId) return;
          if (entry.isIntersecting && !viewedSections.current.has(sectionId)) {
            viewedSections.current.add(sectionId);
            capture("section_viewed", { section: sectionId, page: PAGE });
          }
        });
      },
      { threshold: 0.3 }
    );

    sectionRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const registerSection = (id: string) => (el: HTMLElement | null) => {
    if (el) sectionRefs.current.set(id, el);
  };

  const goToTrial = (location: string) => {
    trackClick(`start_free_trial_${location}`, { page: PAGE, cta_location: location });
    capture("cta_clicked", {
      cta_location: location,
      cta_text: "Start Free Trial",
      destination: "/start",
      page: PAGE,
    });
    const params = new URLSearchParams(searchParams);
    params.set("source", "missed_calls");
    navigate(`/start?${params.toString()}`);
  };

  const scrollToCalc = (location: string) => {
    trackClick(`calculate_revenue_${location}`, { page: PAGE, cta_location: location });
    capture("cta_clicked", {
      cta_location: location,
      cta_text: "Calculate Missed Call Revenue",
      page: PAGE,
    });
    calcRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "RingSnap – AI Answering Service for Home-Service Contractors",
    description:
      "RingSnap answers missed, after-hours, and overflow calls for home-service contractors. Captures job details, flags emergencies, and helps you book more work without hiring extra staff.",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: "https://getringsnap.com/home-services-answering-service",
  };

  return (
    <>
      <Helmet>
        <title>AI Answering Service for Home-Service Contractors | RingSnap</title>
        <meta
          name="description"
          content="Stop losing jobs to missed calls. RingSnap answers calls when you're on a job, after hours, or already busy — capturing job details and flagging urgent calls for home-service contractors."
        />
        <meta
          name="keywords"
          content="home service answering service, contractor missed calls, AI receptionist contractors, after hours answering service, HVAC plumber electrician answering service"
        />
        <meta name="robots" content="index, follow" />
        <link
          rel="canonical"
          href="https://getringsnap.com/home-services-answering-service"
        />

        <meta
          property="og:title"
          content="AI Answering Service for Home-Service Contractors | RingSnap"
        />
        <meta
          property="og:description"
          content="Stop losing jobs to missed calls. RingSnap answers calls when you're on a job, after hours, or already busy."
        />
        <meta property="og:type" content="website" />
        <meta
          property="og:url"
          content="https://getringsnap.com/home-services-answering-service"
        />
        <meta
          property="og:image"
          content="https://getringsnap.com/android-chrome-512x512.png"
        />
        <meta property="og:site_name" content="RingSnap" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content="AI Answering Service for Home-Service Contractors | RingSnap"
        />
        <meta
          name="twitter:description"
          content="Stop losing jobs to missed calls. RingSnap answers when you can't."
        />
        <meta
          name="twitter:image"
          content="https://getringsnap.com/android-chrome-512x512.png"
        />

        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      <SiteHeader />

      <main className="pb-[calc(5rem+var(--safe-bottom))] md:pb-0">
        {/* ── HERO ── */}
        <section ref={registerSection("hero")} data-section="hero" className="relative min-h-[92vh] flex items-center overflow-hidden section-spacer pt-24">
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-gradient-to-br from-off-white to-cream/30" />
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-radial from-primary/8 to-transparent rounded-full -translate-y-1/4 translate-x-1/4 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-radial from-amber-400/6 to-transparent rounded-full translate-y-1/4 -translate-x-1/4 blur-3xl" />
          </div>

          <div className="site-container">
            <div className="max-w-3xl mx-auto text-center">
              <Badge variant="secondary" className="mb-6 text-xs font-semibold tracking-wide uppercase px-3 py-1">
                For Home-Service Contractors
              </Badge>

              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground leading-[1.1] mb-6">
                Stop losing jobs to{" "}
                <span className="text-primary">missed calls.</span>
              </h1>

              <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-8">
                RingSnap answers calls when you're on a job, driving, after
                hours, or already helping another customer. It captures job
                details, flags urgent calls, and helps contractors turn more
                phone calls into booked work.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
                <Button
                  size="lg"
                  className="text-base font-semibold px-8 gap-2"
                  onClick={() => goToTrial("hero")}
                >
                  Start Free Trial
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-base font-semibold px-8 gap-2"
                  onClick={() => scrollToCalc("hero")}
                >
                  <DollarSign className="h-4 w-4" />
                  Calculate Missed Call Revenue
                </Button>
              </div>

              <p className="text-sm text-muted-foreground">
                Start with missed calls, after-hours calls, or overflow. You do
                not have to replace your current phone process.
              </p>
            </div>
          </div>
        </section>

        {/* ── PAIN SECTION ── */}
        <section ref={registerSection("pain")} data-section="pain" className="section-spacer-compact bg-muted/30 border-t border-border/10">
          <div className="site-container">
            <div className="max-w-2xl mx-auto text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
                When a homeowner needs help, they usually call whoever answers
                first.
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                For contractors, a missed call is rarely just a missed message.
                It can be a lost job, a lost emergency call, or a customer who
                moved on to the next company in Google.
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {[
                {
                  icon: <Wrench className="h-6 w-6 text-primary" />,
                  title: "You're on the job.",
                  body: "Calls come in while you're under a sink, on a roof, in an attic, or driving between appointments.",
                },
                {
                  icon: <PhoneMissed className="h-6 w-6 text-destructive" />,
                  title: "Voicemail does not convert.",
                  body: "Most homeowners do not wait around after hearing voicemail. They call the next contractor.",
                },
                {
                  icon: <Clock className="h-6 w-6 text-amber-500" />,
                  title: "After-hours calls are high-value.",
                  body: "Emergency plumbing, HVAC, electrical, roofing, and garage door calls often go to whoever responds fastest.",
                },
              ].map(({ icon, title, body }) => (
                <div
                  key={title}
                  className="p-6 rounded-2xl border border-border bg-card shadow-sm"
                >
                  <div className="mb-4">{icon}</div>
                  <h3 className="font-semibold text-foreground mb-2">{title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── ECONOMIC URGENCY ── */}
        <section ref={registerSection("urgency")} data-section="urgency" className="section-spacer-compact border-t border-border/10">
          <div className="site-container">
            <div className="max-w-2xl mx-auto text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
                How much are missed calls costing you?
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed mb-8">
                Even a few missed calls a week can add up fast when one booked
                job is worth hundreds or thousands of dollars.
              </p>

              <div className="inline-flex items-center gap-2 bg-muted/60 rounded-xl px-6 py-4 text-sm font-medium text-foreground border border-border/40 mb-8 flex-wrap justify-center">
                <span className="text-muted-foreground">Missed calls</span>
                <span className="text-muted-foreground">×</span>
                <span className="text-primary font-semibold">booking rate</span>
                <span className="text-muted-foreground">×</span>
                <span className="text-primary font-semibold">average job value</span>
                <span className="text-muted-foreground">=</span>
                <span className="text-destructive font-semibold flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> revenue left on the table
                </span>
              </div>

              <Button
                size="lg"
                variant="outline"
                className="gap-2 font-semibold"
                onClick={() => scrollToCalc("urgency_section")}
              >
                <DollarSign className="h-4 w-4" />
                Calculate Your Missed Call Revenue
              </Button>
            </div>
          </div>
        </section>

        {/* ── SOLUTION SECTION ── */}
        <section ref={registerSection("solution")} data-section="solution" className="section-spacer-compact bg-muted/30 border-t border-border/10">
          <div className="site-container">
            <div className="max-w-2xl mx-auto text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
                RingSnap gives your business backup coverage when you cannot
                answer.
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                RingSnap works like an always-available front desk for
                home-service calls. It answers quickly, collects the right
                details, identifies urgent jobs, and helps make sure good leads
                do not disappear just because your team was busy.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
              {[
                {
                  icon: <PhoneCall className="h-5 w-5 text-primary" />,
                  title: "Answers instantly",
                  body: "No more sending every missed or after-hours call straight to voicemail.",
                },
                {
                  icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
                  title: "Captures job details",
                  body: "Name, service needed, location, timing, urgency, and contact information.",
                },
                {
                  icon: <Zap className="h-5 w-5 text-amber-500" />,
                  title: "Routes urgent calls",
                  body: "Emergency calls can be flagged and routed so high-value jobs do not get buried.",
                },
                {
                  icon: <Clock className="h-5 w-5 text-blue-500" />,
                  title: "Supports overflow",
                  body: "Use RingSnap when your team is busy, after hours, or already on another call.",
                },
              ].map(({ icon, title, body }) => (
                <div
                  key={title}
                  className="p-5 rounded-2xl border border-border bg-card shadow-sm"
                >
                  <div className="mb-3">{icon}</div>
                  <h3 className="font-semibold text-foreground mb-2 text-sm">{title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CONTRACTOR-SPECIFIC SECTION ── */}
        <section ref={registerSection("trades")} data-section="trades" className="section-spacer-compact border-t border-border/10">
          <div className="site-container">
            <div className="max-w-3xl mx-auto text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
                Built for home-service calls, not generic phone answering.
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed mb-8">
                RingSnap is designed around the way contractors actually get
                calls: emergency requests, estimates, service-area questions,
                scheduling needs, and urgent routing.
              </p>

              <div className="flex flex-wrap gap-3 justify-center">
                {[
                  { icon: <Thermometer className="h-4 w-4" />, label: "HVAC" },
                  { icon: <Waves className="h-4 w-4" />, label: "Plumbing" },
                  { icon: <Zap className="h-4 w-4" />, label: "Electrical" },
                  { icon: <Home className="h-4 w-4" />, label: "Roofing" },
                  { icon: <Wrench className="h-4 w-4" />, label: "Garage Doors" },
                  { icon: <Wrench className="h-4 w-4" />, label: "Handyman" },
                ].map(({ icon, label }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-muted/50 text-sm font-medium text-foreground"
                  >
                    {icon}
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section ref={registerSection("how_it_works")} data-section="how_it_works" className="section-spacer-compact bg-muted/30 border-t border-border/10">
          <div className="site-container">
            <div className="max-w-2xl mx-auto text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
                Go from missed calls to captured opportunities.
              </h2>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
              {[
                {
                  step: "1",
                  title: "Start your trial",
                  body: "Set up your business details, service area, trade, hours, and call handling preferences.",
                },
                {
                  step: "2",
                  title: "Use RingSnap for backup coverage",
                  body: "Start with missed calls, after-hours calls, or overflow before changing your main phone process.",
                },
                {
                  step: "3",
                  title: "RingSnap answers and qualifies callers",
                  body: "It captures what the customer needs and whether the call is urgent.",
                },
                {
                  step: "4",
                  title: "You get the details",
                  body: "You can follow up, route urgent jobs, or use the call details to book the work.",
                },
              ].map(({ step, title, body }) => (
                <div key={step} className="flex flex-col gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold text-lg shrink-0">
                    {step}
                  </div>
                  <h3 className="font-semibold text-foreground">{title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── LIVE DEMO ── */}
        <section ref={registerSection("live_demo")} data-section="live_demo" className="section-spacer-compact border-t border-border/10">
          <div className="site-container">
            <div className="max-w-2xl mx-auto text-center mb-8">
              <Badge variant="secondary" className="mb-4 text-xs font-semibold tracking-wide uppercase px-3 py-1">
                Live Demo
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
                Hear RingSnap answer the calls you're missing.
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Click the button below and talk to RingSnap the same way a homeowner would — after hours, during a busy day, or on a missed call. Hear exactly what your callers experience.
              </p>
            </div>

            <div className="max-w-2xl mx-auto mb-6">
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-sm text-amber-900 flex items-start gap-3">
                <span className="text-base shrink-0">💡</span>
                <span>
                  <span className="font-semibold">Try saying:</span> "I have a burst pipe, can someone come tonight?" or "Do you handle after-hours HVAC calls?"
                </span>
              </div>
            </div>

            <div className="max-w-2xl mx-auto mb-10">
              <div className="rounded-2xl overflow-hidden border border-border shadow-lg min-h-[420px] bg-card flex items-center justify-center relative">
                <Suspense fallback={
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <div className="animate-pulse w-12 h-12 rounded-full bg-primary/10" />
                    <span className="text-sm">Loading demo...</span>
                  </div>
                }>
                  <VoiceDemoWidget />
                </Suspense>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
              {[
                { stat: "< 2 rings", label: "Average answer time" },
                { stat: "24 / 7", label: "Always available" },
                { stat: "100%", label: "Calls captured, not voicemailed" },
              ].map(({ stat, label }) => (
                <div key={label} className="text-center p-4 rounded-xl border border-border bg-muted/30">
                  <div className="text-xl font-bold text-primary mb-1">{stat}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── RESOURCES LEAD CAPTURE ── */}
        <section ref={registerSection("resources")} data-section="resources" className="section-spacer-compact bg-muted/30 border-t border-border/10">
          <div className="site-container">
            <div className="max-w-3xl mx-auto">
              <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-8 md:p-10">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                  <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <CheckCircle2 className="h-7 w-7 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-foreground mb-2">
                      Get the Contractor Call Conversion Pack
                    </h3>
                    <p className="text-muted-foreground leading-relaxed mb-1">
                      Free scripts, triage guides, and field templates for HVAC, plumbing, electrical, and roofing — the exact resources at{" "}
                      <span className="font-medium text-foreground">getringsnap.com/resources</span>.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Download free. No credit card required.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      capture("cta_clicked", { cta_location: "resources_section", cta_text: "Download Free Script Pack", page: PAGE });
                      trackClick("download_script_pack_resources", { page: PAGE });
                      setIsDownloadModalOpen(true);
                    }}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm whitespace-nowrap shrink-0"
                  >
                    <ArrowRight className="h-4 w-4" />
                    Download Free Script Pack
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── OBJECTION REDUCER ── */}
        <section ref={registerSection("objections")} data-section="objections" className="section-spacer-compact border-t border-border/10">
          <div className="site-container">
            <div className="max-w-3xl mx-auto text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
                You do not have to hand over your whole phone system.
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Start small. Use RingSnap for the calls you are already
                missing: nights, weekends, overflow, or times when your team
                cannot pick up. If it helps capture jobs, expand from there.
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-5 max-w-4xl mx-auto">
              {[
                {
                  q: "Already have someone answering calls?",
                  a: "Use RingSnap as overflow or after-hours backup.",
                },
                {
                  q: "Not sure about AI with customers?",
                  a: "Start with missed calls first, where the alternative is usually voicemail.",
                },
                {
                  q: "Small team?",
                  a: "That is where missed calls hurt most. RingSnap helps cover the gaps without hiring another person.",
                },
              ].map(({ q, a }) => (
                <div
                  key={q}
                  className="p-5 rounded-2xl border border-border bg-card shadow-sm"
                >
                  <p className="font-semibold text-foreground text-sm mb-2">{q}</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CALCULATOR ── */}
        <div ref={(el) => { calcRef.current = el; registerSection("calculator")(el); }} data-section="calculator" className="border-t border-border/10">
          <Suspense
            fallback={
              <div className="w-full h-64 flex items-center justify-center">
                <div className="animate-pulse text-muted-foreground">
                  Loading calculator...
                </div>
              </div>
            }
          >
            <CallValueCalculator />
          </Suspense>
        </div>

        {/* ── FINAL CTA ── */}
        <section ref={registerSection("cta")} data-section="cta" className="section-spacer-compact bg-primary/5 border-t border-primary/10">
          <div className="site-container">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
                Test RingSnap on the calls you are already missing.
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed mb-8">
                Start a free trial and see whether RingSnap can help capture
                more missed, after-hours, and overflow calls for your business.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
                <Button
                  size="lg"
                  className="text-base font-semibold px-8 gap-2"
                  onClick={() => goToTrial("bottom_cta")}
                >
                  Start Free Trial
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-base font-semibold px-8 gap-2"
                  onClick={() => scrollToCalc("bottom_cta")}
                >
                  <DollarSign className="h-4 w-4" />
                  Calculate Missed Call Revenue
                </Button>
              </div>

              <p className="text-sm text-muted-foreground">
                Cancel anytime. Start with backup coverage before changing your
                main call flow.
              </p>
            </div>
          </div>
        </section>

        <Suspense fallback={null}>
          <ContractorFooter />
        </Suspense>
      </main>

      <Suspense fallback={null}>
        <MobileFooterCTA />
      </Suspense>

      <ResourceDownloadModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
        resourceName="Contractor Call Conversion Pack"
      />
    </>
  );
};

export default MissedCalls;
