import { Helmet } from "react-helmet-async";
import { lazy, Suspense } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SiteHeader } from "@/components/SiteHeader";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, ArrowRight, Star, Shield, Clock, Phone, ClipboardList, Zap } from "lucide-react";

const ContractorFooter = lazy(() =>
  import("@/components/ContractorFooter").then((m) => ({ default: m.ContractorFooter }))
);
const MobileFooterCTA = lazy(() =>
  import("@/components/MobileFooterCTA").then((m) => ({ default: m.MobileFooterCTA }))
);

const pageSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Best AI Receptionist for Home Service Contractors",
  description:
    "What to look for in an AI receptionist for HVAC, plumbing, electrical, and roofing businesses — and how RingSnap compares.",
  url: "https://getringsnap.com/compare/best-ai-receptionist-home-services",
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is the best AI receptionist for home service contractors?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The best AI receptionist for home service contractors is one built specifically for the trades — with contractor-specific emergency routing, built-in CRM, job-type classification, Jobber integration, and 24/7 true coverage. RingSnap is purpose-built for HVAC, plumbing, electrical, and roofing contractors with all of these capabilities starting at $59/month.",
      },
    },
    {
      "@type": "Question",
      name: "What should I look for in an AI receptionist for my contracting business?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Look for: (1) True 24/7 coverage with instant pickup, (2) Emergency routing specific to your trade, (3) Built-in lead capture and CRM, (4) Integration with your field service software, (5) Consistent performance that improves over time, (6) Flat-rate pricing that doesn't spike with call volume.",
      },
    },
    {
      "@type": "Question",
      name: "How much does an AI receptionist cost for contractors?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "AI receptionist pricing for contractors varies. RingSnap starts at $59/month for night and weekend coverage, $129/month for full after-hours plus daytime overflow, $229/month for full 24/7, and $399/month for high-volume with advanced features. All plans include a 3-day free trial.",
      },
    },
  ],
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://getringsnap.com/" },
    { "@type": "ListItem", position: 2, name: "Compare", item: "https://getringsnap.com/compare" },
    {
      "@type": "ListItem",
      position: 3,
      name: "Best AI Receptionist for Home Services",
      item: "https://getringsnap.com/compare/best-ai-receptionist-home-services",
    },
  ],
};

const criteria = [
  {
    icon: Phone,
    title: "True 24/7 coverage",
    desc: "Not 'extended hours.' Every call answered instantly — 2am on Christmas, Saturday afternoon peak, holiday weekends. Home service emergencies don't keep business hours.",
    ringsnap: "Answers in under 1 second, 24/7/365.",
  },
  {
    icon: Zap,
    title: "Emergency routing built for your trade",
    desc: "A burst pipe, no heat with elderly residents, or a live electrical hazard needs an immediate transfer — not a message. Generic call routing isn't good enough.",
    ringsnap: "Life-threatening emergencies transferred in under 5 seconds with full context.",
  },
  {
    icon: ClipboardList,
    title: "Built-in CRM and lead capture",
    desc: "Every call should create a lead record — not a raw transcript your team has to interpret. Job type, urgency, what was booked, what wasn't. Ready for your team to act on.",
    ringsnap: "Every call creates a lead record with job type, urgency, and full transcript.",
  },
  {
    icon: ArrowRight,
    title: "Integration with field service software",
    desc: "Lead data captured on the call should flow into Jobber or your existing platform automatically. Manual re-entry wastes time and introduces errors.",
    ringsnap: "Direct Jobber integration. More integrations in development.",
  },
  {
    icon: Star,
    title: "Trade-specific knowledge",
    desc: "A general AI doesn't know the difference between a tune-up call and a no-cool emergency in July. Contractor-specific AI handles your calls the way your best dispatcher would.",
    ringsnap: "Built for HVAC, plumbing, electrical, and roofing — not adapted from a generic template.",
  },
  {
    icon: Shield,
    title: "Pricing that scales without surprises",
    desc: "Busy season shouldn't break the bank. Per-minute pricing from a live answering service can spike unpredictably. Flat-rate AI pricing keeps costs predictable.",
    ringsnap: "Flat monthly pricing. Overage rates are clear and disclosed upfront.",
  },
];

