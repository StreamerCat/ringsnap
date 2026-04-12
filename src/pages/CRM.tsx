import { Helmet } from "react-helmet-async";
import { lazy, Suspense } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SiteHeader } from "@/components/SiteHeader";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle2,
  ArrowRight,
  Phone,
  ClipboardList,
  Zap,
  Users,
  BarChart3,
  Link as LinkIcon,
  Star,
  Clock,
  Sparkles,
} from "lucide-react";

const ContractorFooter = lazy(() =>
  import("@/components/ContractorFooter").then((m) => ({ default: m.ContractorFooter }))
);
const MobileFooterCTA = lazy(() =>
  import("@/components/MobileFooterCTA").then((m) => ({ default: m.MobileFooterCTA }))
);

const crmSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "RingSnap — AI Receptionist with Built-In CRM for Contractors",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: "https://getringsnap.com/crm",
  description:
    "RingSnap captures every inbound call as a lead, logs full context, routes by intent, and helps home service teams follow through — all built into the same platform as your AI receptionist.",
  offers: [
    { "@type": "Offer", name: "Night & Weekend Plan", price: "59", priceCurrency: "USD" },
    { "@type": "Offer", name: "Lite Plan", price: "129", priceCurrency: "USD" },
    { "@type": "Offer", name: "Core Plan", price: "229", priceCurrency: "USD" },
    { "@type": "Offer", name: "Pro Plan", price: "399", priceCurrency: "USD" },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Does RingSnap replace my existing CRM?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. RingSnap's built-in CRM captures every inbound call as a lead record with full context. It works alongside your existing field service software — Jobber and others — passing clean data through so your team doesn't have to re-enter anything.",
      },
    },
    {
      "@type": "Question",
      name: "What does RingSnap's built-in CRM actually do?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Every call creates a lead record automatically: caller info, job type, urgency level, what was said, what was booked or recommended. Your team sees clean, actionable context instead of a raw transcript. AI-powered intent signals and next-step recommendations are rolling out progressively.",
      },
    },
    {
      "@type": "Question",
      name: "Does RingSnap integrate with Jobber?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. RingSnap integrates with Jobber so leads captured during calls can flow directly into your field service workflow without manual data entry.",
      },
    },
    {
      "@type": "Question",
      name: "How is this different from just a call answering service?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A call answering service captures the call. RingSnap captures the lead — with full context, urgency classification, and a clear next step. Your team follows up on clean, prioritized data instead of a list of voicemails.",
      },
    },
    {
      "@type": "Question",
      name: "Is the AI intent scoring available now?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Basic urgency and job-type classification is live. More advanced intent scoring and automated next-step recommendations are rolling out progressively — the system gets smarter the more calls it handles for your business.",
      },
    },
  ],
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://getringsnap.com/" },
    { "@type": "ListItem", position: 2, name: "Built-In CRM", item: "https://getringsnap.com/crm" },
  ],
};

