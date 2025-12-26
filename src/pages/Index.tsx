import { Helmet } from "react-helmet-async";
import { lazy, Suspense, useEffect } from "react";
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

    "image": "https://www.getringsnap.com/assets/social/ringsnap-og.jpg",
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
    "url": "https://www.getringsnap.com",
    "logo": "https://www.getringsnap.com/assets/RS_logo_color.svg",
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
    "url": "https://www.getringsnap.com",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://www.getringsnap.com/search?q={search_term_string}",
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
        <link rel="canonical" href="https://www.getringsnap.com/" />

        {/* Open Graph */}
        <meta property="og:title" content="RingSnap: The 24/7 Virtual Receptionist" />
        <meta property="og:description" content="Never miss a call. Book jobs 24/7. Professional call handling for contractors." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.getringsnap.com/" />
        <meta property="og:image" content="https://www.getringsnap.com/assets/social/ringsnap-og.jpg" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="RingSnap: The 24/7 Virtual Receptionist" />
        <meta name="twitter:description" content="Never miss a call. Book jobs 24/7. Professional call handling for contractors." />
        <meta name="twitter:image" content="https://www.getringsnap.com/assets/social/ringsnap-og.jpg" />

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
              <section aria-labelledby="pricing-teaser-heading" className="section-spacer-compact bg-muted/30">
                <div className="container mx-auto px-4 max-w-4xl">
                  <PricingTeaserCard headingLevel="h2" />
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
