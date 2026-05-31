import { Helmet } from "react-helmet-async";
import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight, PhoneCall, PhoneMissed, CheckCircle, TrendingUp } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const ContractorFooter = lazy(() => import("@/components/ContractorFooter").then(m => ({ default: m.ContractorFooter })));
const MobileFooterCTA = lazy(() => import("@/components/MobileFooterCTA").then(m => ({ default: m.MobileFooterCTA })));
const CallValueCalculator = lazy(() => import("@/components/CallValueCalculator").then(m => ({ default: m.CallValueCalculator })));

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://getringsnap.com/" },
    { "@type": "ListItem", position: 2, name: "Missed Call Recovery", item: "https://getringsnap.com/missed-call-recovery" },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How do contractors recover missed calls?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The only reliable way to recover missed calls is to stop missing them in the first place. Traditional callback workflows fail because homeowners with urgent problems call the next contractor on the list — they don't wait. RingSnap prevents missed calls by answering every call in under 2 rings, even when you're on a job, unavailable, or sleeping."
      }
    },
    {
      "@type": "Question",
      name: "What percentage of callers leave a voicemail when they don't reach a contractor?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Research shows fewer than 20% of callers leave a voicemail when they reach one. The rest hang up and call a competitor. For contractors, this means 80% of missed calls are gone forever — they never get returned because they were never captured. The only recovery is preventing the miss, not chasing callbacks."
      }
    },
    {
      "@type": "Question",
      name: "How much revenue do contractors lose from missed calls?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The average home service job is worth $400-$1,200 depending on trade. If a contractor misses 5-10 calls per week — a realistic number for a busy one-person or small shop — that's $2,000-$12,000 in weekly missed revenue. Annually, this compounds to $100,000+ in captured-but-lost jobs. Our Missed Call Revenue Calculator lets you see the exact number for your trade and call volume."
      }
    },
    {
      "@type": "Question",
      name: "Can an AI answering service actually capture calls in real time?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. RingSnap answers calls in under 2 rings — faster than a human receptionist could pick up the phone. The AI handles the full call: triages urgency, collects job details, books the appointment, and sends the customer a confirmation. By the time you're done with your current job, the missed call is already a booked appointment."
      }
    },
    {
      "@type": "Question",
      name: "What happens to calls that would have gone to voicemail?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "With RingSnap, voicemail no longer exists for inbound calls. Every call that would have hit voicemail now gets answered, triaged, and handled. Emergencies are dispatched immediately. Routine service calls get booked. Quote requests get scheduled for an estimate. Your voicemail fills with silence — because there's nothing left to miss."
      }
    }
  ]
};