const CRM = () => {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>Built-In CRM for Home Service Contractors | RingSnap</title>
        <meta
          name="description"
          content="RingSnap's built-in CRM captures every call as a lead, logs full context, and helps your team follow through — no separate tool required. Works with Jobber and other field service software."
        />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://getringsnap.com/crm" />

        <meta property="og:title" content="Built-In CRM for Home Service Contractors | RingSnap" />
        <meta
          property="og:description"
          content="RingSnap captures every inbound call as a lead — with urgency, job type, and full context. Works with Jobber. No extra tools needed."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://getringsnap.com/crm" />
        <meta property="og:image" content="https://getringsnap.com/android-chrome-512x512.png" />
        <meta property="og:image:width" content="512" />
        <meta property="og:image:height" content="512" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:site_name" content="RingSnap" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Built-In CRM for Home Service Contractors | RingSnap" />
        <meta
          name="twitter:description"
          content="Every call becomes a lead. Full context. AI routing. Works with Jobber. No extra tools."
        />
        <meta name="twitter:image" content="https://getringsnap.com/android-chrome-512x512.png" />

        <script type="application/ld+json">{JSON.stringify(crmSchema)}</script>
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
        <section className="bg-gradient-to-br from-off-white to-cream/30 py-8 sm:py-10 lg:py-12">
          <div className="site-container max-w-5xl">
            <div className="text-center">
              <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">
                Built-In CRM · No Extra Tools
              </p>
              <h1 className="text-page-h1 mb-4">
                Most AI receptionists answer the call.<br />
                RingSnap captures the lead.
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground max-w-3xl mx-auto mb-6 leading-relaxed">
                Every inbound call creates a lead record — caller info, job type, urgency level, full
                transcript, and what was booked. Your team sees clean, actionable context. No re-entry.
                No chasing voicemails. Works with Jobber and other field service tools you already use.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
                <Button
                  size="lg"
                  variant="gradient"
                  className="text-lg h-14 px-8 rounded-full"
                  onClick={() => navigate("/start")}
                >
                  Start Free Trial
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

              <div className="flex flex-wrap justify-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-primary fill-primary" />
                  <span>4.9/5 contractor rating</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span>Live in 10 minutes</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* THE PROBLEM */}
        <section id="main-content" className="section-spacer-compact bg-muted/30">
          <div className="site-container max-w-4xl">
            <div className="text-center mb-8">
              <h2 className="text-h2 mb-4">A transcript is not a lead</h2>
              <p className="text-muted-foreground leading-relaxed max-w-3xl mx-auto">
                Most answering services give you a call log. That's it. Your team still has to figure out
                who to call back, what they need, how urgent it is, and what to say. RingSnap does that
                work automatically.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              <Card className="border-2 border-muted bg-white">
                <CardContent className="p-6">
                  <p className="font-semibold text-foreground mb-3">Typical answering service</p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {[
                      "Call answered",
                      "Message recorded",
                      "You receive: name + number",
                      "Your team plays phone tag",
                      "Lead context lost",
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-muted-foreground/20 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-2 border-primary/30 bg-white">
                <CardContent className="p-6">
                  <p className="font-semibold text-foreground mb-3">RingSnap</p>
                  <ul className="space-y-2 text-sm text-foreground">
                    {[
                      "Call answered in under 1 second",
                      "Lead captured with full context",
                      "Job type + urgency classified",
                      "Appointment booked or next step set",
                      "Synced to your CRM or Jobber",
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="section-spacer bg-background">
          <div className="site-container max-w-5xl">
            <div className="text-center mb-10">
              <h2 className="text-h2 mb-4">From call to follow-through</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Four steps. Happens automatically. Your team gets organized leads, not raw transcripts.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  icon: Phone,
                  step: "1",
                  title: "Call answered",
                  desc: "RingSnap picks up in under 1 second — 24/7, even nights, weekends, and holidays.",
                },
                {
                  icon: ClipboardList,
                  step: "2",
                  title: "Lead captured",
                  desc: "Caller name, number, job type, urgency, and full transcript — all logged automatically.",
                },
                {
                  icon: Zap,
                  step: "3",
                  title: "Intent classified",
                  desc: "Urgency level, job category, and booking status set. Emergency calls routed immediately.",
                },
                {
                  icon: Users,
                  step: "4",
                  title: "Team follows through",
                  desc: "Your team sees organized, prioritized leads. Sync to Jobber or follow up directly.",
                },
              ].map(({ icon: Icon, step, title, desc }) => (
                <div key={step} className="text-center p-6 rounded-xl bg-muted/30">
                  <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center mx-auto mb-4 font-bold text-lg">
                    {step}
                  </div>
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="section-spacer bg-muted/30">
          <div className="site-container max-w-5xl">
            <div className="text-center mb-10">
              <h2 className="text-h2 mb-4">What's included</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                CRM capabilities built into every RingSnap plan — no add-on required.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {[
                {
                  icon: ClipboardList,
                  title: "Automatic lead records",
                  desc: "Every call creates a timestamped lead with caller info, job type, and full transcript. Nothing falls through the cracks.",
                  badge: null,
                },
                {
                  icon: Zap,
                  title: "Urgency and job classification",
                  desc: "Calls are automatically tagged by urgency (routine, urgent, emergency) and job type (install, repair, estimate, after-hours). Your team knows what to prioritize.",
                  badge: null,
                },
                {
                  icon: BarChart3,
                  title: "AI intent signals",
                  desc: "Deeper intent scoring — likelihood to book, price sensitivity signals, repeat caller context — rolling out progressively across all plans.",
                  badge: "Evolving",
                },
                {
                  icon: Sparkles,
                  title: "Next-step recommendations",
                  desc: "Suggested follow-up actions based on call outcomes and patterns. The system gets smarter the more calls it handles for your business.",
                  badge: "Evolving",
                },
                {
                  icon: Users,
                  title: "Team visibility",
                  desc: "Everyone on your team sees the same lead context. No more separate call logs and job sheets. One view of every lead.",
                  badge: null,
                },
                {
                  icon: LinkIcon,
                  title: "Integrations with tools you already use",
                  desc: "RingSnap works alongside Jobber and other field service platforms — not as a replacement, as a complement. Leads captured on the call flow into your existing workflow.",
                  badge: null,
                },
              ].map(({ icon: Icon, title, desc, badge }) => (
                <Card key={title} className="bg-white">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">{title}</h3>
                          {badge && (
                            <span className="text-xs font-medium bg-primary/10 text-primary rounded-full px-2 py-0.5">
                              {badge}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* INTEGRATIONS */}
        <section className="section-spacer bg-background">
          <div className="site-container max-w-4xl">
            <div className="text-center mb-10">
              <h2 className="text-h2 mb-4">Works with the tools your team already uses</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                RingSnap isn't trying to replace Jobber, ServiceTitan, or your current field service
                software. It's a complement — capturing leads at the call layer and passing clean data
                through so your existing workflow doesn't skip a beat.
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-6 mb-8">
              {[
                {
                  title: "Jobber",
                  desc: "Direct integration. Leads captured in RingSnap flow into Jobber automatically.",
                },
                {
                  title: "Your field service software",
                  desc: "Export clean lead data to your existing CRM or field service platform via manual export or API.",
                },
                {
                  title: "More integrations coming",
                  desc: "Additional direct integrations are in development. Contact us to discuss your specific stack.",
                },
              ].map(({ title, desc }) => (
                <div key={title} className="p-6 rounded-xl bg-muted/30 text-center">
                  <h3 className="font-semibold mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>

            <p className="text-center text-sm text-muted-foreground max-w-xl mx-auto">
              Already using a CRM you love? Keep it. RingSnap adds the lead-capture and context layer
              that most phone systems miss entirely.
            </p>
          </div>
        </section>

        {/* WHO IT'S FOR */}
        <section className="section-spacer bg-muted/30">
          <div className="site-container max-w-4xl">
            <div className="text-center mb-10">
              <h2 className="text-h2 mb-4">Who it's built for</h2>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto mb-8">
              {[
                "Home service contractors who want more than just call answering",
                "Teams tired of piecing together transcripts and job sheets",
                "Owners who need their team to follow up faster and more consistently",
                "Businesses already using Jobber who want tighter call-to-job flow",
                "Contractors losing leads because callers don't leave voicemails",
                "Growing operations that need consistent call handling without hiring more staff",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 p-4 rounded-xl bg-white border">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-sm">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="section-spacer bg-background">
          <div className="site-container max-w-3xl">
            <div className="text-center mb-10">
              <h2 className="text-h2 mb-4">Common questions about RingSnap's CRM</h2>
            </div>

            <div className="space-y-6">
              {[
                {
                  q: "Does RingSnap replace my existing CRM?",
                  a: "No. RingSnap captures leads at the call layer and passes clean data into your existing tools. If you use Jobber, leads sync directly. If you use other field service software, you can export or connect via API. RingSnap is a complement to what you already have, not a replacement.",
                },
                {
                  q: "What does a lead record look like?",
                  a: "Every call creates a record with: caller name and number, job type (repair, install, estimate, emergency), urgency classification, what was booked or left as a next step, and the full call transcript. Your team sees the context they need to follow up intelligently.",
                },
                {
                  q: "Is the AI intent scoring live now?",
                  a: "Basic urgency classification and job-type tagging are live on all plans. More advanced intent scoring — likelihood to book, price sensitivity signals, repeat-caller context — is rolling out progressively and improves as the system handles more calls for your business.",
                },
                {
                  q: "How is this different from just a call answering service?",
                  a: "A call answering service gives you a message. RingSnap gives you a lead — with context, urgency, and a next step. The difference is what happens after the call: your team works from organized, prioritized data instead of a list of numbers to call back.",
                },
                {
                  q: "Which trade types does this work for?",
                  a: "RingSnap's CRM is built for home service contractors: HVAC, plumbing, electrical, and roofing. The job-type classification and urgency logic are trained on real contractor call patterns for these trades.",
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

        {/* CTA */}
        <section className="section-spacer bg-gradient-to-br from-cream/30 to-off-white">
          <div className="site-container max-w-3xl text-center">
            <h2 className="text-h2 mb-4">Start capturing leads, not just calls</h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              3-day trial. Credit card required to start. You won't be charged until your trial ends. Live in 10 minutes.{" "}
              <Link to="/pricing" className="text-primary hover:underline">
                See plans starting at $59/month.
              </Link>
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                variant="gradient"
                className="text-lg h-14 px-8 rounded-full"
                onClick={() => navigate("/start")}
              >
                Start Free Trial
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

            <div className="mt-10 flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
              <Link to="/plumbers" className="hover:text-primary transition-colors">
                For Plumbers
              </Link>
              <Link to="/hvac" className="hover:text-primary transition-colors">
                For HVAC
              </Link>
              <Link to="/electricians" className="hover:text-primary transition-colors">
                For Electricians
              </Link>
              <Link to="/roofing" className="hover:text-primary transition-colors">
                For Roofing
              </Link>
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

export default CRM;
