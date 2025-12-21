import { Helmet } from "react-helmet-async";
import { lazy, Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Shield, Clock, CreditCard } from "lucide-react";

const ContractorPricing = lazy(() => import("@/components/ContractorPricing").then(m => ({ default: m.ContractorPricing })));
const ContractorFooter = lazy(() => import("@/components/ContractorFooter").then(m => ({ default: m.ContractorFooter })));
const MobileFooterCTA = lazy(() => import("@/components/MobileFooterCTA").then(m => ({ default: m.MobileFooterCTA })));

const Pricing = () => {
    return (
        <>
            <Helmet>
                <title>Pricing | RingSnap AI Answering Service for Contractors</title>
                <meta
                    name="description"
                    content="Simple, transparent pricing for RingSnap AI answering service. Starting at $297/month. No setup fees. No per-agent fees. 3-day free trial. Cancel anytime."
                />
                <link rel="canonical" href="https://www.getringsnap.com/pricing" />
                <meta property="og:title" content="Pricing | RingSnap AI Answering Service" />
                <meta property="og:description" content="Simple pricing. No per-agent fees. Starting at $297/month with a 3-day free trial." />
                <meta property="og:type" content="website" />
                <meta property="og:url" content="https://www.getringsnap.com/pricing" />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content="Pricing | RingSnap" />
                <meta name="twitter:description" content="AI answering service pricing. No setup fees. Cancel anytime." />
            </Helmet>

            <SiteHeader />
            <main className="pb-[calc(5rem+var(--safe-bottom))] md:pb-0 pt-14">
                <a
                    href="#main-content"
                    className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:shadow-lg"
                >
                    Skip to main content
                </a>

                {/* Hero Section */}
                <section
                    aria-labelledby="pricing-hero-heading"
                    className="section-spacer bg-gradient-to-br from-off-white to-cream/30"
                >
                    <div className="container mx-auto px-4 max-w-4xl text-center">
                        <h1
                            id="pricing-hero-heading"
                            className="text-h1 mb-6"
                            style={{ color: 'hsl(var(--charcoal))' }}
                        >
                            Pricing as simple as a{" "}
                            <span style={{ color: 'hsl(var(--primary))' }}>handshake</span>
                        </h1>
                        <p className="text-body-default text-muted-foreground max-w-2xl mx-auto mb-8 text-lg leading-relaxed">
                            Transparent pricing. No setup fees. Cancel anytime.
                        </p>

                        {/* Risk Reversal Trust Bar */}
                        <div className="flex flex-col sm:flex-row justify-center gap-4 sm:gap-8 text-sm">
                            <div className="flex items-center justify-center gap-2">
                                <Shield className="w-5 h-5 text-primary" aria-hidden="true" />
                                <span className="font-medium">3-Day Free Trial</span>
                            </div>
                            <div className="flex items-center justify-center gap-2">
                                <Clock className="w-5 h-5 text-primary" aria-hidden="true" />
                                <span className="font-medium">Cancel Anytime</span>
                            </div>
                            <div className="flex items-center justify-center gap-2">
                                <CreditCard className="w-5 h-5 text-primary" aria-hidden="true" />
                                <span className="font-medium">No Setup Fees</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Pricing Section - Reuses existing ContractorPricing */}
                <div id="main-content">
                    <ErrorBoundary>
                        <Suspense fallback={
                            <div className="w-full h-64 flex items-center justify-center" aria-busy="true">
                                <div className="animate-pulse text-muted-foreground">Loading pricing...</div>
                            </div>
                        }>
                            <ContractorPricing showHeading={false} className="pt-0 sm:pt-0 lg:pt-0" />
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
