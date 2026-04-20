import { Helmet } from "react-helmet-async";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ContractorHero } from "@/components/ContractorHero";
import { TestimonialMetricsStrip } from "@/components/TestimonialMetricsStrip";
import { NextStepsStrip } from "@/components/NextStepsStrip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SiteHeader } from "@/components/SiteHeader";
import { trackFunnelEvent, trackPageLoad } from "@/lib/sentry-tracking";
import { Button } from "@/components/ui/button";
import { ArrowRight, FileText, Calculator, Thermometer, Wrench, Zap } from "lucide-react";

const CallValueCalculator = lazy(() => import("@/components/CallValueCalculator").then(m => ({ default: m.CallValueCalculator })));
const SolutionDemo = lazy(() => import("@/components/SolutionDemo").then(m => ({ default: m.SolutionDemo })));
const CompetitorComparison = lazy(() => import("@/components/CompetitorComparison").then(m => ({ default: m.CompetitorComparison })));
const ContractorTestimonials = lazy(() => import("@/components/ContractorTestimonials").then(m => ({ default: m.ContractorTestimonials })));
import { PricingTeaserCard } from "@/components/PricingTeaserCard";

const ContractorFooter = lazy(() => import("@/components/ContractorFooter").then(m => ({ default: m.ContractorFooter })));
const MobileFooterCTA = lazy(() => import("@/components/MobileFooterCTA").then(m => ({ default: m.MobileFooterCTA })));

