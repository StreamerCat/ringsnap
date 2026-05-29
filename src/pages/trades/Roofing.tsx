import { Helmet } from "react-helmet-async";
import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { TradeHero } from "@/components/trades/TradeHero";
import { TradePainPoints } from "@/components/trades/TradePainPoints";
import { TradeTestimonials } from "@/components/trades/TradeTestimonials";
import { NextStepsStrip } from "@/components/NextStepsStrip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { getTradeConfig } from "@/components/trades/tradeConfig";
import { ArrowRight } from "lucide-react";

const CallValueCalculator = lazy(() => import("@/components/CallValueCalculator").then(m => ({ default: m.CallValueCalculator })));
const SolutionDemo = lazy(() => import("@/components/SolutionDemo").then(m => ({ default: m.SolutionDemo })));
const CompetitorComparison = lazy(() => import("@/components/CompetitorComparison").then(m => ({ default: m.CompetitorComparison })));
const ContractorPricing = lazy(() => import("@/components/ContractorPricing").then(m => ({ default: m.ContractorPricing })));
const ContractorFooter = lazy(() => import("@/components/ContractorFooter").then(m => ({ default: m.ContractorFooter })));
const MobileFooterCTA = lazy(() => import("@/components/MobileFooterCTA").then(m => ({ default: m.MobileFooterCTA })));

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://getringsnap.com/" },
    { "@type": "ListItem", position: 2, name: "AI Receptionist for Roofers", item: "https://getringsnap.com/roofing" },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How does an AI receptionist help roofing contractors?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "RingSnap handles roofing calls the way a trained dispatcher would: emergency leaks get triaged immediately, storm damage calls are captured with full details (location, severity, insurance info), and inspection requests get booked while you're on a roof. You never miss a call when the weather turns."
      }
    },
    {
      "@type": "Question",
      name: "Can RingSnap handle the surge of calls after a storm?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Storm surges are a core use case. When your phone rings off the hook after heavy weather, RingSnap handles every concurrent call — triage, booking, and dispatching — without any hold times or voicemail. Every storm damage lead is captured and prioritized."
      }
    },
    {
      "@type": "Question",
      name: "Can RingSnap capture insurance restoration leads?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. RingSnap collects insurance carrier, claim status, and inspection availability during the initial call — so you arrive at estimates with the information you need. Insurance restoration leads that used to fall through the cracks are now captured and scheduled automatically."
      }
    },
    {
      "@type": "Question",
      name: "Does RingSnap help roofing companies book more inspections?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Inspection booking is one of RingSnap's highest-value functions for roofers. Homeowners who call during active jobs or weekends get booked immediately while they're motivated — rather than leaving a voicemail that may not get returned for days."
      }
    },
    {
      "@type": "Question",
      name: "How quickly can a roofing company start using RingSnap?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "In about 10 minutes. Forward your existing business number to RingSnap and you're live. No hardware, no new number, no contracts. The 3-day free trial lets you capture real calls and verify the ROI before you pay anything."
      }
    }
  ]
};

const Roofing = () => {
  const config = getTradeConfig("roofing")!;

  return (
    <>
      <Helmet>
        <title>{config.seo.title}</title>
        <meta name="description" content={config.seo.description} />
        <meta name="keywords" content={config.seo.keywords} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={config.seo.canonical} />

        <meta property="og:title" content={config.seo.title} />
        <meta property="og:description" content={config.seo.description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={config.seo.canonical} />
        <meta property="og:image" content="https://getringsnap.com/android-chrome-512x512.png" />
        <meta property="og:image:width" content="512" />
        <meta property="og:image:height" content="512" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:site_name" content="RingSnap" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={config.seo.title} />
        <meta name="twitter:description" content={config.seo.description} />
        <meta name="twitter:image" content="https://getringsnap.com/android-chrome-512x512.png" />

        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>

      <main className="pb-[calc(5rem+var(--safe-bottom))] md:pb-0">
        <TradeHero config={config} />
        <TradePainPoints config={config} />
        <TradeTestimonials config={config} />

        <div id="main-content">
          <ErrorBoundary>
            <Suspense fallback={<div className="w-full h-64 flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>}>
              <CompetitorComparison />
              <SolutionDemo />
              <NextStepsStrip />
              <CallValueCalculator preselectedTrade="Roofing" />
              <ContractorPricing />

              {/* Related Resources */}
              <section aria-labelledby="roofing-resources-heading" className="section-spacer-compact bg-muted/30 border-t border-border/10">
                <div className="site-container max-w-4xl">
                  <h2 id="roofing-resources-heading" className="text-lg font-semibold mb-4">Free Field Guides for Roofing Contractors</h2>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {[
                      { href: "/resources/missed-call-revenue-calculator", title: "Missed Call Revenue Calculator", desc: "See exactly how much revenue your shop loses from missed storm-season calls." },
                      { href: "/resources/after-hours-call-calculator", title: "After-Hours Call Opportunity Calculator", desc: "Calculate the revenue hiding in your after-hours and weekend call volume." },
                      { href: "/resources/increase-average-ticket", title: "Average Revenue Per Job Growth Planner", desc: "Plan your average ticket increase with upsell menus and revenue projections." },
                    ].map(({ href, title, desc }) => (
                      <Link key={href} to={href} className="group p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all">
                        <h3 className="font-medium text-sm text-foreground group-hover:text-primary transition-colors mb-1 leading-snug">{title}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-2">{desc}</p>
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">Read guide <ArrowRight className="h-3 w-3" /></span>
                      </Link>
                    ))}
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

export default Roofing;
