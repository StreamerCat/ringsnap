import { Helmet } from "react-helmet";
import { lazy, Suspense } from "react";
import { TradeHero } from "@/components/trades/TradeHero";
import { TradePainPoints } from "@/components/trades/TradePainPoints";
import { TradeTestimonials } from "@/components/trades/TradeTestimonials";
import { NextStepsStrip } from "@/components/NextStepsStrip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { getTradeConfig } from "@/components/trades/tradeConfig";

const CallValueCalculator = lazy(() => import("@/components/CallValueCalculator").then(m => ({ default: m.CallValueCalculator })));
const SolutionDemo = lazy(() => import("@/components/SolutionDemo").then(m => ({ default: m.SolutionDemo })));
const CompetitorComparison = lazy(() => import("@/components/CompetitorComparison").then(m => ({ default: m.CompetitorComparison })));
const ContractorPricing = lazy(() => import("@/components/ContractorPricing").then(m => ({ default: m.ContractorPricing })));
const ContractorFooter = lazy(() => import("@/components/ContractorFooter").then(m => ({ default: m.ContractorFooter })));
const MobileFooterCTA = lazy(() => import("@/components/MobileFooterCTA").then(m => ({ default: m.MobileFooterCTA })));

const Plumbers = () => {
  const config = getTradeConfig("plumbers")!;

  return (
    <>
      <Helmet>
        <title>{config.seo.title}</title>
        <meta name="description" content={config.seo.description} />
        <meta name="keywords" content={config.seo.keywords} />
        <link rel="canonical" href={config.seo.canonical} />
        
        <meta property="og:title" content={config.seo.title} />
        <meta property="og:description" content={config.seo.description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={config.seo.canonical} />
        
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={config.seo.title} />
        <meta name="twitter:description" content={config.seo.description} />
      </Helmet>

      <main className="pb-[calc(5rem+var(--safe-bottom))] md:pb-0">
        <h1 className="sr-only">{config.seo.title}</h1>

        <TradeHero config={config} />
        <TradePainPoints config={config} />
        <TradeTestimonials config={config} />

        <div id="main-content">
          <ErrorBoundary>
            <Suspense fallback={<div className="w-full h-64 flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>}>
              <CompetitorComparison />
              <SolutionDemo />
              <NextStepsStrip />
              <CallValueCalculator preselectedTrade="Plumbing" />
              <ContractorPricing />
              <ContractorFooter />
            </Suspense>
          </ErrorBoundary>
        </div>
        <MobileFooterCTA />
      </main>
    </>
  );
};

export default Plumbers;
