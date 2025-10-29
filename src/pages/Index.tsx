import { Helmet } from "react-helmet";
import { lazy, Suspense } from "react";
import { ContractorHero } from "@/components/ContractorHero";
import { TestimonialMetricsStrip } from "@/components/TestimonialMetricsStrip";
import { NextStepsStrip } from "@/components/NextStepsStrip";

const CallValueCalculator = lazy(() => import("@/components/CallValueCalculator").then(m => ({ default: m.CallValueCalculator })));
const SolutionDemo = lazy(() => import("@/components/SolutionDemo").then(m => ({ default: m.SolutionDemo })));
const CompetitorComparison = lazy(() => import("@/components/CompetitorComparison").then(m => ({ default: m.CompetitorComparison })));
const ContractorTestimonials = lazy(() => import("@/components/ContractorTestimonials").then(m => ({ default: m.ContractorTestimonials })));
const ContractorPricing = lazy(() => import("@/components/ContractorPricing").then(m => ({ default: m.ContractorPricing })));

const ContractorFooter = lazy(() => import("@/components/ContractorFooter").then(m => ({ default: m.ContractorFooter })));
const MobileFooterCTA = lazy(() => import("@/components/MobileFooterCTA").then(m => ({ default: m.MobileFooterCTA })));

const Index = () => {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "RingSnap - AI Answering Service for Contractors",
    "description": "Human-sounding AI receptionist that answers calls 24/7, books jobs automatically, and connects with customers warmly. Made for plumbers, HVAC, electrical, and roofing contractors.",
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
    
    "image": "https://aivoiceagent.com/og-image.jpg",
    "featureList": [
      "Answers in under 1 second",
      "Books appointments automatically",
      "Sounds completely human",
      "24/7/365 availability",
      "Multi-language support",
      "Emergency call routing",
      "HIPAA compliant",
      "10-minute setup"
    ]
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "RingSnap",
    "alternateName": "AI Voice Agent",
    "description": "AI answering service that sounds human. Made for contractors who never want to miss a call.",
    "url": "https://aivoiceagent.com",
    "logo": "https://aivoiceagent.com/logo.png",
    "slogan": "Made to sound human",
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+1-800-AI-CALLS",
      "contactType": "customer support",
      "availableLanguage": ["English", "Spanish"]
    }
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "AI Voice Agent",
    "url": "https://aivoiceagent.com",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://aivoiceagent.com/search?q={search_term_string}",
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
          "text": "No. Our AI uses advanced voice technology that sounds completely natural. Customers typically can't tell they're speaking with AI. We offer premium voice cloning on Professional and Growth plans to match your team's voice exactly."
        }
      },
      {
        "@type": "Question",
        "name": "What if it's a gas leak or electrical fire?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Life-threatening emergencies are always transferred to you immediately (typically in under 5 seconds). The AI provides full context of the situation before transfer so you know exactly what you're walking into."
        }
      },
      {
        "@type": "Question",
        "name": "Can it handle Spanish-speaking customers?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes. Professional and Growth plans include multi-language support. The AI seamlessly switches between English and Spanish based on the customer's preference."
        }
      },
      {
        "@type": "Question",
        "name": "Do I need to change my phone number?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "No. You keep your existing phone number. Setup takes about 10 minutes—just forward your number to your AI receptionist."
        }
      }
    ]
  };

  return (
    <>
      <Helmet>
        <title>RingSnap: AI that Answers Like a Human | 24/7 Call Service for Contractors</title>
        <meta 
          name="description" 
          content="Never miss a call. Book jobs 24/7. Sound warm, not robotic. RingSnap's AI receptionist answers in under 1 second and your customers won't know it's AI. Try free for 14 days." 
        />
        <meta 
          name="keywords" 
          content="AI answering service, contractor receptionist, human-sounding AI, 24/7 call answering, plumber answering service, HVAC answering service, emergency call booking, AI voice agent, warm AI assistant" 
        />
        <link rel="canonical" href="https://aivoiceagent.com/" />
        <link rel="preload" as="image" href="https://aivoiceagent.com/hero-transcript.webp" />
        
        {/* Open Graph */}
        <meta property="og:title" content="RingSnap: AI that Answers Like a Human" />
        <meta property="og:description" content="Never miss a call. Book jobs 24/7. Sound warm, not robotic. Your customers won't know it's AI." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://aivoiceagent.com/" />
        <meta property="og:image" content="https://aivoiceagent.com/og-image.jpg" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="RingSnap: AI that Answers Like a Human" />
        <meta name="twitter:description" content="Never miss a call. Book jobs 24/7. AI that sounds warm and human." />
        <meta name="twitter:image" content="https://aivoiceagent.com/og-image.jpg" />
        
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

      <main className="pb-[calc(5rem+var(--safe-bottom))] md:pb-0">
        <h1 className="sr-only">RingSnap: AI Answering Service That Sounds Human - For Plumbers, HVAC, Electrical & Roofing Contractors</h1>

        <ContractorHero />
        <TestimonialMetricsStrip />

        <Suspense fallback={<div className="w-full h-64 flex items-center justify-center" aria-busy="true"><div className="animate-pulse text-muted-foreground">Loading...</div></div>}>
          <ContractorTestimonials />
          <CompetitorComparison />
          <SolutionDemo />
          <NextStepsStrip />
          <CallValueCalculator />
          <ContractorPricing />
          <ContractorFooter />
          <MobileFooterCTA />
        </Suspense>
      </main>
    </>
  );
};

export default Index;
