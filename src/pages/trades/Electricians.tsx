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
    { "@type": "ListItem", position: 2, name: "AI Receptionist for Electricians", item: "https://getringsnap.com/electricians" },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How does an AI receptionist help electricians specifically?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "RingSnap is trained to handle electrical calls: sparking panels, power outages, tripped breakers, and panel upgrade inquiries. It triages safety-critical emergencies immediately and routes them to your on-call electrician, while scheduling routine work automatically — even when you're on a jobsite."
      }
    },
    {
      "@type": "Question",
      name: "Can RingSnap handle electrical emergency calls at 2am?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. RingSnap answers 24/7 including nights and weekends. For genuine electrical emergencies (sparking panel, smell of burning, no power with medical equipment in use), the system dispatches immediately and alerts your on-call tech. Non-urgent calls get booked for the next business slot."
      }
    },
    {
      "@type": "Question",
      name: "Does RingSnap understand electrical safety triage?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. RingSnap is trained to ask the right questions: Is there a burning smell? Are there visible sparks? Is the situation life-threatening? Based on the answers, it escalates urgent calls immediately and handles routine calls — panel upgrades, outlet replacements — without pulling you off a job."
      }
    },
    {
      "@type": "Question",
      name: "Can RingSnap capture panel upgrade quote requests?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Panel upgrade inquiries that used to sit in voicemail are now captured, qualified, and booked as estimate appointments automatically. RingSnap collects panel size, square footage, and homeowner timeline so you arrive prepared."
      }
    },
    {
      "@type": "Question",
      name: "How long does setup take for an electrical contracting business?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "About 10 minutes. You forward your existing business number to RingSnap — no hardware, no new phone number, no IT setup. A 3-day free trial lets you verify the system works for your specific call types before committing."
      }
    }
  ]
};

const Electricians = () => {
  const config = getTradeConfig("electricians")!;

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
              <CallValueCalculator preselectedTrade="Electrical" />
              <ContractorPricing />

              {/* Related Electrical Resources */}
              <section aria-labelledby="electrical-resources-heading" className="section-spacer-compact bg-muted/30 border-t border-border/10">
                <div className="site-container max-w-4xl">
                  <h2 id="electrical-resources-heading" className="text-lg font-semibold mb-4">Free Electrician Field Guides</h2>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {[
                      { href: "/resources/electrician-call-answering-script", title: "Electrician Call Answering Script", desc: "Safety-first scripts for electrical emergencies, panel upgrades, and after-hours calls." },
                      { href: "/resources/electrical-safety-triage-questions", title: "Electrical Safety Triage Questions", desc: "The 8 dispatcher questions that assess danger and prioritize every electrical call." },
                      { href: "/resources/panel-upgrade-booking-script", title: "Panel Upgrade Booking Script", desc: "Book panel upgrade consultations by asking the right qualifying questions." },
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

export default Electricians;
