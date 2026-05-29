import { Helmet } from "react-helmet-async";
import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight, PhoneCall, Moon, Clock, CheckCircle, Wrench, Thermometer, Zap, Home } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const ContractorFooter = lazy(() => import("@/components/ContractorFooter").then(m => ({ default: m.ContractorFooter })));
const MobileFooterCTA = lazy(() => import("@/components/MobileFooterCTA").then(m => ({ default: m.MobileFooterCTA })));

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://getringsnap.com/" },
    { "@type": "ListItem", position: 2, name: "After-Hours Answering Service", item: "https://getringsnap.com/after-hours-answering-service" },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is an after-hours answering service for contractors?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "An after-hours answering service handles calls that come in outside of normal business hours — nights, weekends, and holidays. For contractors, after-hours calls are often the highest-urgency and highest-value calls: burst pipes, AC failures in extreme heat, no-heat emergencies in winter, electrical hazards, and storm damage. RingSnap answers these calls immediately, triages urgency, provides safety guidance, and routes genuine emergencies to your on-call tech."
      }
    },
    {
      "@type": "Question",
      name: "How does RingSnap handle after-hours emergencies?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "RingSnap triages every after-hours call: Is this life-threatening? Is there active flooding, a gas smell, or a sparking electrical panel? Genuine emergencies are transferred to you immediately — typically within 5 seconds — with full call context so you know exactly what you're dealing with before you pick up. Non-emergency after-hours calls are captured, logged, and scheduled for the next available slot."
      }
    },
    {
      "@type": "Question",
      name: "Can RingSnap be set to only answer after-hours calls?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. The Night & Weekend plan ($59/month) is specifically designed for after-hours coverage — evenings and weekends only. You keep answering calls during business hours and RingSnap takes over when you're off the clock. You can also set RingSnap to answer overflow calls during business hours when you're already on a job."
      }
    },
    {
      "@type": "Question",
      name: "What happens to after-hours calls that aren't emergencies?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Non-urgent after-hours calls — inspection requests, quote inquiries, routine service calls — are captured with full details and scheduled for the next available appointment slot. The caller gets a confirmation rather than a voicemail, and you wake up to a full schedule instead of a list of callbacks."
      }
    },
    {
      "@type": "Question",
      name: "How much does an after-hours answering service for contractors cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "RingSnap's Night & Weekend plan starts at $59/month — less than a single emergency service call. Compare that to hiring a live answering service ($200-$400/month with limited minutes) or the cost of missing even one $600 job per week. Most contractors recover the cost in the first captured after-hours call."
      }
    }
  ]
};

