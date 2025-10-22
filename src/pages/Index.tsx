import { Helmet } from "react-helmet";
import { ContractorHero } from "@/components/ContractorHero";
import { EmergencyCalculator } from "@/components/EmergencyCalculator";
import { SolutionDemo } from "@/components/SolutionDemo";
import { ContractorTestimonials } from "@/components/ContractorTestimonials";
import { ContractorPricing } from "@/components/ContractorPricing";
import { FinalCTA } from "@/components/FinalCTA";
import { ContractorFooter } from "@/components/ContractorFooter";

const Index = () => {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "AI Answering Service for Contractors",
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
    "description": "24/7 AI answering service for plumbers, HVAC, electrical, and roofing contractors. Never miss emergency calls worth $800-2000. Answers in under 1 second.",
    "image": "https://aivoiceagent.com/og-image.jpg",
    "featureList": [
      "Answers calls in under 1 second",
      "Books emergency appointments automatically",
      "95% call capture rate",
      "Multi-language support (English, Spanish)",
      "Natural human-sounding voice",
      "Integrates with existing phone number",
      "24/7/365 availability",
      "HIPAA compliant"
    ]
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
        <title>24/7 AI Answering Service for Plumbers & HVAC | $297/mo</title>
        <meta 
          name="description" 
          content="Stop losing $4,200-$12,600/month in missed emergency calls. AI receptionist answers in under 1 second, books plumbing & HVAC jobs 24/7. Try free for 14 days." 
        />
        <meta 
          name="keywords" 
          content="AI answering service for plumbers, HVAC answering service, emergency call answering, 24/7 receptionist, plumber call service, contractor answering service" 
        />
        <link rel="canonical" href="https://aivoiceagent.com/" />
        
        {/* Open Graph */}
        <meta property="og:title" content="24/7 AI Answering Service for Plumbers & HVAC" />
        <meta property="og:description" content="Stop losing $4,200-$12,600/month in missed emergency calls. AI books jobs in under 1 second." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://aivoiceagent.com/" />
        <meta property="og:image" content="https://aivoiceagent.com/og-image.jpg" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="24/7 AI Answering Service for Plumbers & HVAC" />
        <meta name="twitter:description" content="Never miss emergency calls worth $800-2000. AI answers in under 1 second." />
        <meta name="twitter:image" content="https://aivoiceagent.com/og-image.jpg" />
        
        {/* Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(faqStructuredData)}
        </script>
      </Helmet>

      <main>
        <h1 className="sr-only">24/7 AI Answering Service for Plumbers, HVAC, Electrical & Roofing Contractors</h1>
        
        <ContractorHero />
        <EmergencyCalculator />
        <SolutionDemo />
        <ContractorTestimonials />
        <ContractorPricing />
        <FinalCTA />
        <ContractorFooter />
      </main>
    </>
  );
};

export default Index;
