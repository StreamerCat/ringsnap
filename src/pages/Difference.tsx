import { Helmet } from "react-helmet-async";
import { lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { SiteHeader } from "@/components/SiteHeader";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RingSnapCallToCashInteractive } from "@/components/marketing/RingSnapCallToCashInteractive";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Phone, PhoneCall, CheckCircle2, Clock, Star, Settings, Users, Briefcase, MessageSquare, ArrowRight, Shield } from "lucide-react";
const ContractorTestimonials = lazy(() => import("@/components/ContractorTestimonials").then(m => ({
    default: m.ContractorTestimonials
})));
const ContractorPricing = lazy(() => import("@/components/ContractorPricing").then(m => ({
    default: m.ContractorPricing
})));
const ContractorFooter = lazy(() => import("@/components/ContractorFooter").then(m => ({
    default: m.ContractorFooter
})));
const MobileFooterCTA = lazy(() => import("@/components/MobileFooterCTA").then(m => ({
    default: m.MobileFooterCTA
})));
import { VoiceDemoWidget } from "@/components/VoiceDemoWidget";

const Difference = () => {
    const navigate = useNavigate();
    const scrollToDemo = () => {
        document.getElementById("live-demo")?.scrollIntoView({
            behavior: "smooth"
        });
    };
    return <>
        <Helmet>
            <title>The RingSnap Difference | Trained Front Desk for Home Services</title>
            <meta name="description" content="RingSnap answers calls in under 2 rings, handles real conversations, follows your rules, and learns from outcomes. Built for contractors." />
            <meta name="robots" content="index, follow" />
            <link rel="canonical" href="https://getringsnap.com/difference" />
            <meta property="og:title" content="The RingSnap Difference | Trained Front Desk for Home Services" />
            <meta property="og:description" content="RingSnap answers calls in under 2 rings, handles real conversations, follows your rules, and learns from outcomes." />
            <meta property="og:type" content="website" />
            <meta property="og:url" content="https://getringsnap.com/difference" />
            <meta property="og:image" content="https://getringsnap.com/android-chrome-512x512.png" />
            <meta property="og:site_name" content="RingSnap" />
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content="The RingSnap Difference" />
            <meta name="twitter:description" content="The trained front desk that books jobs and gets sharper over time." />
            <meta name="twitter:image" content="https://getringsnap.com/android-chrome-512x512.png" />
        </Helmet>

        <SiteHeader />
        <main className="pb-[calc(5rem+var(--safe-bottom))] md:pb-0 pt-14">
            <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:shadow-lg">
                Skip to main content
            </a>

            {/* SECTION 1: Hero */}
            <section className="section-spacer bg-gradient-to-br from-off-white to-cream/30">
                <div className="container mx-auto px-4 max-w-5xl">
                    <div className="text-center">
                        <h1 className="text-h1 mb-6">
                            The trained front desk that books jobs and gets sharper over time
                        </h1>
                        <p className="text-body-default text-muted-foreground max-w-3xl mx-auto mb-8 text-lg leading-relaxed">Built for home service pros. RingSnap answers in under 2 rings, handles real conversations, follows your rules, and uses outcomes and patterns to improve talk tracks and routing over time, within boundaries you control.</p>

                        {/* CTAs */}
                        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
                            <Button size="lg" variant="gradient" className="text-lg h-14 px-8 rounded-full" onClick={scrollToDemo}>
                                <PhoneCall className="mr-2 w-5 h-5" />
                                Hear a Live Call
                            </Button>
                            <Button size="lg" variant="outline" className="text-lg h-14 px-8 rounded-full border-2" onClick={() => navigate('/start')}>
                                Start Free Trial
                            </Button>
                        </div>

                        {/* Trust Bar */}
                        <div className="flex flex-wrap justify-center gap-4 sm:gap-6 text-sm">
                            <div className="flex items-center gap-2">
                                <Star className="w-4 h-4 text-primary fill-primary" />
                                <span>4.9/5 contractor rating</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-primary" />
                                <span>&lt; 1 second pickup</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4 text-primary" />
                                <span>95%+ call capture rate</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-primary" />
                                <span>Live in 10 minutes</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Shield className="w-4 h-4 text-primary" />
                                <span>Free trial</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* SECTION 2: Problem Framing */}
            <section className="section-spacer-compact bg-muted/30">
                <div className="container mx-auto px-4 max-w-4xl">
                    <div className="text-center mb-8">
                        <h2 className="text-h2 mb-4">Missed calls are missed jobs</h2>
                        <p className="text-body-default text-muted-foreground leading-relaxed">
                            Homeowners usually call 2 to 3 companies. The first real answer usually gets the job.
                            Voicemail kills conversions and wastes ad spend.
                        </p>
                    </div>

                    {/* NEPQ Micro Questions */}
                    <div className="max-w-2xl mx-auto space-y-3">
                        <div className="flex items-start gap-3 p-4 rounded-xl bg-white border">
                            <MessageSquare className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-foreground">How many calls hit voicemail in a normal week?</p>
                        </div>
                        <div className="flex items-start gap-3 p-4 rounded-xl bg-white border">
                            <MessageSquare className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-foreground">What would it do to revenue if you answered first every time?</p>
                        </div>
                        <div className="flex items-start gap-3 p-4 rounded-xl bg-white border">
                            <MessageSquare className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-foreground">What happens when your best receptionist is busy, out, or it's after hours?</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* SECTION 3: Mechanism Centerpiece */}
            <section id="mechanism-section" className="section-spacer bg-background">
                <div id="main-content" className="container mx-auto px-4 max-w-6xl">
                    <div className="text-center mb-4">
                        <p className="text-body-small uppercase tracking-widest text-primary font-semibold mb-2">
                            The System
                        </p>
                        <p className="text-body-default text-muted-foreground">
                            This is the system. Not a script. Not a chatbot.
                        </p>
                    </div>

                    {/* Premium container for the interactive module */}
                    <div className="card-tier-1 p-6 sm:p-10 mb-6">
                        <RingSnapCallToCashInteractive />
                    </div>

                    {/* Micro trust line */}
                    <p className="text-center text-sm text-muted-foreground max-w-2xl mx-auto">
                        You set the rules and boundaries. RingSnap escalates when unsure. Calls are not shared with other businesses.
                    </p>
                </div>
            </section>

            {/* SECTION 3.5: Voice Demo */}
            <section id="live-demo" className="section-spacer bg-background pt-0">
                <div className="container mx-auto px-4 max-w-4xl">
                    <div className="text-center mb-8">
                        <h2 className="text-h2 mb-4">Hear it in action</h2>
                        <p className="text-body-default text-muted-foreground">
                            Real-time AI voice that sounds human and handles complexity.
                        </p>
                    </div>

                    <div className="rounded-xl overflow-hidden border-2 shadow-xl min-h-[400px] sm:min-h-[500px] bg-[#FAF9F6] flex items-center justify-center relative border-primary/20">
                        <VoiceDemoWidget />
                    </div>
                </div>
            </section>

            {/* SECTION 4: It Learns Three Things */}
            <section className="section-spacer bg-muted/30">
                <div className="container mx-auto px-4 max-w-6xl">
                    <div className="text-center mb-10">
                        <h2 className="text-h2 mb-4">It learns the instincts that great
                            businesses rely on</h2>
                    </div>

                    {/* Bento Cards */}
                    <div className="grid md:grid-cols-3 gap-6 mb-10">
                        <Card className="card-tier-2">
                            <CardContent className="p-6">
                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                    <Briefcase className="w-6 h-6 text-primary" />
                                </div>
                                <h3 className="font-bold text-lg mb-2">Industry intelligence</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Learns common homeowner questions, urgency patterns, and objections using anonymized,
                                    aggregated insights across each trade.
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="card-tier-2">
                            <CardContent className="p-6">
                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                    <Settings className="w-6 h-6 text-primary" />
                                </div>
                                <h3 className="font-bold text-lg mb-2">Your business intelligence</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Adapts to your service area, hours, pricing boundaries, warranties, emergency rules,
                                    and how you want calls handled and routed.
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="card-tier-2">
                            <CardContent className="p-6">
                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                    <Users className="w-6 h-6 text-primary" />
                                </div>
                                <h3 className="font-bold text-lg mb-2">Caller context</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Remembers what was asked and what happened so follow ups and future calls stay
                                    consistent, accurate, and professional.
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Close line */}
                    <p className="text-center font-semibold text-lg max-w-3xl mx-auto">
                        It compounds the instincts of your best employee and applies them consistently on every call,
                        within the boundaries you control.
                    </p>
                </div>
            </section>

            {/* SECTION 5: Control and Safety */}
            <section className="section-spacer bg-background">
                <div className="container mx-auto px-4 max-w-4xl">
                    <div className="text-center mb-10">
                        <h2 className="text-h2 mb-4">You stay in control</h2>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto mb-8">
                        <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/50">
                            <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                            <p className="text-sm">Set your rules: hours, service area, pricing boundaries, emergency handling</p>
                        </div>
                        <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/50">
                            <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                            <p className="text-sm">Define when to book and when to transfer</p>
                        </div>
                        <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/50">
                            <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                            <p className="text-sm">Get clean summaries and logs for every call</p>
                        </div>
                        <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/50">
                            <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                            <p className="text-sm">Keep a consistent talk track across your team</p>
                        </div>
                    </div>

                    {/* Privacy note */}
                    <p className="text-center text-sm text-muted-foreground max-w-xl mx-auto">
                        Your calls are isolated to your account. Trade insights are anonymized and aggregated.
                    </p>
                </div>
            </section>

            {/* SECTION 6: Proof */}
            <ErrorBoundary>
                <Suspense fallback={<div className="w-full h-64 flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>}>
                    <div className="relative">
                        {/* Helper line above */}
                        <div className="bg-muted/30 pt-8 pb-0">
                            <p className="text-center text-sm text-muted-foreground">Not demos. These are real outcomes from home service teams.</p>
                        </div>
                        <ContractorTestimonials />
                    </div>
                </Suspense>
            </ErrorBoundary>

            {/* SECTION 7: Setup */}
            <section className="section-spacer bg-background">
                <div className="container mx-auto px-4 max-w-4xl">
                    <div className="text-center mb-10">
                        <h2 className="text-h2 mb-4">Live in 10 minutes</h2>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6 mb-8">
                        <div className="text-center p-6">
                            <div className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                                1
                            </div>
                            <h3 className="font-semibold mb-2">Forward your number</h3>
                        </div>
                        <div className="text-center p-6">
                            <div className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                                2
                            </div>
                            <h3 className="font-semibold mb-2">Test a call</h3>
                        </div>
                        <div className="text-center p-6">
                            <div className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                                3
                            </div>
                            <h3 className="font-semibold mb-2">Start booking</h3>
                        </div>
                    </div>

                    <p className="text-center text-sm text-muted-foreground">
                        No scripts to write. No agents to hire.
                    </p>
                </div>
            </section>

            {/* SECTION 8: Pricing Teaser */}
            <section className="section-spacer-compact bg-muted/30">
                <div className="container mx-auto px-4 max-w-4xl">
                    <div className="text-center mb-8">
                        <h2 className="text-h2 mb-4">Simple pricing, no per agent fees</h2>
                    </div>

                    <Card className="card-tier-2 max-w-md mx-auto">
                        <CardContent className="p-6 text-center">
                            <p className="text-muted-foreground mb-4">
                                Starting at <span className="font-bold text-2xl text-foreground">$297/month</span>
                            </p>
                            <p className="text-sm text-muted-foreground mb-6">
                                Transparent pricing. No setup fees. Cancel anytime.
                            </p>
                            <Button variant="gradient" className="rounded-full px-8" onClick={() => navigate('/pricing')}>
                                See Pricing <ArrowRight className="ml-2 w-4 h-4" />
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </section>



            {/* SECTION 10: Final CTA */}
            <section className="section-spacer bg-gradient-to-br from-cream/30 to-off-white">
                <div className="container mx-auto px-4 max-w-4xl text-center">
                    <h2 className="text-h2 mb-8">
                        Your next customer is calling right now. Will you answer?
                    </h2>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Button size="lg" variant="gradient" className="text-lg h-14 px-8 rounded-full" onClick={scrollToDemo}>
                            <PhoneCall className="mr-2 w-5 h-5" />
                            Hear a Live Call
                        </Button>
                        <Button size="lg" variant="outline" className="text-lg h-14 px-8 rounded-full border-2" onClick={() => navigate('/start')}>
                            Start Free Trial
                        </Button>
                    </div>
                </div>
            </section>

            {/* Footer Section */}
            <ErrorBoundary>
                <Suspense fallback={<div className="w-full h-64 flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>}>
                    <ContractorFooter />
                </Suspense>
            </ErrorBoundary>

            <MobileFooterCTA />
        </main>
    </>;
};
export default Difference;