const AfterHoursAnsweringService = () => {
  const navigate = useNavigate();

  const trades = [
    { href: "/plumbers", icon: Wrench, name: "Plumbers", stat: "47%", statLabel: "of plumbing emergency calls happen after 5 PM" },
    { href: "/hvac", icon: Thermometer, name: "HVAC", stat: "52%", statLabel: "of AC breakdown calls arrive evenings and weekends" },
    { href: "/electricians", icon: Zap, name: "Electricians", stat: "58%", statLabel: "of electrical emergency calls come during active jobsites" },
    { href: "/roofing", icon: Home, name: "Roofers", stat: "68%", statLabel: "of storm damage calls happen during peak work hours" },
  ];

  return (
    <>
      <Helmet>
        <title>After-Hours Answering Service for Contractors | 24/7 Coverage | RingSnap</title>
        <meta
          name="description"
          content="Stop losing after-hours jobs. RingSnap's AI answering service covers nights, weekends, and holidays for HVAC, plumbing, electrical, and roofing contractors. Triages emergencies, books jobs, costs less than one missed call. Try free."
        />
        <meta
          name="keywords"
          content="after hours answering service, after hours answering service for contractors, contractor after hours coverage, 24/7 answering service contractors, after hours HVAC plumbing electrical roofing answering"
        />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://getringsnap.com/after-hours-answering-service" />

        <meta property="og:title" content="After-Hours Answering Service for Contractors | RingSnap" />
        <meta property="og:description" content="Stop losing after-hours jobs. RingSnap covers nights, weekends, and holidays for HVAC, plumbing, electrical, and roofing contractors — triages emergencies and books jobs automatically." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://getringsnap.com/after-hours-answering-service" />
        <meta property="og:image" content="https://getringsnap.com/android-chrome-512x512.png" />
        <meta property="og:site_name" content="RingSnap" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="After-Hours Answering Service for Contractors | RingSnap" />
        <meta name="twitter:description" content="Stop losing after-hours jobs. RingSnap covers nights, weekends, and holidays for HVAC, plumbing, electrical, and roofing contractors." />
        <meta name="twitter:image" content="https://getringsnap.com/android-chrome-512x512.png" />

        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>

      <SiteHeader />
      <main className="pb-[calc(5rem+var(--safe-bottom))] md:pb-0 pt-14">

        {/* Hero */}
        <section className="relative overflow-hidden section-spacer bg-gradient-to-br from-off-white to-cream/30">
          <div className="site-container max-w-4xl text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Moon className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Nights · Weekends · Holidays</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-charcoal mb-6 leading-tight">
              After-Hours Answering Service for Contractors
            </h1>
            <p className="text-xl text-muted-foreground mb-4 max-w-2xl mx-auto">
              Your most urgent — and most profitable — calls don't arrive during business hours. RingSnap answers every after-hours call instantly, triages emergencies, and books jobs while you sleep.
            </p>
            <p className="text-base text-muted-foreground mb-8 max-w-2xl mx-auto">
              Starts at $59/month. Less than the cost of a single missed emergency call.
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

        {/* Trade stats */}
        <section aria-labelledby="trade-stats-heading" className="section-spacer bg-white border-t border-border/5">
          <div className="site-container">
            <h2 id="trade-stats-heading" className="text-2xl sm:text-3xl font-bold mb-2 text-center">After-hours is where contractors lose the most revenue</h2>
            <p className="text-muted-foreground text-center mb-8 max-w-xl mx-auto">
              The highest-urgency calls — the ones callers won't wait to be called back on — happen when you're off the clock.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {trades.map(({ href, icon: Icon, name, stat, statLabel }) => (
                <Link
                  key={href}
                  to={href}
                  className="group flex flex-col gap-3 p-5 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">{name}</span>
                  </div>
                  <div className="text-3xl font-bold text-primary">{stat}</div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{statLabel}</p>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                    See {name} coverage <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* How it works at night */}
        <section aria-labelledby="how-it-works-heading" className="section-spacer bg-muted/30 border-t border-border/5">
          <div className="site-container max-w-3xl">
            <h2 id="how-it-works-heading" className="text-2xl sm:text-3xl font-bold mb-8 text-center">What happens when a homeowner calls you at 11 PM</h2>
            <div className="space-y-0">
              {[
                { time: "11:02 PM", event: "Homeowner calls your business number", detail: "Their basement is flooding. They're panicked. They need someone now." },
                { time: "11:02 PM", event: "RingSnap answers in under 2 rings", detail: "\"Thanks for calling [Your Company]. How can I help?\" — professional, calm, and ready." },
                { time: "11:03 PM", event: "Emergency triage happens instantly", detail: "RingSnap identifies this as an active flooding emergency. Provides shutoff valve instructions. Collects address and contact info." },
                { time: "11:04 PM", event: "Dispatched — you're notified", detail: "If it's life-threatening, you're called immediately with full context. Otherwise, the job is booked for your next available slot." },
                { time: "11:05 PM", event: "Customer gets a text confirmation", detail: "They have a job scheduled, a phone number to call back, and safety instructions. They're not calling your competitor." },
              ].map(({ time, event, detail }, i) => (
                <div key={time} className="flex gap-4 pb-6">
                  <div className="flex flex-col items-center">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Clock className="h-4 w-4 text-primary" />
                    </div>
                    {i < 4 && <div className="w-px h-full bg-border mt-2" />}
                  </div>
                  <div className="pt-1 pb-2">
                    <div className="text-xs font-mono text-muted-foreground mb-1">{time}</div>
                    <h3 className="font-semibold text-foreground text-sm mb-1">{event}</h3>
                    <p className="text-xs text-muted-foreground">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Plan callout */}
        <section aria-labelledby="plan-heading" className="section-spacer bg-white border-t border-border/5">
          <div className="site-container max-w-3xl">
            <h2 id="plan-heading" className="text-2xl font-bold mb-6">After-hours coverage plans</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-6 rounded-xl border-2 border-primary/30 bg-primary/5">
                <div className="text-sm font-medium text-primary mb-1">Night &amp; Weekend</div>
                <div className="text-3xl font-bold text-charcoal mb-1">$59<span className="text-base font-normal text-muted-foreground">/month</span></div>
                <p className="text-sm text-muted-foreground mb-4">Evenings and weekends only. Perfect for contractors who handle their own business-hours calls.</p>
                <ul className="space-y-2">
                  {["Answers 5 PM – 8 AM weekdays", "Full weekend coverage", "Emergency dispatch included", "Call logs + transcripts"].map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-6 rounded-xl border border-border bg-card">
                <div className="text-sm font-medium text-muted-foreground mb-1">24/7 Coverage</div>
                <div className="text-3xl font-bold text-charcoal mb-1">From $129<span className="text-base font-normal text-muted-foreground">/month</span></div>
                <p className="text-sm text-muted-foreground mb-4">Full 24/7 coverage including business hours. Never miss a call, even when you're already on a job.</p>
                <ul className="space-y-2">
                  {["24/7/365 coverage", "Business hours + after-hours", "Overflow call handling", "Jobber integration included"].map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-6 text-center">
              <Button size="lg" className="rounded-full px-8" onClick={() => navigate('/start')}>
                Start 3-Day Free Trial
              </Button>
              <p className="text-xs text-muted-foreground mt-2">No credit card required</p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section aria-labelledby="faq-heading" className="section-spacer bg-muted/30 border-t border-border/5">
          <div className="site-container max-w-3xl">
            <h2 id="faq-heading" className="text-2xl font-bold mb-8 text-center">After-hours answering service FAQ</h2>
            <div className="space-y-4">
              {faqSchema.mainEntity.map((item) => (
                <div key={item.name} className="border border-border rounded-xl p-5 bg-card">
                  <h3 className="font-semibold text-foreground mb-2">{item.name}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.acceptedAnswer.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Internal links */}
        <section aria-labelledby="related-heading" className="section-spacer-compact bg-white border-t border-border/5">
          <div className="site-container max-w-3xl">
            <h2 id="related-heading" className="text-lg font-semibold mb-4">Related pages</h2>
            <div className="flex flex-wrap gap-3">
              <Link to="/contractor-answering-service" className="px-4 py-2 rounded-full border border-border bg-background hover:border-primary/40 hover:text-primary text-sm transition-colors">Contractor Answering Service</Link>
              <Link to="/missed-call-recovery" className="px-4 py-2 rounded-full border border-border bg-background hover:border-primary/40 hover:text-primary text-sm transition-colors">Missed Call Recovery</Link>
              <Link to="/plumbers" className="px-4 py-2 rounded-full border border-border bg-background hover:border-primary/40 hover:text-primary text-sm transition-colors">Plumber Answering Service</Link>
              <Link to="/hvac" className="px-4 py-2 rounded-full border border-border bg-background hover:border-primary/40 hover:text-primary text-sm transition-colors">HVAC Answering Service</Link>
              <Link to="/resources/after-hours-call-calculator" className="px-4 py-2 rounded-full border border-border bg-background hover:border-primary/40 hover:text-primary text-sm transition-colors">After-Hours Revenue Calculator</Link>
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

export default AfterHoursAnsweringService;