const BestAiReceptionistHomeServices = () => {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>Best AI Receptionist for Home Service Contractors | RingSnap</title>
        <meta
          name="description"
          content="What makes the best AI receptionist for HVAC, plumbing, electrical, and roofing contractors? 6 criteria that matter — and how to evaluate your options."
        />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://getringsnap.com/compare/best-ai-receptionist-home-services" />

        <meta property="og:title" content="Best AI Receptionist for Home Service Contractors | RingSnap" />
        <meta
          property="og:description"
          content="6 criteria for choosing an AI receptionist for HVAC, plumbing, electrical, and roofing — plus how RingSnap stacks up."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://getringsnap.com/compare/best-ai-receptionist-home-services" />
        <meta property="og:image" content="https://getringsnap.com/android-chrome-512x512.png" />
        <meta property="og:image:width" content="512" />
        <meta property="og:image:height" content="512" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:site_name" content="RingSnap" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Best AI Receptionist for Home Service Contractors" />
        <meta
          name="twitter:description"
          content="6 criteria for choosing an AI receptionist for HVAC, plumbing, electrical, and roofing contractors."
        />
        <meta name="twitter:image" content="https://getringsnap.com/android-chrome-512x512.png" />

        <script type="application/ld+json">{JSON.stringify(pageSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
      </Helmet>

      <SiteHeader />
      <main className="pb-[calc(5rem+var(--safe-bottom))] md:pb-0 pt-14">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:shadow-lg"
        >
          Skip to main content
        </a>

        {/* HERO */}
        <section className="section-spacer bg-gradient-to-br from-off-white to-cream/30">
          <div className="site-container max-w-4xl text-center">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">
              Buyer's Guide
            </p>
            <h1 className="text-h1 mb-6">
              Best AI receptionist for home service contractors: what to look for
            </h1>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto mb-8 leading-relaxed">
              Not all AI receptionists are built for contractors. This guide covers the six criteria that
              actually matter for HVAC, plumbing, electrical, and roofing businesses — so you can evaluate
              your options with the right questions.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
              <Button
                size="lg"
                variant="gradient"
                className="text-lg h-14 px-8 rounded-full"
                onClick={() => navigate("/start")}
              >
                Try RingSnap Free
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-lg h-14 px-8 rounded-full border-2"
                onClick={() => navigate("/pricing")}
              >
                See Pricing <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>

            <div className="flex flex-wrap justify-center gap-4 sm:gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-primary fill-primary" />
                <span>4.9/5 contractor rating</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <span>Live in 10 minutes</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <span>3-day free trial</span>
              </div>
            </div>
          </div>
        </section>

        {/* WHY GENERIC DOESN'T WORK */}
        <section id="main-content" className="section-spacer-compact bg-muted/30">
          <div className="site-container max-w-3xl text-center">
            <h2 className="text-xl font-semibold mb-4">Why a generic AI receptionist falls short for contractors</h2>
            <p className="text-muted-foreground leading-relaxed">
              A restaurant or law firm can use a general-purpose AI phone agent. Contractors can't.
              Your calls involve real emergencies, complex triage decisions, and job-type data that
              needs to flow into field service software. Generic AI isn't trained for this. Contractor-specific
              AI is — and the difference shows up in every call.
            </p>
          </div>
        </section>

        {/* 6 CRITERIA */}
        <section className="section-spacer bg-background">
          <div className="site-container max-w-5xl">
            <div className="text-center mb-10">
              <h2 className="text-h2 mb-4">6 criteria for choosing an AI receptionist for your contracting business</h2>
            </div>

            <div className="space-y-6">
              {criteria.map(({ icon: Icon, title, desc, ringsnap }, i) => (
                <Card key={title} className="bg-white">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <h3 className="font-semibold text-lg">
                            {i + 1}. {title}
                          </h3>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed mb-3">{desc}</p>
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                          <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                          <p className="text-sm font-medium">
                            <span className="text-primary">RingSnap: </span>
                            {ringsnap}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* WHAT RINGSNAP IS */}
        <section className="section-spacer bg-muted/30">
          <div className="site-container max-w-4xl">
            <div className="text-center mb-10">
              <h2 className="text-h2 mb-4">Why RingSnap is built for home service contractors</h2>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mb-8">
              {[
                "Built exclusively for HVAC, plumbing, electrical, and roofing — not a general-purpose tool adapted for trades",
                "Answers every call in under 1 second — 24/7, including nights, weekends, and holidays",
                "Emergency routing trained on contractor call patterns, not generic escalation rules",
                "Built-in CRM captures every call as a lead with job type, urgency, and full transcript",
                "Jobber integration: lead data flows into your field service workflow automatically",
                "Starts at $59/month — flat-rate pricing that doesn't spike during busy season",
                "Setup takes about 10 minutes — forward your number, test a call, start booking",
                "95%+ call capture rate — the average contractor misses 6+ calls every busy Saturday",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 p-4 rounded-xl bg-white border">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-sm">{item}</p>
                </div>
              ))}
            </div>

            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Compare specific options:{" "}
                <Link to="/compare/ringsnap-vs-ruby" className="text-primary hover:underline">
                  RingSnap vs Ruby
                </Link>{" "}
                ·{" "}
                <Link to="/compare/ringsnap-vs-smith-ai" className="text-primary hover:underline">
                  RingSnap vs Smith.ai
                </Link>{" "}
                ·{" "}
                <Link to="/compare/ringsnap-vs-goodcall" className="text-primary hover:underline">
                  RingSnap vs Goodcall
                </Link>{" "}
                ·{" "}
                <Link to="/compare/ai-receptionist-vs-live-answering" className="text-primary hover:underline">
                  AI vs live answering
                </Link>
              </p>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section className="section-spacer bg-background">
          <div className="site-container max-w-4xl">
            <div className="text-center mb-8">
              <h2 className="text-h2 mb-4">RingSnap pricing for home service contractors</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                All plans include a built-in CRM, emergency routing, and a 3-day free trial. Credit card required to start. No long-term contracts.
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left p-4 font-semibold">Plan</th>
                    <th className="text-center p-4 font-semibold">Price</th>
                    <th className="text-left p-4 font-semibold">Coverage</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { plan: "Night & Weekend", price: "$59/month", coverage: "After-hours and weekend calls" },
                    { plan: "Lite", price: "$129/month", coverage: "Unlimited after-hours + daytime overflow" },
                    { plan: "Core", price: "$229/month", coverage: "Full 24/7 with multi-language support" },
                    { plan: "Pro", price: "$399/month", coverage: "Full 24/7, highest volume, advanced features" },
                  ].map(({ plan, price, coverage }, i) => (
                    <tr key={plan} className={i % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                      <td className="p-4 font-medium">{plan}</td>
                      <td className="p-4 text-center font-semibold text-primary">{price}</td>
                      <td className="p-4 text-muted-foreground">{coverage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-center mt-4">
              <Link to="/pricing" className="text-primary hover:underline text-sm font-medium">
                See full pricing details and plan comparison →
              </Link>
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="section-spacer bg-muted/30">
          <div className="site-container max-w-3xl">
            <div className="text-center mb-10">
              <h2 className="text-h2 mb-4">Frequently asked questions</h2>
            </div>

            <div className="space-y-6">
              {[
                {
                  q: "What is the best AI receptionist for HVAC contractors?",
                  a: "For HVAC contractors specifically, look for an AI receptionist with true 24/7 coverage (critical during no-heat/no-cool emergencies), emergency routing that understands HVAC urgency levels, and a built-in CRM for lead capture. RingSnap is built specifically for HVAC contractors with all of these capabilities.",
                },
                {
                  q: "What is the best AI receptionist for plumbers?",
                  a: "Plumbers need an AI receptionist that can handle burst pipe emergencies immediately, qualify routine service calls, and capture leads 24/7 — including weekend afternoons when burst pipes happen most. RingSnap's emergency routing and built-in CRM are built specifically for plumbing contractors.",
                },
                {
                  q: "Does an AI receptionist work for electrical contractors?",
                  a: "Yes. Electrical contractors need safety-first call triage (live wire vs. flickering lights), panel upgrade booking, and after-hours emergency routing. RingSnap's call logic is trained on electrical contractor call patterns specifically.",
                },
                {
                  q: "How do I evaluate an AI receptionist before committing?",
                  a: "The best way is a free trial with real calls. RingSnap offers a 3-day trial with ~150 minutes, enough to test emergency scenarios, routine bookings, and after-hours coverage with actual calls. Credit card required to start. You won't be charged until your trial ends or your usage limit is reached.",
                },
                {
                  q: "How much does an AI receptionist cost for a small contracting business?",
                  a: "RingSnap starts at $59/month for night and weekend coverage — the most common entry point for small contractors who want to stop missing emergency calls after hours. Full 24/7 starts at $129/month. Compare this to a single missed $600 job on a Saturday to see the ROI.",
                },
              ].map(({ q, a }) => (
                <div key={q} className="border-b border-border pb-6">
                  <h3 className="font-semibold mb-2">{q}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="section-spacer bg-gradient-to-br from-cream/30 to-off-white">
          <div className="site-container max-w-3xl text-center">
            <h2 className="text-h2 mb-4">See why contractors choose RingSnap</h2>
            <p className="text-muted-foreground mb-8">
              3-day trial. Credit card required to start. You won't be charged until your trial ends. Live in 10 minutes.{" "}
              <Link to="/pricing" className="text-primary hover:underline">
                Plans starting at $59/month.
              </Link>
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Button
                size="lg"
                variant="gradient"
                className="text-lg h-14 px-8 rounded-full"
                onClick={() => navigate("/start")}
              >
                Try RingSnap Free
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-lg h-14 px-8 rounded-full border-2"
                onClick={() => navigate("/difference")}
              >
                Why RingSnap <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>

            <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
              <Link to="/plumbers" className="hover:text-primary transition-colors">For Plumbers</Link>
              <Link to="/hvac" className="hover:text-primary transition-colors">For HVAC</Link>
              <Link to="/electricians" className="hover:text-primary transition-colors">For Electricians</Link>
              <Link to="/roofing" className="hover:text-primary transition-colors">For Roofing</Link>
              <Link to="/crm" className="hover:text-primary transition-colors">Built-In CRM</Link>
            </div>
          </div>
        </section>

        <ErrorBoundary>
          <Suspense fallback={null}>
            <ContractorFooter />
          </Suspense>
        </ErrorBoundary>
        <MobileFooterCTA />
      </main>
    </>
  );
};

export default BestAiReceptionistHomeServices;
