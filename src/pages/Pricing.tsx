import { Helmet } from "react-helmet-async";
import { lazy, Suspense, useEffect } from "react";
import { Link } from "react-router-dom";
import { SiteHeader } from "@/components/SiteHeader";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { featureFlags } from "@/lib/featureFlags";
import { capture } from "@/lib/analytics";

const ContractorPricing = lazy(() => import("@/components/ContractorPricing").then(m => ({ default: m.ContractorPricing })));
const ContractorFooter = lazy(() => import("@/components/ContractorFooter").then(m => ({ default: m.ContractorFooter })));
const MobileFooterCTA = lazy(() => import("@/components/MobileFooterCTA").then(m => ({ default: m.MobileFooterCTA })));

const Pricing = () => {
    useEffect(() => {
        capture('pricing_page_viewed', {}, { dedupKey: 'pricing_page_viewed', dedupWindowMs: 10000 });
    }, []);

    const softwareApplicationSchema = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "RingSnap",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web",
        "url": "https://getringsnap.com/pricing",
        "description": "AI receptionist built exclusively for home service contractors — answers calls 24/7, books jobs, logs to CRM. Priced per handled call. Starting at $59/month.",
        "offers": [
            {
                "@type": "Offer",
                "name": "Night & Weekend Plan",
                "description": "60 handled calls/month, after-hours only",
                "price": "59",
                "priceCurrency": "USD",
                "url": "https://getringsnap.com/pricing"
            },
            {
                "@type": "Offer",
                "name": "Lite Plan",
                "description": "125 handled calls/month, 24/7",
                "price": "129",
                "priceCurrency": "USD",
                "url": "https://getringsnap.com/pricing"
            },
            {
                "@type": "Offer",
                "name": "Core Plan",
                "description": "250 handled calls/month, 24/7",
                "price": "229",
                "priceCurrency": "USD",
                "url": "https://getringsnap.com/pricing"
            },
            {
                "@type": "Offer",
                "name": "Pro Plan",
                "description": "450 handled calls/month, 24/7",
                "price": "449",
                "priceCurrency": "USD",
                "url": "https://getringsnap.com/pricing"
            }
        ]
    };

    const pricingFaqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": "How much does RingSnap cost?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "RingSnap starts at $59/month for the Night & Weekend plan (after-hours coverage, 60 calls/mo). Lite is $129/month (125 calls/mo), Core is $229/month (250 calls/mo), and Pro is $449/month (450 calls/mo). All plans include a 3-day free trial."
                }
            },
            {
                "@type": "Question",
                "name": "Is there a free trial?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Yes. All RingSnap plans include a 3-day free trial with up to 15 free handled calls. Card required at signup to reserve your number. Cancel anytime."
                }
            },
            {
                "@type": "Question",
                "name": "What happens if I go over my included calls?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "By default, RingSnap keeps answering every call and bills overage at your plan's per-call rate (Night & Weekend $1.10/call, Lite $0.95/call, Core $0.85/call, Pro $0.75/call). You're alerted at 80% and 100% usage. You can also set a buffer or hard stop in your dashboard."
                }
            },
            {
                "@type": "Question",
                "name": "Are there setup fees or long-term contracts?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "No setup fees and no long-term contracts. Month-to-month. Cancel anytime."
                }
            }
        ]
    };

    return (
        <>
            <Helmet>
                <title>Pricing | RingSnap AI Receptionist for Home Service Contractors</title>
                <meta
                    name="description"
                    content="RingSnap AI receptionist pricing starts at $59/month. Built for HVAC, plumbing, electrical, handyman, and roofing contractors. CRM included on every plan. 3-day free trial."
                />
                <meta name="robots" content="index, follow" />
                <link rel="canonical" href="https://getringsnap.com/pricing" />
                <meta property="og:title" content="Pricing | RingSnap AI Receptionist for Contractors" />
                <meta property="og:description" content="Stop losing $4,200/month to missed calls. RingSnap starts at $59/mo. CRM included. 3-day free trial." />
                <meta property="og:type" content="website" />
                <meta property="og:url" content="https://getringsnap.com/pricing" />
                <meta property="og:image" content="https://getringsnap.com/android-chrome-512x512.png" />
                <meta property="og:image:width" content="512" />
                <meta property="og:image:height" content="512" />
                <meta property="og:image:type" content="image/png" />
                <meta property="og:site_name" content="RingSnap" />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content="Pricing | RingSnap AI Receptionist" />
                <meta name="twitter:description" content="AI receptionist for contractors. Starts at $59/mo. 3-day free trial. No contracts." />
                <meta name="twitter:image" content="https://getringsnap.com/android-chrome-512x512.png" />

                {featureFlags.enhancedMarketingSchema && (
                    <>
                        <script type="application/ld+json">
                            {JSON.stringify(softwareApplicationSchema)}
                        </script>
                        <script type="application/ld+json">
                            {JSON.stringify(pricingFaqSchema)}
                        </script>
                    </>
                )}
            </Helmet>

            <SiteHeader />
            <main className="pb-[calc(5rem+var(--safe-bottom))] md:pb-0 pt-14">
                <a
                    href="#main-content"
                    className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:shadow-lg"
                >
                    Skip to main content
                </a>

                <div id="main-content">
                    <ErrorBoundary>
                        <Suspense fallback={
                            <div className="w-full h-64 flex items-center justify-center" aria-busy="true">
                                <div className="animate-pulse text-muted-foreground">Loading pricing...</div>
                            </div>
                        }>
                            <ContractorPricing showHeading={true} />

                            {/* Compare alternatives */}
                            <section aria-labelledby="pricing-compare-heading" className="section-spacer-compact bg-muted/30 border-t border-border/10">
                                <div className="site-container max-w-3xl text-center">
                                    <h2 id="pricing-compare-heading" className="text-lg font-semibold mb-3">Comparing your options?</h2>
                                    <p className="text-sm text-muted-foreground mb-5">See how RingSnap stacks up against the alternatives most contractors consider before signing up.</p>
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
                </div>

                <MobileFooterCTA />
            </main>
        </>
    );
};

export default Pricing;
