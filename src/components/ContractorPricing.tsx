/**
 * ContractorPricing — Marketing site pricing component.
 *
 * Part 5: Full replacement with new 4-plan structure.
 * - Do NOT show trial minute count here (only in dashboard)
 * - Do NOT mention voice agent count
 * - CTA: "Start Free Trial — 3 days free, cancel anytime"
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Moon, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface ContractorPricingProps {
  showHeading?: boolean;
  className?: string;
}

const PLANS = [
  {
    key: "night_weekend",
    name: "Night & Weekend",
    price: 59,
    includedMinutes: 150,
    overageRate: 0.45,
    badge: null,
    highlight: false,
    tagline: "After-hours and weekend coverage to capture emergency revenue",
    coverageNote: "Active 6PM–8AM weekdays + all weekends",
    features: [
      "Answers every after-hours and emergency call",
      "Books appointments and captures job details",
      "Urgent transfer to your phone with full context",
      "Call recordings + transcripts",
      "CRM included — every caller logged automatically",
    ],
    upgradeNudge: "Need 24/7? Upgrade to Lite →",
  },
  {
    key: "lite",
    name: "Lite",
    price: 129,
    includedMinutes: 300,
    overageRate: 0.38,
    badge: null,
    highlight: false,
    tagline: "24/7 coverage for handymen, painters, and roofers",
    coverageNote: null,
    features: [
      "24/7 call answering — never miss a job",
      "Appointment booking with your calendar",
      "Urgent call transfer with full call context",
      "Call recordings + transcripts",
      "CRM included — full caller history",
      "Google Calendar + Zapier",
    ],
    upgradeNudge: null,
  },
  {
    key: "core",
    name: "Core",
    price: 229,
    includedMinutes: 600,
    overageRate: 0.28,
    badge: "Best Value",
    highlight: true,
    tagline: "24/7 coverage for plumbers and HVAC contractors",
    coverageNote: null,
    features: [
      "Everything in Lite, plus:",
      "Branded voice options",
      "Smart call routing by job type and urgency",
      "Multi-language (English + Spanish)",
      "Custom escalation rules",
      "Priority support",
    ],
    socialProof: "Most HVAC and plumbing teams choose Core",
    upgradeNudge: null,
  },
  {
    key: "pro",
    name: "Pro",
    price: 399,
    includedMinutes: 1200,
    overageRate: 0.22,
    badge: null,
    highlight: false,
    tagline: "High-volume contractors and multi-truck operations",
    coverageNote: null,
    features: [
      "Everything in Core, plus:",
      "Custom brand voice",
      "Multi-location dashboard",
      "API + custom webhooks",
      "Dedicated success manager",
      "Priority phone support",
    ],
    upgradeNudge: null,
  },
];

const COMPARISON_TABLE = [
  { feature: "CRM included",                ringsnap: true,    goodcall: false,       agentzap: false,       smithai: "Premium only" },
  { feature: "Built for home services",     ringsnap: true,    goodcall: false,       agentzap: false,       smithai: false },
  { feature: "24/7 AI coverage",            ringsnap: true,    goodcall: true,        agentzap: true,        smithai: true },
  { feature: "Trade-specific call scripts", ringsnap: true,    goodcall: false,       agentzap: false,       smithai: false },
  { feature: "Appointment booking",         ringsnap: true,    goodcall: "Limited",   agentzap: "Limited",   smithai: true },
  { feature: "Starts at",                   ringsnap: "$59/mo",goodcall: "$59/mo",    agentzap: "$79/mo",    smithai: "$292/mo" },
];

const FAQS = [
  {
    q: "What counts as a minute?",
    a: "Active AI call time. Calls under 30 seconds don't count.",
  },
  {
    q: "What if I go over my minutes?",
    a: "By default, we keep answering every call and bill overage at your plan's per-minute rate. We alert you at 70% and 90% so you're never surprised. You can also set a buffer or a hard stop in your dashboard under Call Handling Preferences.",
  },
  {
    q: "Will my calls ever get cut off?",
    a: "Only if you've set a hard cap in your preferences, or if you hit the safety ceiling (a maximum overage limit we set to protect against billing surprises — you'll be alerted immediately if you approach it). Otherwise, we always answer.",
  },
  {
    q: "What's in the CRM?",
    a: "Every caller logged: name, number, call summary, job booked, urgency, follow-up notes. No extra subscription needed.",
  },
  {
    q: "What's the difference between Night & Weekend and the other plans?",
    a: "Night & Weekend is active only outside business hours (6PM–8AM weekdays + all weekend). Lite, Core, and Pro answer calls 24/7.",
  },
  {
    q: "Is there a contract?",
    a: "No. Month-to-month. Cancel anytime.",
  },
];

function CompCell({ value }: { value: boolean | string }) {
  if (value === true) return <span className="text-green-600 font-bold">✅</span>;
  if (value === false) return <span className="text-red-400">❌</span>;
  return <span className="text-muted-foreground text-sm">{value}</span>;
}

export const ContractorPricing = ({ showHeading = true, className }: ContractorPricingProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleSignup = () => {
    navigate({ pathname: "/start", search: searchParams.toString() });
  };

  return (
    <div className={cn("bg-white", className)}>
      {/* Hero section */}
      <section className="section-spacer bg-gradient-to-br from-off-white to-cream/30 text-center px-4">
        <div className="container mx-auto max-w-3xl">
          {showHeading && (
            <h1 className="text-h1 mb-4" style={{ color: "hsl(var(--charcoal))" }}>
              Stop Losing{" "}
              <span style={{ color: "hsl(var(--primary))" }}>$4,200 a Month</span> to Missed Calls
            </h1>
          )}
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
            RingSnap answers every call, books the job, and logs it to your CRM —
            built exclusively for home service contractors.
          </p>
          <Button size="lg" onClick={handleSignup} className="text-base px-8">
            Start Free Trial — 3 days free, cancel anytime
          </Button>
        </div>
      </section>

      {/* ROI anchor */}
      <div className="bg-primary/5 border-y border-primary/20 py-5 px-4 text-center">
        <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
          Home service contractors miss <strong>27–62% of inbound calls</strong>. Each missed call costs
          an average of <strong>$300–$1,200 in lost revenue</strong>.{" "}
          <span className="font-medium text-foreground">RingSnap pays for itself the first week.</span>
        </p>
      </div>

      {/* Plan cards */}
      <section className="section-spacer px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((plan) => (
              <Card
                key={plan.key}
                className={cn(
                  "relative flex flex-col",
                  plan.highlight && "border-primary border-2 shadow-lg"
                )}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="bg-primary text-white px-3 py-1">{plan.badge}</Badge>
                  </div>
                )}

                <CardHeader className="pb-2 pt-6">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      <CardDescription className="mt-1 text-sm leading-snug">
                        {plan.tagline}
                      </CardDescription>
                    </div>
                    {plan.key === "night_weekend" && <Moon className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />}
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col flex-1 space-y-4">
                  {/* Price */}
                  <div>
                    <span className="text-4xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground">/mo</span>
                  </div>

                  {/* Included minutes + overage */}
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600 shrink-0" />
                      <span>{plan.includedMinutes.toLocaleString()} minutes included</span>
                    </div>
                    <div className="text-muted-foreground text-xs ml-6">
                      ${plan.overageRate.toFixed(2)}/min if you go over
                    </div>
                    {plan.coverageNote && (
                      <div className="flex items-center gap-2 text-sm text-amber-700 font-medium mt-1">
                        <Moon className="h-3.5 w-3.5 shrink-0" />
                        <span className="text-xs">{plan.coverageNote}</span>
                      </div>
                    )}
                  </div>

                  {/* Features */}
                  <div className="space-y-2 flex-1">
                    {plan.features.map((feature, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* Social proof */}
                  {"socialProof" in plan && (plan as any).socialProof && (
                    <p className="text-xs text-muted-foreground italic">{(plan as any).socialProof}</p>
                  )}

                  {/* CTA */}
                  <Button
                    className={cn("w-full", plan.highlight ? "" : "variant-outline")}
                    variant={plan.highlight ? "default" : "outline"}
                    onClick={handleSignup}
                  >
                    Start Free Trial — 3 days free, cancel anytime
                  </Button>

                  {/* Upgrade nudge */}
                  {plan.upgradeNudge && (
                    <p className="text-xs text-center text-muted-foreground">{plan.upgradeNudge}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Competitor comparison table */}
      <section className="section-spacer px-4 bg-slate-50">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-center mb-8" style={{ color: "hsl(var(--charcoal))" }}>
            How RingSnap compares
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 pr-4 font-medium"></th>
                  <th className="py-3 px-3 font-bold text-primary">RingSnap</th>
                  <th className="py-3 px-3 font-medium text-muted-foreground">Goodcall</th>
                  <th className="py-3 px-3 font-medium text-muted-foreground">AgentZap</th>
                  <th className="py-3 px-3 font-medium text-muted-foreground">Smith.ai</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_TABLE.map((row, i) => (
                  <tr key={i} className={cn("border-b", i % 2 === 0 ? "bg-white" : "bg-slate-50/50")}>
                    <td className="py-3 pr-4 text-sm">{row.feature}</td>
                    <td className="py-3 px-3 text-center"><CompCell value={row.ringsnap} /></td>
                    <td className="py-3 px-3 text-center"><CompCell value={row.goodcall} /></td>
                    <td className="py-3 px-3 text-center"><CompCell value={row.agentzap} /></td>
                    <td className="py-3 px-3 text-center"><CompCell value={row.smithai} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-4 text-center">
            Prices as of March 2026. Competitor features based on publicly listed plans.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-spacer px-4">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold text-center mb-8" style={{ color: "hsl(var(--charcoal))" }}>
            Frequently asked questions
          </h2>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div key={i} className="border rounded-lg overflow-hidden">
                <button
                  className="w-full flex justify-between items-center px-5 py-4 text-left font-medium text-sm hover:bg-muted/30 transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span>{faq.q}</span>
                  {openFaq === i ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-muted-foreground">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="section-spacer px-4 text-center bg-primary/5 border-t">
        <div className="container mx-auto max-w-xl">
          <h2 className="text-2xl font-bold mb-3" style={{ color: "hsl(var(--charcoal))" }}>
            Ready to stop missing calls?
          </h2>
          <p className="text-muted-foreground mb-6">3 days free. No setup fees. Cancel anytime.</p>
          <Button size="lg" onClick={handleSignup} className="text-base px-8">
            Start Free Trial
          </Button>
        </div>
      </section>
    </div>
  );
};
