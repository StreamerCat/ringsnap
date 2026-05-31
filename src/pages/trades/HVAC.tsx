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
    { "@type": "ListItem", position: 2, name: "AI Receptionist for HVAC", item: "https://getringsnap.com/hvac" },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How does an AI receptionist help HVAC contractors specifically?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "RingSnap is trained for HVAC calls: AC breakdowns, furnace failures, gas leaks, and maintenance requests. It triages urgency, handles emergency dispatch instantly, and books routine maintenance calls — all without you leaving the jobsite."
      }
    },
    {
      "@type": "Question",
      name: "Will RingSnap work for after-hours HVAC emergencies?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. HVAC emergencies don't wait for business hours. RingSnap answers 24/7, triages the severity (no AC in 100°F heat is different from a minor leak), and routes genuine emergencies to your on-call tech immediately. All other calls get booked for the next available slot."
      }
    },
    {
      "@type": "Question",
      name: "Can RingSnap handle HVAC maintenance contract inquiries?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. RingSnap captures every maintenance inquiry — tune-ups, filter service, seasonal inspections — and books them directly. Maintenance contract opportunities that used to go to voicemail now turn into scheduled appointments."
      }
    },
    {
      "@type": "Question",
      name: "Does RingSnap integrate with HVAC field service software?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "RingSnap integrates with Jobber and logs every call — job type, urgency, customer contact info, and full transcript — automatically to your account. You'll see every call, booking, and customer interaction in one place."
      }
    },
    {
      "@type": "Question",
      name: "How long does it take to set up RingSnap for an HVAC business?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Setup takes about 10 minutes. Forward your existing business number to RingSnap — no new phone number, no hardware, no IT required. You start a 3-day free trial and can verify it works before committing."
      }
    }
  ]
};

const HVAC = () => {
  const config = getTradeConfig("hvac")!;

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
              <CallValueCalculator preselectedTrade="HVAC" />
              <ContractorPricing />

              {/* Related HVAC Resources */}
              <section aria-labelledby="hvac-resources-heading" className="section-spacer-compact bg-muted/30 border-t border-border/10">
                <div className="site-container max-w-4xl">
                  <h2 id="hvac-resources-heading" className="text-lg font-semibold mb-4">Free HVAC Field Guides</h2>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {[
                      { href: "/resources/hvac-dispatcher-script-template", title: "HVAC Dispatcher Script Template", desc: "Copy/paste scripts for standard calls, emergencies, and price shoppers." },
                      { href: "/resources/hvac-after-hours-answering-script", title: "HVAC After-Hours Answering Script", desc: "Handle overnight and weekend HVAC calls with professional scripts." },
                      { href: "/resources/hvac-emergency-call-triage", title: "HVAC Emergency Call Triage", desc: "Know when to dispatch immediately vs schedule — gas leaks, no-heat calls." },
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

export default HVAC;
