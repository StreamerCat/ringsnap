/**
 * Shared layout for RingSnap comparison pages.
 * Each comparison page provides its own config; this component handles the
 * consistent structure: hero → quick summary → feature table → strengths →
 * who-should-choose → FAQ → CTA.
 */

import { lazy, Suspense } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { SiteHeader } from "@/components/SiteHeader";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, X, ArrowRight, Star, Shield, Clock } from "lucide-react";

const ContractorFooter = lazy(() =>
  import("@/components/ContractorFooter").then((m) => ({ default: m.ContractorFooter }))
);
const MobileFooterCTA = lazy(() =>
  import("@/components/MobileFooterCTA").then((m) => ({ default: m.MobileFooterCTA }))
);

export interface ComparisonRow {
  feature: string;
  ringsnap: string | boolean;
  competitor: string | boolean;
}

export interface ComparisonConfig {
  seo: {
    title: string;
    description: string;
    canonical: string;
  };
  hero: {
    eyebrow: string;
    h1: string;
    intro: string;
  };
  competitor: {
    name: string;
    description: string; // one-sentence neutral description
  };
  comparisonTable: ComparisonRow[];
  ringSnapStrengths: string[];
  competitorStrengths: string[];
  whoShouldChoose: {
    ringsnap: string;
    competitor: string;
  };
  verdict: string; // 1–2 sentence plain-language summary
  faqs: Array<{ q: string; a: string }>;
  schema: object; // page-specific JSON-LD
  breadcrumbs: Array<{ name: string; item: string }>;
}

interface CellProps {
  value: string | boolean;
}

const Cell = ({ value }: CellProps) => {
  if (typeof value === "boolean") {
    return value ? (
      <CheckCircle2 className="w-5 h-5 text-primary mx-auto" />
    ) : (
      <X className="w-5 h-5 text-muted-foreground/40 mx-auto" />
    );
  }
  return <span className="text-sm">{value}</span>;
};

export const ComparisonPage = ({ config }: { config: ComparisonConfig }) => {
  const navigate = useNavigate();

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: config.breadcrumbs.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: crumb.item,
    })),
  };

  return (
    <>
      <Helmet>
        <title>{config.seo.title}</title>
        <meta name="description" content={config.seo.description} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={config.seo.canonical} />

        <meta property="og:title" content={config.seo.title} />
        <meta property="og:description" content={config.seo.description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={config.seo.canonical} />
        <meta property="og:image" content="https://getringsnap.com/android-chrome-512x512.png" />
        <meta property="og:image:width" content="512" />
        <meta property="og:image:height" content="512" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:site_name" content="RingSnap" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={config.seo.title} />
        <meta name="twitter:description" content={config.seo.description} />
        <meta name="twitter:image" content="https://getringsnap.com/android-chrome-512x512.png" />

        <script type="application/ld+json">{JSON.stringify(config.schema)}</script>
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
              {config.hero.eyebrow}
            </p>
            <h1 className="text-h1 mb-6">{config.hero.h1}</h1>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto mb-8 leading-relaxed">
              {config.hero.intro}
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
                <span>3-day free trial, no card required</span>
              </div>
            </div>
          </div>
        </section>

        {/* COMPETITOR CONTEXT */}
        <section id="main-content" className="section-spacer-compact bg-muted/30">
          <div className="site-container max-w-3xl text-center">
            <h2 className="text-xl font-semibold mb-3">What is {config.competitor.name}?</h2>
            <p className="text-muted-foreground leading-relaxed">{config.competitor.description}</p>
          </div>
        </section>

        {/* COMPARISON TABLE */}
        <section className="section-spacer bg-background">
          <div className="site-container max-w-4xl">
            <div className="text-center mb-8">
              <h2 className="text-h2 mb-4">
                RingSnap vs {config.competitor.name}: Feature comparison
              </h2>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left p-4 font-semibold w-1/2">Feature</th>
                    <th className="text-center p-4 font-semibold text-primary">RingSnap</th>
                    <th className="text-center p-4 font-semibold text-muted-foreground">
                      {config.competitor.name}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {config.comparisonTable.map((row, i) => (
                    <tr key={row.feature} className={i % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                      <td className="p-4 text-sm font-medium">{row.feature}</td>
                      <td className="p-4 text-center">
                        <Cell value={row.ringsnap} />
                      </td>
                      <td className="p-4 text-center">
                        <Cell value={row.competitor} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted-foreground mt-3 text-center">
              Competitor information based on publicly available product pages. Verify current features
              and pricing on their website.
            </p>
          </div>
        </section>

        {/* STRENGTHS */}
        <section className="section-spacer bg-muted/30">
          <div className="site-container max-w-5xl">
            <div className="text-center mb-10">
              <h2 className="text-h2 mb-4">Where each one wins</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <Card className="border-2 border-primary/20 bg-white">
                <CardContent className="p-6">
                  <p className="font-bold text-foreground mb-4">RingSnap is stronger when…</p>
                  <ul className="space-y-3">
                    {config.ringSnapStrengths.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-2 border-muted bg-white">
                <CardContent className="p-6">
                  <p className="font-bold text-foreground mb-4">
                    {config.competitor.name} is stronger when…
                  </p>
                  <ul className="space-y-3">
                    {config.competitorStrengths.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* WHO SHOULD CHOOSE */}
        <section className="section-spacer bg-background">
          <div className="site-container max-w-4xl">
            <div className="text-center mb-10">
              <h2 className="text-h2 mb-4">Which one is right for you?</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-6 rounded-xl bg-primary/5 border border-primary/20">
                <p className="font-semibold mb-3 text-primary">Choose RingSnap if…</p>
                <p className="text-sm leading-relaxed">{config.whoShouldChoose.ringsnap}</p>
                <Button
                  className="mt-4 rounded-full"
                  onClick={() => navigate("/start")}
                >
                  Start Free Trial
                </Button>
              </div>

              <div className="p-6 rounded-xl bg-muted/30 border border-border">
                <p className="font-semibold mb-3">Consider {config.competitor.name} if…</p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {config.whoShouldChoose.competitor}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* VERDICT */}
        <section className="section-spacer-compact bg-muted/30">
          <div className="site-container max-w-3xl text-center">
            <h2 className="text-xl font-semibold mb-4">Bottom line</h2>
            <p className="text-muted-foreground leading-relaxed">{config.verdict}</p>
          </div>
        </section>

        {/* FAQ */}
        <section className="section-spacer bg-background">
          <div className="site-container max-w-3xl">
            <div className="text-center mb-10">
              <h2 className="text-h2 mb-4">Frequently asked questions</h2>
            </div>

            <div className="space-y-6">
              {config.faqs.map(({ q, a }) => (
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
            <h2 className="text-h2 mb-4">Ready to answer every call and capture every lead?</h2>
            <p className="text-muted-foreground mb-8">
              3-day free trial. No credit card required. Live in 10 minutes.{" "}
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
              <Link to="/pricing" className="hover:text-primary transition-colors">Pricing</Link>
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