const Index = () => {
  const belowTheFoldRef = useRef<HTMLDivElement | null>(null);
  const [isBelowTheFoldVisible, setIsBelowTheFoldVisible] = useState(false);

  // Track landing page view for funnel analytics (Sentry + PostHog)
  useEffect(() => {
    trackPageLoad('Index');
    trackFunnelEvent('landing_page_view');
    // PostHog: page_viewed fired by RouteTracker; capture landing-specific event
  }, []);

  useEffect(() => {
    if (isBelowTheFoldVisible) {
      return;
    }

    const section = belowTheFoldRef.current;
    if (!section) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsBelowTheFoldVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "320px 0px" },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [isBelowTheFoldVisible]);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "RingSnap - Virtual Receptionist for Contractors",
    "description": "Human-sounding virtual receptionist that answers calls 24/7, books jobs automatically, and connects with customers warmly. Made for plumbers, HVAC, electrical, and roofing contractors.",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "offers": [
      {
        "@type": "Offer",
        "name": "Night & Weekend Plan",
        "price": "59",
        "priceCurrency": "USD",
        "priceValidUntil": "2026-12-31",
        "availability": "https://schema.org/InStock"
      },
      {
        "@type": "Offer",
        "name": "Lite Plan",
        "price": "129",
        "priceCurrency": "USD",
        "priceValidUntil": "2026-12-31",
        "availability": "https://schema.org/InStock"
      },
      {
        "@type": "Offer",
        "name": "Core Plan",
        "price": "229",
        "priceCurrency": "USD",
        "priceValidUntil": "2026-12-31",
        "availability": "https://schema.org/InStock"
      },
      {
        "@type": "Offer",
        "name": "Pro Plan",
        "price": "449",
        "priceCurrency": "USD",
        "priceValidUntil": "2026-12-31",
        "availability": "https://schema.org/InStock"
      }
    ],
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "reviewCount": "247",
      "bestRating": "5",
      "worstRating": "1"
    },

    "image": "https://getringsnap.com/android-chrome-512x512.png",
    "featureList": [
      "Answers in under 1 second",
      "Books appointments automatically",
      "24/7/365 availability",
      "Multi-language support",
      "Emergency call routing",
      "Full call logs and transcripts",
      "10-minute setup"
    ]
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "RingSnap",
    "alternateName": "RingSnap Answering Service",
    "description": "Virtual answering service built for contractors. Never miss a call, book more jobs.",
    "url": "https://getringsnap.com",
    "logo": "https://getringsnap.com/RS_logo_color.svg",
    "slogan": "Built to book jobs",
    "sameAs": [
      "https://www.linkedin.com/company/ringsnap"
    ]
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "RingSnap",
    "url": "https://getringsnap.com"
  };

  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Will my customers know it's not a real person?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "No. Our system uses advanced voice technology that sounds professional and natural. Callers get a fast, helpful answer every time. We offer branded voice options on Core and Pro plans."
        }
      },
      {
        "@type": "Question",
        "name": "What happens when there's a real emergency at 2am?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Life-threatening emergencies are always transferred to you immediately (typically in under 5 seconds). The system provides full context of the situation before transfer so you know exactly what you're walking into."
        }
      },
      {
        "@type": "Question",
        "name": "My customers speak Spanish. Will that be a problem?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes. Core and Pro plans include multi-language support. The Agent seamlessly switches between English and Spanish based on the customer's preference."
        }
      },
      {
        "@type": "Question",
        "name": "Do I have to change anything about how I currently answer calls?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "No. You keep your existing phone number. Setup takes about 10 minutes—just forward your number to your RingSnap Agent."
        }
      }
    ]
  };

  return (
    <>
      <Helmet>
        <title>RingSnap: The 24/7 Virtual Receptionist for Contractors</title>
        <meta
          name="description"
          content="Never miss a call. Book jobs 24/7. RingSnap's virtual receptionist answers in under 1 second with professional call handling. Try free for 3 days."
        />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://getringsnap.com/" />

        {/* Open Graph */}
        <meta property="og:title" content="RingSnap: The 24/7 Virtual Receptionist" />
        <meta property="og:description" content="Never miss a call. Book jobs 24/7. Professional call handling for contractors." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://getringsnap.com/" />
        <meta property="og:image" content="https://getringsnap.com/android-chrome-512x512.png" />
        <meta property="og:image:width" content="512" />
        <meta property="og:image:height" content="512" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:site_name" content="RingSnap" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="RingSnap: The 24/7 Virtual Receptionist" />
        <meta name="twitter:description" content="Never miss a call. Book jobs 24/7. Professional call handling for contractors." />
        <meta name="twitter:image" content="https://getringsnap.com/android-chrome-512x512.png" />

        {/* Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify(organizationSchema)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(websiteSchema)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(faqStructuredData)}
        </script>
      </Helmet>

      <SiteHeader />
      <main className="pb-[calc(5rem+var(--safe-bottom))] md:pb-0 pt-14">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:shadow-lg"
        >
          Skip to main content
        </a>
        <ContractorHero />
        <TestimonialMetricsStrip />

        <div id="main-content" ref={belowTheFoldRef}>
          {isBelowTheFoldVisible ? (
            <ErrorBoundary>
              <Suspense fallback={<div className="w-full h-64 flex items-center justify-center" aria-busy="true"><div className="animate-pulse text-muted-foreground">Loading...</div></div>}>
                <ContractorTestimonials />
                <CompetitorComparison />
                <SolutionDemo />
                <NextStepsStrip />
                <CallValueCalculator />
                <section className="section-spacer-compact bg-charcoal/5 border-y border-charcoal/10">
                  <div className="site-container max-w-3xl text-center">
                    <p className="text-2xl sm:text-3xl font-bold mb-3" style={{ color: 'hsl(var(--charcoal))' }}>
                      Your competitor just answered the call you missed.
                    </p>
                    <p className="text-lg text-muted-foreground">
                      The average contractor misses 6 calls on a busy Saturday. At $800 per job, that's $4,800 walking out the door — every weekend.
                    </p>
                  </div>
                </section>
                <section aria-labelledby="pricing-teaser-heading" className="section-spacer-compact bg-muted/30">
                  <div className="site-container max-w-4xl text-center">
                    <PricingTeaserCard headingLevel="h2" />
                  </div>
                </section>

                {/* CRM Teaser */}
                <section className="section-spacer-compact bg-white border-t border-border/5">
                  <div className="site-container">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8 p-8 md:p-12 rounded-3xl bg-gradient-to-br from-primary/5 to-off-white border border-primary/10 shadow-sm">
                      <div className="max-w-2xl text-center md:text-left">
                        <h2 className="text-2xl font-bold mb-3">Not just a receptionist — a built-in CRM</h2>
                        <p className="text-muted-foreground mb-0">
                          Every call creates a lead record automatically — job type, urgency, full transcript. Works with Jobber. No extra tools needed.
                        </p>
                      </div>
                      <Button
                        size="lg"
                        variant="outline"
                        className="rounded-full px-8 h-14 text-base font-semibold whitespace-nowrap border-2"
                        asChild
                      >
                        <Link to="/crm">See the Built-In CRM</Link>
                      </Button>
                    </div>
                  </div>
                </section>

                {/* Top Field Guides */}
                <section aria-labelledby="field-guides-heading" className="section-spacer bg-white border-t border-border/5">
                  <div className="site-container">
                    <div className="text-center mb-8">
                      <h2 id="field-guides-heading" className="text-2xl sm:text-3xl font-bold mb-3">Top Field Guides for Home Service Contractors</h2>
                      <p className="text-muted-foreground max-w-2xl mx-auto">
                        Free dispatcher scripts, emergency triage guides, and revenue calculators — built for HVAC, plumbing, and electrical businesses.
                      </p>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                      {[
                        { href: "/resources/hvac-dispatcher-script-template", icon: Thermometer, label: "HVAC", title: "HVAC Dispatcher Script Template", desc: "Copy/paste scripts for standard calls, emergencies, price shoppers, and after-hours HVAC." },
                        { href: "/resources/plumbing-dispatcher-script-template", icon: Wrench, label: "Plumbing", title: "Plumbing Dispatcher Script Template", desc: "Burst pipe, sewer backup, drain cleaning scripts with emergency intake checklist." },
                        { href: "/resources/electrician-call-answering-script", icon: Zap, label: "Electrical", title: "Electrician Call Answering Script", desc: "Safety-first scripts for electrical emergencies, panel upgrades, and after-hours calls." },
                        { href: "/resources/missed-call-revenue-calculator", icon: Calculator, label: "Calculator", title: "Missed Call Revenue Calculator", desc: "See exactly how much revenue your shop loses from unanswered calls each month." },
                        { href: "/resources/hvac-emergency-call-triage", icon: FileText, label: "HVAC", title: "HVAC Emergency Call Triage", desc: "Triage guide for gas leaks, no-heat, and AC failures — what's urgent vs can wait." },
                        { href: "/resources/electrical-safety-triage-questions", icon: FileText, label: "Electrical", title: "Electrical Safety Triage Questions", desc: "The 8 dispatcher questions that assess danger and prioritize every electrical call." },
                      ].map(({ href, icon: Icon, label, title, desc }) => (
                        <Link
                          key={href}
                          to={href}
                          className="group flex flex-col gap-3 p-5 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Icon className="h-4 w-4 text-primary" />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground">{label}</span>
                          </div>
                          <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors leading-snug">{title}</h3>
                          <p className="text-xs text-muted-foreground leading-relaxed flex-1">{desc}</p>
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                            Read guide <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                          </span>
                        </Link>
                      ))}
                    </div>
                    <div className="text-center">
                      <Link to="/resources" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                        Browse all 17 free guides and tools <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </section>

                {/* How We Compare */}
                <section aria-labelledby="compare-heading" className="section-spacer-compact bg-muted/30 border-t border-border/5">
                  <div className="site-container max-w-4xl text-center">
                    <h2 id="compare-heading" className="text-xl font-semibold mb-3">How RingSnap compares</h2>
                    <p className="text-muted-foreground mb-5 text-sm">See how we stack up against the alternatives contractors most often consider.</p>
                    <div className="flex flex-wrap justify-center gap-3 text-sm">
                      <Link to="/compare/ringsnap-vs-ruby" className="px-4 py-2 rounded-full border border-border bg-background hover:border-primary/40 hover:text-primary transition-colors">RingSnap vs Ruby</Link>
                      <Link to="/compare/ringsnap-vs-smith-ai" className="px-4 py-2 rounded-full border border-border bg-background hover:border-primary/40 hover:text-primary transition-colors">RingSnap vs Smith.ai</Link>
                      <Link to="/compare/ringsnap-vs-goodcall" className="px-4 py-2 rounded-full border border-border bg-background hover:border-primary/40 hover:text-primary transition-colors">RingSnap vs Goodcall</Link>
                      <Link to="/compare/ai-receptionist-vs-live-answering" className="px-4 py-2 rounded-full border border-border bg-background hover:border-primary/40 hover:text-primary transition-colors">AI vs Live Answering</Link>
                      <Link to="/compare/best-ai-receptionist-home-services" className="px-4 py-2 rounded-full border border-border bg-background hover:border-primary/40 hover:text-primary transition-colors">Best AI Receptionist Guide</Link>
                    </div>
                  </div>
                </section>

                <ContractorFooter />
              </Suspense>
            </ErrorBoundary>
          ) : (
            <div className="w-full h-64" aria-hidden="true" />
          )}
        </div>
        <MobileFooterCTA />
      </main>
    </>
  );
};

export default Index;
