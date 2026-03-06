import { Helmet } from "react-helmet-async";
import { lazy, Suspense, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ContractorHero } from "@/components/ContractorHero";
import { TestimonialMetricsStrip } from "@/components/TestimonialMetricsStrip";
import { NextStepsStrip } from "@/components/NextStepsStrip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SiteHeader } from "@/components/SiteHeader";
import { trackFunnelEvent, trackPageLoad } from "@/lib/sentry-tracking";
import * as Sentry from "@sentry/react";
import { Button } from "@/components/ui/button";

const CallValueCalculator = lazy(() => import("@/components/CallValueCalculator").then(m => ({ default: m.CallValueCalculator })));
const SolutionDemo = lazy(() => import("@/components/SolutionDemo").then(m => ({ default: m.SolutionDemo })));
const CompetitorComparison = lazy(() => import("@/components/CompetitorComparison").then(m => ({ default: m.CompetitorComparison })));
const ContractorTestimonials = lazy(() => import("@/components/ContractorTestimonials").then(m => ({ default: m.ContractorTestimonials })));
import { PricingTeaserCard } from "@/components/PricingTeaserCard";

const ContractorFooter = lazy(() => import("@/components/ContractorFooter").then(m => ({ default: m.ContractorFooter })));
const MobileFooterCTA = lazy(() => import("@/components/MobileFooterCTA").then(m => ({ default: m.MobileFooterCTA })));

const Index = () => {
  const navigate = useNavigate();
  // Track landing page view for funnel analytics
  useEffect(() => {
    trackPageLoad('Index');
    trackFunnelEvent('landing_page_view');
  }, []);

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
        "name": "Starter Plan",
        "price": "297",
        "priceCurrency": "USD",
        "priceValidUntil": "2025-12-31",
        "availability": "https://schema.org/InStock"
      },
      {
        "@type": "Offer",
        "name": "Professional Plan",
        "price": "797",
        "priceCurrency": "USD",
        "priceValidUntil": "2025-12-31",
        "availability": "https://schema.org/InStock"
      },
      {
        "@type": "Offer",
        "name": "Growth Plan",
        "price": "1497",
        "priceCurrency": "USD",
        "priceValidUntil": "2025-12-31",
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

    "image": "https://getringsnap.com/assets/social/ringsnap-og.jpg",
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
    "logo": "https://getringsnap.com/assets/RS_logo_color.svg",
    "slogan": "Built to book jobs",
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+1-800-555-0199",
      "contactType": "customer support",
      "availableLanguage": ["English", "Spanish"]
    }
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "RingSnap",
    "url": "https://getringsnap.com",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://getringsnap.com/search?q={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  };

  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Will it sound like a robot?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "No. Our system uses advanced voice technology that sounds professional and natural. Callers get a fast, helpful answer every time. We offer branded voice options on Professional and Premium plans."
        }
      },
      {
        "@type": "Question",
        "name": "What if it's a gas leak or electrical fire?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Life-threatening emergencies are always transferred to you immediately (typically in under 5 seconds). The system provides full context of the situation before transfer so you know exactly what you're walking into."
        }
      },
      {
        "@type": "Question",
        "name": "Can it handle Spanish-speaking customers?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes. Professional and Growth plans include multi-language support. The Agent seamlessly switches between English and Spanish based on the customer's preference."
        }
      },
      {
        "@type": "Question",
        "name": "Do I need to change my phone number?",
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
        <meta
          name="keywords"
          content="virtual answering service, contractor receptionist, human-sounding receptionist, 24/7 call answering, plumber answering service, HVAC answering service, emergency call booking, voice agent, virtual assistant"
        />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://getringsnap.com/" />

        {/* Open Graph */}
        <meta property="og:title" content="RingSnap: The 24/7 Virtual Receptionist" />
        <meta property="og:description" content="Never miss a call. Book jobs 24/7. Professional call handling for contractors." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://getringsnap.com/" />
        <meta property="og:image" content="https://getringsnap.com/android-chrome-512x512.png" />
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

        <div id="main-content">
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

              {/* Resource Center Teaser */}
              <section className="section-spacer bg-white border-t border-border/5">
                <div className="site-container">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-8 p-8 md:p-12 rounded-3xl bg-gradient-to-br from-cream/30 to-off-white border border-border/10 shadow-sm">
                    <div className="max-w-2xl text-center md:text-left">
                      <h2 className="text-3xl font-bold mb-4">Contractor Resource Center</h2>
                      <p className="text-lg text-muted-foreground mb-0">
                        Free dispatcher scripts, phone intake checklists, and profit calculators designed specifically for home service trades.
                      </p>
                    </div>
                    <Button
                      size="lg"
                      className="rounded-full px-8 h-14 text-lg font-semibold whitespace-nowrap"
                      onClick={() => navigate('/resources')}
                    >
                      Browse Resources
                    </Button>
                  </div>
                </div>
              </section>

              <ContractorFooter />
            </Suspense>
          </ErrorBoundary>
        </div>
        <MobileFooterCTA />
      </main>
    </>
  );
};

export default Index;
