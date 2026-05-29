import { Helmet } from "react-helmet-async";
import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight, PhoneCall, CheckCircle, Clock, Wrench, Thermometer, Zap, Home } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const ContractorFooter = lazy(() => import("@/components/ContractorFooter").then(m => ({ default: m.ContractorFooter })));
const MobileFooterCTA = lazy(() => import("@/components/MobileFooterCTA").then(m => ({ default: m.MobileFooterCTA })));
const CallValueCalculator = lazy(() => import("@/components/CallValueCalculator").then(m => ({ default: m.CallValueCalculator })));

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://getringsnap.com/" },
    { "@type": "ListItem", position: 2, name: "Contractor Answering Service", item: "https://getringsnap.com/contractor-answering-service" },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is a contractor answering service?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A contractor answering service handles inbound calls for home service businesses — HVAC, plumbing, electrical, roofing — when the owner or team is unavailable. Traditional answering services use human operators. AI answering services like RingSnap use voice AI that sounds human, answers in under 2 rings, triages urgency, books jobs automatically, and operates 24/7 at a fraction of the cost of a live agent."
      }
    },
    {
      "@type": "Question",
      name: "How is an AI answering service different from a live answering service?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A live answering service (like Ruby or Smith.ai) employs human receptionists who answer on your behalf. They're trained on a script, can handle complex conversations, but cost $200-$400/month for limited call minutes and can't answer two calls simultaneously. An AI answering service like RingSnap answers every call instantly, handles unlimited concurrent calls, operates 24/7/365, and costs a fraction of live services — while being trained specifically for contractor call types."
      }
    },
    {
      "@type": "Question",
      name: "Which contractors benefit most from an answering service?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Any home service contractor who misses calls while on a job benefits significantly. HVAC contractors capturing AC breakdown calls during peak summer season, plumbers handling after-hours burst pipe emergencies, electricians triaging panel emergencies, and roofers capturing storm damage calls — these are the highest-ROI use cases. Typically 1-2 captured calls per week more than pays for the service."
      }
    },
    {
      "@type": "Question",
      name: "Does a contractor answering service work after hours?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. RingSnap operates 24/7/365 — nights, weekends, holidays. After-hours calls are a primary use case. The system triages urgency: life-threatening emergencies (gas leaks, electrical fires, burst pipes with flooding) are routed to you immediately. Other after-hours calls are captured and scheduled for the next business day."
      }
    },
    {
      "@type": "Question",
      name: "What does a contractor answering service cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "RingSnap starts at $59/month for night and weekend coverage. Full 24/7 plans start at $129/month. Compare that to a live answering service at $200-$400/month with limited minutes, or the cost of hiring a part-time receptionist. Most contractors capture enough additional work in the first week to cover the monthly cost."
      }
    }
  ]
};

