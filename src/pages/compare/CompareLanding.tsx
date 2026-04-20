import { Helmet } from "react-helmet-async";
import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { SiteHeader } from "@/components/SiteHeader";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ArrowRight, CheckCircle2 } from "lucide-react";

const ContractorFooter = lazy(() =>
  import("@/components/ContractorFooter").then((m) => ({ default: m.ContractorFooter }))
);
const MobileFooterCTA = lazy(() =>
  import("@/components/MobileFooterCTA").then((m) => ({ default: m.MobileFooterCTA }))
);

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://getringsnap.com/" },
    { "@type": "ListItem", position: 2, name: "Compare", item: "https://getringsnap.com/compare" },
  ],
};

const comparisons = [
  {
    href: "/compare/ringsnap-vs-ruby",
    title: "RingSnap vs Ruby Receptionists",
    subtitle: "AI answering vs human virtual receptionists",
    desc: "Ruby provides human receptionists for small businesses. RingSnap is built exclusively for home service contractors with 24/7 AI coverage, emergency routing, and a built-in CRM — at a fraction of Ruby's per-minute cost.",
    tags: ["Human vs AI", "Pricing", "Coverage"],
  },
  {
    href: "/compare/ringsnap-vs-smith-ai",
    title: "RingSnap vs Smith.ai",
    subtitle: "Contractor-specific AI vs general virtual receptionist",
    desc: "Smith.ai combines AI with live agents for general small businesses. RingSnap is purpose-built for HVAC, plumbing, electrical, and roofing contractors with trade-specific emergency routing and a built-in CRM.",
    tags: ["Emergency Routing", "CRM", "Contractor-Specific"],
  },
  {
    href: "/compare/ringsnap-vs-goodcall",
    title: "RingSnap vs Goodcall",
    subtitle: "Contractor AI vs general AI phone agent",
    desc: "Goodcall handles calls for restaurants, retail, and general small businesses. RingSnap understands contractor emergencies, job-type classification, and Jobber integration that a general AI phone agent can't replicate.",
    tags: ["AI vs AI", "Trade Knowledge", "Integrations"],
  },
  {
    href: "/compare/ai-receptionist-vs-live-answering",
    title: "AI Receptionist vs Live Answering Service",
    subtitle: "Full category comparison for home service contractors",
    desc: "Which is better for HVAC, plumbing, electrical, and roofing? This guide compares true 24/7 coverage, emergency handling, CRM capability, cost at scale, and consistent call quality.",
    tags: ["Coverage", "Cost", "Consistency"],
  },
  {
    href: "/compare/best-ai-receptionist-home-services",
    title: "Best AI Receptionist for Home Service Contractors",
    subtitle: "Buyer's guide: 6 criteria that actually matter",
    desc: "Not all AI receptionists are built for contractors. This guide covers the six capabilities that separate contractor-specific AI from general-purpose tools — so you can evaluate any option with the right questions.",
    tags: ["Buyer's Guide", "All Trades", "Evaluation"],
  },
];

const CompareLanding = () => {
  return (
    <>
      <Helmet>
        <title>AI Receptionist Comparisons for Contractors | RingSnap vs Alternatives</title>
        <meta
          name="description"
          content="Compare RingSnap against Ruby, Smith.ai, Goodcall, and live answering services. See which AI receptionist is best for HVAC, plumbing, electrical, and roofing contractors."
        />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://getringsnap.com/compare" />

        <meta property="og:title" content="AI Receptionist Comparisons for Contractors | RingSnap" />
        <meta property="og:description" content="Compare RingSnap vs Ruby, Smith.ai, Goodcall, and live answering services for home service contractors." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://getringsnap.com/compare" />
        <meta property="og:image" content="https://getringsnap.com/android-chrome-512x512.png" />
        <meta property="og:image:width" content="512" />
        <meta property="og:image:height" content="512" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:site_name" content="RingSnap" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="AI Receptionist Comparisons for Contractors | RingSnap" />
        <meta name="twitter:description" content="Compare RingSnap vs Ruby, Smith.ai, Goodcall, and live answering services for home service contractors." />
        <meta name="twitter:image" content="https://getringsnap.com/android-chrome-512x512.png" />

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

        {/* Hero */}
        <section className="bg-gradient-to-br from-off-white to-cream/30 py-10 sm:py-14">
          <div className="site-container max-w-4xl text-center">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">Comparisons</p>
            <h1 className="text-page-h1 mb-4">How RingSnap compares to the alternatives</h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Side-by-side comparisons of RingSnap against the AI receptionists and live answering services that home service contractors most often consider — with honest assessments of where each one wins.
            </p>
          </div>
        </section>

        {/* Comparison cards */}
        <section id="main-content" className="section-spacer bg-background">
          <div className="site-container max-w-4xl">
            <div className="space-y-5">
              {comparisons.map(({ href, title, subtitle, desc, tags }) => (
                <Link
                  key={href}
                  to={href}
                  className="group flex flex-col sm:flex-row sm:items-start gap-4 p-6 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all"
                >
                  <div className="flex-1">
                    <p className="text-xs font-medium text-muted-foreground mb-1">{subtitle}</p>
                    <h2 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-2 text-base sm:text-lg leading-snug">{title}</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-3">{desc}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((tag) => (
                        <span key={tag} className="text-[11px] font-medium bg-muted text-muted-foreground rounded-full px-2 py-0.5">{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="sm:flex-shrink-0 sm:pt-1">
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary whitespace-nowrap">
                      Read comparison <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* What makes RingSnap different */}
        <section className="section-spacer-compact bg-muted/30 border-t border-border/10">
          <div className="site-container max-w-3xl">
            <h2 className="text-xl font-semibold mb-5 text-center">What makes RingSnap different</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                "Built exclusively for HVAC, plumbing, electrical, and roofing — not adapted from a general template",
                "Answers every call in under 1 second, 24/7 — including 2am burst pipes and holiday weekends",
                "Emergency routing trained on contractor call patterns, not generic escalation rules",
                "Built-in CRM: every call creates a lead record with job type, urgency, and full transcript",
                "Jobber integration — lead data flows directly into your field service workflow",
                "Flat-rate pricing starting at $59/month — no per-minute surprises during busy season",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border">
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-sm">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trade links */}
        <section className="section-spacer-compact bg-background border-t border-border/5">
          <div className="site-container max-w-3xl text-center">
            <p className="text-sm text-muted-foreground mb-4">See RingSnap for your trade:</p>
            <div className="flex flex-wrap justify-center gap-3 text-sm">
              <Link to="/hvac" className="px-4 py-2 rounded-full border border-border hover:border-primary/40 hover:text-primary transition-colors">HVAC Contractors</Link>
              <Link to="/plumbers" className="px-4 py-2 rounded-full border border-border hover:border-primary/40 hover:text-primary transition-colors">Plumbers</Link>
              <Link to="/electricians" className="px-4 py-2 rounded-full border border-border hover:border-primary/40 hover:text-primary transition-colors">Electricians</Link>
              <Link to="/roofing" className="px-4 py-2 rounded-full border border-border hover:border-primary/40 hover:text-primary transition-colors">Roofing Contractors</Link>
              <Link to="/pricing" className="px-4 py-2 rounded-full border border-border hover:border-primary/40 hover:text-primary transition-colors">View Pricing</Link>
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

export default CompareLanding;