const MissedCallRecovery = () => {
  const navigate = useNavigate();

  const lostRevenue = [
    { calls: "3 missed calls/week", jobValue: "$600 average job", monthly: "$7,200/month", annual: "$86,400/year" },
    { calls: "5 missed calls/week", jobValue: "$600 average job", monthly: "$12,000/month", annual: "$144,000/year" },
    { calls: "3 missed calls/week", jobValue: "$900 average job", monthly: "$10,800/month", annual: "$129,600/year" },
    { calls: "5 missed calls/week", jobValue: "$900 average job", monthly: "$18,000/month", annual: "$216,000/year" },
  ];

  return (
    <>
      <Helmet>
        <title>Missed Call Recovery for Contractors | Stop Losing Jobs | RingSnap</title>
        <meta
          name="description"
          content="Every missed call is a job your competitor just booked. RingSnap prevents missed calls for HVAC, plumbing, electrical, and roofing contractors — answers in under 2 rings, books jobs automatically, 24/7. Try free for 3 days."
        />
        <meta
          name="keywords"
          content="missed call recovery contractors, stop missing calls contractor, missed calls cost contractors, capture missed calls, contractor missed call software, recover missed contractor calls"
        />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://getringsnap.com/missed-call-recovery" />

        <meta property="og:title" content="Missed Call Recovery for Contractors | RingSnap" />
        <meta property="og:description" content="Every missed call is a job your competitor just booked. RingSnap prevents missed calls for HVAC, plumbing, electrical, and roofing contractors — answers in under 2 rings, 24/7." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://getringsnap.com/missed-call-recovery" />
        <meta property="og:image" content="https://getringsnap.com/android-chrome-512x512.png" />
        <meta property="og:site_name" content="RingSnap" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Missed Call Recovery for Contractors | RingSnap" />
        <meta name="twitter:description" content="Every missed call is a job your competitor just booked. RingSnap answers every call for contractors 24/7 — no more voicemail, no more lost jobs." />
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
              <PhoneMissed className="h-5 w-5 text-destructive" />
              <span className="text-sm font-medium text-muted-foreground">Missed calls = lost revenue</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-charcoal mb-6 leading-tight">
              Missed Call Recovery for Contractors — Stop Losing Jobs Before They Start
            </h1>
            <p className="text-xl text-muted-foreground mb-4 max-w-2xl mx-auto">
              Every call that goes to voicemail is a job someone else just booked. RingSnap answers every call in under 2 rings — eliminating missed calls instead of trying to recover them.
            </p>
            <p className="text-base text-muted-foreground mb-8 max-w-2xl mx-auto">
              Fewer than 20% of callers leave a voicemail. The rest call your competitor. The only real missed call recovery is answering the phone the first time.
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
                <Link to="/resources/missed-call-revenue-calculator">Calculate Your Losses</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Revenue impact table */}
        <section aria-labelledby="revenue-heading" className="section-spacer bg-white border-t border-border/5">
          <div className="site-container max-w-3xl">
            <h2 id="revenue-heading" className="text-2xl sm:text-3xl font-bold mb-4 text-center">How much are missed calls actually costing you?</h2>
            <p className="text-muted-foreground text-center mb-8 max-w-xl mx-auto">
              These numbers assume each missed caller finds another contractor — which most do within 10 minutes.
            </p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left p-4 font-semibold text-foreground">Scenario</th>
                    <th className="text-right p-4 font-semibold text-foreground">Monthly Loss</th>
                    <th className="text-right p-4 font-semibold text-foreground">Annual Loss</th>
                  </tr>
                </thead>
                <tbody>
                  {lostRevenue.map(({ calls, jobValue, monthly, annual }) => (
                    <tr key={calls + jobValue} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="p-4">
                        <div className="font-medium text-foreground">{calls}</div>
                        <div className="text-xs text-muted-foreground">{jobValue}</div>
                      </td>
                      <td className="p-4 text-right font-semibold text-destructive">{monthly}</td>
                      <td className="p-4 text-right font-bold text-destructive">{annual}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-3 text-center">
              Use the <Link to="/resources/missed-call-revenue-calculator" className="text-primary hover:underline">Missed Call Revenue Calculator</Link> to calculate your specific numbers.
            </p>
          </div>
        </section>

        {/* Why callbacks fail */}
        <section aria-labelledby="why-heading" className="section-spacer bg-muted/30 border-t border-border/5">
          <div className="site-container max-w-3xl">
            <h2 id="why-heading" className="text-2xl font-bold mb-6">Why callbacks don't work for missed call recovery</h2>
            <div className="space-y-4 text-base text-muted-foreground leading-relaxed">
              <p>
                The traditional advice is to call back missed calls immediately. But for home service contractors, this rarely works — because homeowners with an urgent problem aren't waiting around for a callback. They're calling the next number on their list.
              </p>
              <p>
                A homeowner with a burst pipe calls at 8 PM. You're exhausted from a 12-hour day. By the time you call back — even 30 minutes later — they've already reached a competitor and had someone dispatched. The callback was too late.
              </p>
              <p>
                An HVAC customer with a failed AC unit in July heat calls on a Saturday afternoon. You're already on two jobs. You miss it. They call the next HVAC company in Google. By Monday morning, the job is done and the customer has left a 5-star review for someone else.
              </p>
              <p>
                The only real missed call recovery strategy is eliminating missed calls entirely. That means answering every call in real time — even when you're on a job, unavailable, or off the clock.
              </p>
            </div>
          </div>
        </section>

        {/* How RingSnap prevents missed calls */}
        <section aria-labelledby="solution-heading" className="section-spacer bg-white border-t border-border/5">
          <div className="site-container max-w-3xl">
            <h2 id="solution-heading" className="text-2xl font-bold mb-8">How RingSnap prevents missed calls</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { title: "Answers in under 2 rings", desc: "Before the caller can reconsider and hang up. Faster than a human receptionist." },
                { title: "Works while you're on a job", desc: "Forward your number and RingSnap handles every call — even when you can't." },
                { title: "After-hours and weekends", desc: "Your most urgent calls arrive at night and on weekends. RingSnap never sleeps." },
                { title: "Handles concurrent calls", desc: "During a storm surge or summer HVAC season, multiple calls can come in simultaneously. All answered instantly." },
                { title: "Triage and dispatch", desc: "Genuine emergencies are routed to you immediately. Routine calls are booked automatically." },
                { title: "Full job details captured", desc: "Every caller's name, problem, address, and urgency level — logged automatically to your dashboard." },
              ].map(({ title, desc }) => (
                <div key={title} className="flex gap-3 p-4 rounded-xl border border-border bg-card">
                  <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-sm text-foreground mb-1">{title}</h3>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ROI callout */}
        <section className="section-spacer-compact bg-primary/5 border-y border-primary/10">
          <div className="site-container max-w-3xl text-center">
            <TrendingUp className="h-8 w-8 text-primary mx-auto mb-3" />
            <h2 className="text-2xl font-bold mb-3">One captured call pays for months of service</h2>
            <p className="text-muted-foreground mb-5 max-w-xl mx-auto">
              RingSnap starts at $59/month. The average HVAC emergency job is worth $800+. Capturing one call per week that would have been missed more than covers the entire annual cost of the service.
            </p>
            <Button size="lg" className="rounded-full px-8" onClick={() => navigate('/start')}>
              Start Free Trial — No Credit Card
            </Button>
          </div>
        </section>

        {/* FAQ */}
        <section aria-labelledby="faq-heading" className="section-spacer bg-white border-t border-border/5">
          <div className="site-container max-w-3xl">
            <h2 id="faq-heading" className="text-2xl font-bold mb-8 text-center">Missed call recovery FAQ</h2>
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
              <Link to="/contractor-answering-service" className="px-4 py-2 rounded-full border border-border bg-background hover:border-primary/40 hover:text-primary text-sm transition-colors">Contractor Answering Service</Link>
              <Link to="/after-hours-answering-service" className="px-4 py-2 rounded-full border border-border bg-background hover:border-primary/40 hover:text-primary text-sm transition-colors">After-Hours Answering Service</Link>
              <Link to="/resources/missed-call-revenue-calculator" className="px-4 py-2 rounded-full border border-border bg-background hover:border-primary/40 hover:text-primary text-sm transition-colors">Missed Call Revenue Calculator</Link>
              <Link to="/plumbers" className="px-4 py-2 rounded-full border border-border bg-background hover:border-primary/40 hover:text-primary text-sm transition-colors">AI Receptionist for Plumbers</Link>
              <Link to="/hvac" className="px-4 py-2 rounded-full border border-border bg-background hover:border-primary/40 hover:text-primary text-sm transition-colors">AI Receptionist for HVAC</Link>
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

export default MissedCallRecovery;