const ContractorAnsweringService = () => {
  const navigate = useNavigate();

  const trades = [
    { href: "/plumbers", icon: Wrench, name: "Plumbers", desc: "Burst pipes, sewer backups, drain clogs, after-hours emergencies" },
    { href: "/hvac", icon: Thermometer, name: "HVAC", desc: "AC breakdowns, furnace failures, maintenance calls, price shoppers" },
    { href: "/electricians", icon: Zap, name: "Electricians", desc: "Sparking panels, power outages, panel upgrades, safety triage" },
    { href: "/roofing", icon: Home, name: "Roofers", desc: "Storm damage, emergency leaks, inspection bookings, insurance claims" },
  ];

  const features = [
    "Answers in under 2 rings, 24/7/365",
    "Triages emergency vs routine calls",
    "Books appointments automatically",
    "Full call transcript and job details logged",
    "Routes life-threatening calls to you immediately",
    "Works with your existing phone number",
    "No scripts to write — trained for contractor calls",
    "10-minute setup, no IT required",
  ];

  return (
    <>
      <Helmet>
        <title>Contractor Answering Service | AI Phone Answering for Contractors | RingSnap</title>
        <meta
          name="description"
          content="Stop missing contractor calls. RingSnap's AI answering service answers every call 24/7 for HVAC, plumbing, electrical, and roofing contractors — triages emergencies, books jobs, and costs less than a live service. Try free."
        />
        <meta
          name="keywords"
          content="contractor answering service, answering service for contractors, home service answering service, AI answering service contractors, phone answering service HVAC plumbing electrical roofing"
        />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://getringsnap.com/contractor-answering-service" />

        <meta property="og:title" content="Contractor Answering Service | AI Phone Answering | RingSnap" />
        <meta property="og:description" content="Stop missing contractor calls. RingSnap answers every call 24/7 for HVAC, plumbing, electrical, and roofing contractors — triages emergencies and books jobs automatically." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://getringsnap.com/contractor-answering-service" />
        <meta property="og:image" content="https://getringsnap.com/android-chrome-512x512.png" />
        <meta property="og:site_name" content="RingSnap" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Contractor Answering Service | AI Phone Answering | RingSnap" />
        <meta name="twitter:description" content="Stop missing contractor calls. RingSnap answers every call 24/7 for HVAC, plumbing, electrical, and roofing contractors." />
        <meta name="twitter:image" content="https://getringsnap.com/android-chrome-512x512.png" />

        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>

      <SiteHeader />
      <main className="pb-[calc(5rem+var(--safe-bottom))] md:pb-0 pt-14">

        {/* Hero */}
        <section className="relative overflow-hidden section-spacer bg-gradient-to-br from-off-white to-cream/30">
          <div className="site-container max-w-4xl text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-charcoal mb-6 leading-tight">
              Contractor Answering Service That Books Jobs — Not Just Takes Messages
            </h1>
            <p className="text-xl text-muted-foreground mb-4 max-w-2xl mx-auto">
              RingSnap answers every call for HVAC, plumbing, electrical, and roofing contractors — 24/7, in under 2 rings. Triages emergencies. Books appointments. Sounds human.
            </p>
            <p className="text-base text-muted-foreground mb-8 max-w-2xl mx-auto">
              The average contractor misses 6 calls on a busy day. At $600 per job, that's $3,600 in lost revenue — every single day you're without an answering service.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                className="text-lg h-14 px-8 font-semibold rounded-full"
                onClick={() => navigate('/start')}
              >
                <PhoneCall className="mr-2 h-5 w-5" />
                Start Free Trial
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-lg h-14 px-8 font-semibold rounded-full"
                asChild
              >
                <Link to="/pricing">See Pricing</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Trade-specific sections */}
        <section aria-labelledby="trades-heading" className="section-spacer bg-white border-t border-border/5">
          <div className="site-container">
            <div className="text-center mb-8">
              <h2 id="trades-heading" className="text-2xl sm:text-3xl font-bold mb-3">Built for every home service trade</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Unlike generic answering services, RingSnap is trained on contractor-specific call types — emergencies, price shoppers, seasonal surges, and after-hours calls for each trade.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {trades.map(({ href, icon: Icon, name, desc }) => (
                <Link
                  key={href}
                  to={href}
                  className="group flex flex-col gap-3 p-5 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">{name}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed flex-1">{desc}</p>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                    See how it works <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section aria-labelledby="features-heading" className="section-spacer bg-muted/30 border-t border-border/5">
          <div className="site-container max-w-3xl">
            <h2 id="features-heading" className="text-2xl sm:text-3xl font-bold mb-8 text-center">What RingSnap does for contractors</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {features.map((feature) => (
                <div key={feature} className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border">
                  <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-foreground">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Problem/pain section */}
        <section aria-labelledby="problem-heading" className="section-spacer bg-white border-t border-border/5">
          <div className="site-container max-w-3xl">
            <h2 id="problem-heading" className="text-2xl sm:text-3xl font-bold mb-6">Why contractors can't afford to miss calls</h2>
            <div className="space-y-4 text-base text-muted-foreground leading-relaxed">
              <p>
                Most home service contractors are solo operators or small crews. When you're under a sink, in an attic, or 30 feet up on a roof — you're not answering the phone. And every call that goes to voicemail is a potential job your competitor just answered.
              </p>
              <p>
                Live answering services charge $200-$400/month for limited call minutes and a human operator following a script. They're expensive, slow to answer during busy periods, and can't handle multiple calls simultaneously during a storm surge or summer HVAC season.
              </p>
              <p>
                RingSnap's AI answering service answers in under 2 rings, handles unlimited concurrent calls, operates 24/7/365 — including nights, weekends, and holidays — and is specifically trained for the call types your business gets. Not a generic receptionist reading from a script, but a voice agent that understands plumbing emergencies, HVAC urgency levels, electrical safety, and roofing storm season.
              </p>
              <p>
                The ROI is simple: one captured job per week typically more than covers the monthly cost. And unlike a live service, RingSnap never calls in sick, takes lunch, or misses a call because multiple customers are calling at once.
              </p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section aria-labelledby="how-heading" className="section-spacer bg-muted/30 border-t border-border/5">
          <div className="site-container max-w-3xl">
            <h2 id="how-heading" className="text-2xl sm:text-3xl font-bold mb-8 text-center">How the contractor answering service works</h2>
            <ol className="space-y-6">
              {[
                { step: "1", title: "Forward your number (takes 2 minutes)", desc: "Keep your existing business phone number. Set it to forward to your RingSnap number when you don't answer, or always-forward for full coverage." },
                { step: "2", title: "RingSnap answers every call", desc: "The AI agent answers in under 2 rings with your business name — professional, warm, and indistinguishable from a trained human dispatcher." },
                { step: "3", title: "Calls are triaged and handled", desc: "Emergencies get escalated immediately. Routine calls get booked. Price shoppers get qualified. Every caller gets the right response for their situation." },
                { step: "4", title: "You see everything in your dashboard", desc: "Every call creates a lead record with job type, urgency level, full transcript, and customer contact info. No missed details, no chasing voicemails." },
              ].map(({ step, title, desc }) => (
                <li key={step} className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">{step}</div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">{title}</h3>
                    <p className="text-sm text-muted-foreground">{desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* After hours CTA */}
        <section className="section-spacer-compact bg-charcoal/5 border-y border-charcoal/10">
          <div className="site-container max-w-3xl text-center">
            <Clock className="h-8 w-8 text-primary mx-auto mb-3" />
            <h2 className="text-2xl font-bold mb-3">Covers nights, weekends, and holidays too</h2>
            <p className="text-muted-foreground mb-5">
              After-hours calls are where contractors lose the most revenue. Homeowners with a burst pipe at midnight or an AC failure on a July 4th weekend can't wait. They'll call whoever answers — make sure that's you.
            </p>
            <Link to="/after-hours-answering-service" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
              Learn about after-hours coverage <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* FAQ Section */}
        <section aria-labelledby="faq-heading" className="section-spacer bg-white border-t border-border/5">
          <div className="site-container max-w-3xl">
            <h2 id="faq-heading" className="text-2xl font-bold mb-8 text-center">Contractor answering service FAQ</h2>
            <div className="space-y-4">
              {faqSchema.mainEntity.map((item) => (
                <div key={item.name} className="border border-border rounded-xl p-5">
                  <h3 className="font-semibold text-foreground mb-2">{item.name}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.acceptedAnswer.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Calculator */}
        <ErrorBoundary>
          <Suspense fallback={<div className="w-full h-64" aria-hidden="true" />}>
            <CallValueCalculator />
          </Suspense>
        </ErrorBoundary>

        {/* Internal links */}
        <section aria-labelledby="related-heading" className="section-spacer-compact bg-muted/30 border-t border-border/5">
          <div className="site-container max-w-3xl">
            <h2 id="related-heading" className="text-lg font-semibold mb-4">Related pages</h2>
            <div className="flex flex-wrap gap-3">
              <Link to="/after-hours-answering-service" className="px-4 py-2 rounded-full border border-border bg-background hover:border-primary/40 hover:text-primary text-sm transition-colors">After-Hours Answering Service</Link>
              <Link to="/missed-call-recovery" className="px-4 py-2 rounded-full border border-border bg-background hover:border-primary/40 hover:text-primary text-sm transition-colors">Missed Call Recovery</Link>
              <Link to="/compare/ringsnap-vs-ruby" className="px-4 py-2 rounded-full border border-border bg-background hover:border-primary/40 hover:text-primary text-sm transition-colors">RingSnap vs Ruby</Link>
              <Link to="/compare/ringsnap-vs-smith-ai" className="px-4 py-2 rounded-full border border-border bg-background hover:border-primary/40 hover:text-primary text-sm transition-colors">RingSnap vs Smith.ai</Link>
              <Link to="/pricing" className="px-4 py-2 rounded-full border border-border bg-background hover:border-primary/40 hover:text-primary text-sm transition-colors">Pricing</Link>
            </div>
          </div>
        </section>

        <ErrorBoundary>
          <Suspense fallback={<div className="w-full h-32" aria-hidden="true" />}>
            <ContractorFooter />
          </Suspense>
        </ErrorBoundary>

        <MobileFooterCTA />
      </main>
    </>
  );
};

export default ContractorAnsweringService;
