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
    { "@type": "ListItem", position: 2, name: "AI Receptionist for Handymen", item: "https://getringsnap.com/handyman" },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How does an AI receptionist help handymen specifically?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "RingSnap handles the range of calls a handyman business gets: estimate requests, urgent repair calls, routine maintenance bookings, and schedule changes. When you're in the middle of a job and can't pick up, RingSnap answers immediately, collects job details, and books the appointment — so you finish the job you're on without losing the next one."
      }
    },
    {
      "@type": "Question",
      name: "Will RingSnap work for after-hours handyman calls?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Homeowners often think of repair needs on evenings and weekends. RingSnap answers 24/7 — urgent calls get immediate attention, and non-urgent repair requests get booked for your next available slot. You wake up to a full schedule instead of missed calls."
      }
    },
    {
      "@type": "Question",
      name: "Can RingSnap handle estimate requests for different types of jobs?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. RingSnap collects the key details for any job type — scope of work, property address, timeline, photos (via follow-up text), and homeowner contact info — and books an estimate appointment. You arrive prepared rather than playing phone tag to gather information."
      }
    },
    {
      "@type": "Question",
      name: "What if a homeowner calls about multiple repair tasks?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "RingSnap captures all the work the homeowner needs, collects the full list, and books a single estimate or appointment that covers everything. No detail gets lost to voicemail. You show up knowing exactly what the job entails."
      }
    },
    {
      "@type": "Question",
      name: "How long does it take to set up RingSnap for a handyman business?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "About 10 minutes. Forward your existing business number to RingSnap — no hardware, no new phone number, no IT setup required. A 3-day free trial lets you verify the system works for your call types before you pay anything."
      }
    }
  ]
};

const Handyman = () => {
  const config = getTradeConfig("handyman")!;

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
              <CallValueCalculator preselectedTrade="Handyman" />
              <ContractorPricing />

              {/* Related Handyman Resources */}
              <section aria-labelledby="handyman-resources-heading" className="section-spacer-compact bg-muted/30 border-t border-border/10">
                <div className="site-container max-w-4xl">
                  <h2 id="handyman-resources-heading" className="text-lg font-semibold mb-4">Free Field Guides for Home Service Pros</h2>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {[
                      { href: "/resources/missed-call-revenue-calculator", title: "Missed Call Revenue Calculator", desc: "See exactly how much revenue your shop loses from unanswered calls each month." },
                      { href: "/resources/increase-average-ticket", title: "Average Revenue Per Job Growth Planner", desc: "Plan your average ticket increase with upsell menus and revenue projections." },
                      { href: "/resources/after-hours-call-calculator", title: "After-Hours Revenue Calculator", desc: "Calculate the revenue hiding in your after-hours and weekend call volume." },
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

export default Handyman;
