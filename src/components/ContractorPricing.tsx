/**
 * ContractorPricing — Marketing site pricing component.
 *
 * Part 5: Full replacement with new 4-plan structure.
 * - Do NOT show trial minute count here (only in dashboard)
 * - Do NOT mention voice agent count
 * - CTA: "Start Free"
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Moon, ChevronDown, ChevronUp, X, Sparkles } from "lucide-react";
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
    tagline: "After hours and weekends covered, so emergency revenue gets recovered",
    coverageNote: "Active 6PM–8AM weekdays + all weekends",
    features: [
      "Answers every after-hours and emergency call",
      "Books appointments and captures job details",
      "Urgent transfer to your phone with full context",
      "Transcripts included",
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
    tagline: "Round-the-clock coverage for handymen, painters, and roofers",
    coverageNote: null,
    features: [
      "24/7 call answering — never miss a job",
      "Appointment booking with your calendar",
      "Urgent call transfer with full call context",
      "Transcripts included",
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
    tagline: "Always-on coverage for plumbers and HVAC teams ready to scale",
    coverageNote: null,
    features: [
      "Everything in Lite, plus:",
      "Branded voice options",
      "Smart call routing by job type and urgency",
      "Multi-language (English + Spanish)",
      "Custom escalation rules",
      "Priority support",
      "Call recordings + transcripts",
      "Advanced CRM included",
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
    tagline: "Built for high-volume contractors and growing multi-truck operations",
    coverageNote: null,
    features: [
      "Everything in Core, plus:",
      "Custom brand voice",
      "Multi-location dashboard",
      "API + custom webhooks",
      "Dedicated success manager",
      "Priority phone support",
      "Call recordings + transcripts",
      "Advanced CRM included",
    ],
    upgradeNudge: null,
  },
];

const COMPARISON_TABLE = [
  { feature: "CRM included", ringsnap: true, goodcall: false, agentzap: false, smithai: "Premium only" },
  { feature: "Built for home services", ringsnap: true, goodcall: false, agentzap: false, smithai: false },
  { feature: "24/7 AI coverage", ringsnap: true, goodcall: true, agentzap: true, smithai: true },
  { feature: "Trade-specific call scripts", ringsnap: true, goodcall: false, agentzap: false, smithai: false },
  { feature: "Appointment booking", ringsnap: true, goodcall: "Limited", agentzap: "Limited", smithai: true },
  { feature: "Starts at", ringsnap: "$59/mo", goodcall: "$59/mo", agentzap: "$79/mo", smithai: "$292/mo" },
];

const MINUTE_GUIDE = [
  {
    trade: "Plumbing + HVAC",
    callVolume: "160–240 calls/month",
    avgCallLength: "2.5 minutes average",
    fit: "Core is best for most phone-first teams that want predictable monthly billing and more booked jobs.",
  },
  {
    trade: "Electrical + Roofing",
    callVolume: "90–150 calls/month",
    avgCallLength: "2.1 minutes average",
    fit: "Lite is ideal if you want the lowest base cost and are comfortable paying usage as volume grows.",
  },
  {
    trade: "Handyman + General Repair",
    callVolume: "60–110 calls/month",
    avgCallLength: "1.8 minutes average",
    fit: "Lite covers most teams here, with room to scale into Core as call volume increases.",
  },
];

const FAQS = [
  {
    q: "What counts as a minute?",
    a: "Active AI call time. Calls under 30 seconds don't count.",
  },
  {
    q: "What if I go over my minutes?",
    a: "By default, we keep answering every call and bill overage at your plan's per-minute rate (Night & Weekend $0.45/min, Lite $0.38/min, Core $0.28/min, Pro $0.22/min). We alert you at 70% and 90% so you're never surprised. You can also set a buffer or a hard stop in your dashboard under Call Handling Preferences.",
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
  if (value === true) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700" aria-label="Included">
        <Check className="h-4 w-4" />
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 text-rose-600" aria-label="Not included">
        <X className="h-4 w-4" />
      </span>
    );
  }
  return <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{value}</span>;
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
      <section className="section-spacer bg-gradient-to-br from-off-white to-cream/30 text-center px-4 sm:px-6">
        <div className="container mx-auto max-w-3xl">
          {showHeading && (
            <h1 className="text-3xl leading-tight font-bold tracking-tight sm:text-4xl lg:text-5xl mb-4 sm:mb-5" style={{ color: "hsl(var(--charcoal))" }}>
              Stop Losing <span style={{ color: "hsl(var(--primary))" }}>$4,200 a Month</span> to Missed Calls
            </h1>
          )}
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-7 sm:mb-8">
            RingSnap answers every call, books every job, and logs it to your CRM — built exclusively for home service contractors.
          </p>
          <Button size="lg" onClick={handleSignup} className="text-base w-full sm:w-auto px-6 sm:px-8">
            Start Free
          </Button>
        </div>
      </section>

      <div className="bg-primary/5 border-y border-primary/20 py-5 sm:py-6 px-4 sm:px-6 text-center">
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl mx-auto">
          Home service contractors miss <strong>27–62% of inbound calls</strong>. Each missed call costs an average of <strong>$300–$1,200 in lost revenue</strong>. <span className="font-medium text-foreground">RingSnap pays for itself the first week.</span>
        </p>
      </div>

      <section className="section-spacer px-4 sm:px-6">
        <div className="container mx-auto max-w-7xl">
          <p className="text-center text-sm sm:text-base text-muted-foreground mb-5 sm:mb-6">3 days free, cancel anytime on every plan.</p>
          <div className="grid gap-5 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((plan) => (
              <Card key={plan.key} className={cn("relative flex h-full flex-col", plan.highlight && "border-primary border-2 shadow-lg")}>
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="bg-primary text-white px-3 py-1">{plan.badge}</Badge>
                  </div>
                )}

                <CardHeader className="pb-3 pt-6 px-5 sm:px-6">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-xl leading-tight">{plan.name}</CardTitle>
                      <CardDescription className="mt-2 text-sm leading-relaxed">{plan.tagline}</CardDescription>
                    </div>
                    {plan.key === "night_weekend" && <Moon className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />}
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col flex-1 space-y-5 px-5 pb-5 sm:px-6 sm:pb-6">
                  <div className="flex items-end gap-1.5">
                    <span className="text-4xl font-bold leading-none">${plan.price}</span>
                    <span className="text-muted-foreground text-base">/mo</span>
                  </div>

                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600 shrink-0" />
                      <span>{plan.includedMinutes.toLocaleString()} minutes included</span>
                    </div>
                    <div className="text-muted-foreground text-xs ml-6">${plan.overageRate.toFixed(2)}/min if you go over</div>
                    {plan.coverageNote && (
                      <div className="flex items-center gap-2 text-sm text-amber-700 font-medium mt-1">
                        <Moon className="h-3.5 w-3.5 shrink-0" />
                        <span className="text-xs">{plan.coverageNote}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 flex-1">
                    {plan.features.map((feature, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-auto space-y-2 pt-2">
                    <p className={cn("text-xs italic min-h-4", "socialProof" in plan && (plan as any).socialProof ? "text-muted-foreground" : "invisible")}>
                      {("socialProof" in plan && (plan as any).socialProof) || "placeholder"}
                    </p>
                    <Button className={cn("w-full text-sm", plan.highlight ? "" : "variant-outline")} variant={plan.highlight ? "default" : "outline"} onClick={handleSignup}>
                      Start Free
                    </Button>
                    <p className={cn("text-xs text-center min-h-4", plan.upgradeNudge ? "text-muted-foreground" : "invisible")}>{plan.upgradeNudge || "placeholder"}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 pb-14">
        <div className="container mx-auto max-w-5xl">
          <div className="rounded-2xl border bg-gradient-to-br from-primary/5 via-white to-emerald-50 p-6 sm:p-8 text-center">
            <Badge variant="secondary" className="mb-3">Contractor proof</Badge>
            <p className="text-lg sm:text-xl font-semibold" style={{ color: "hsl(var(--charcoal))" }}>
              Teams using RingSnap report recovering <span className="text-primary">$8k–$42k/month</span> in previously missed revenue.
            </p>
            <p className="text-sm sm:text-base text-muted-foreground mt-3 max-w-3xl mx-auto">
              They close more jobs while getting evenings and weekends back — no more dropping everything to answer every incoming call.
            </p>
          </div>
        </div>
      </section>

      <section className="section-spacer px-4 sm:px-6 bg-slate-50">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8" style={{ color: "hsl(var(--charcoal))" }}>
            How RingSnap compares
          </h2>
          <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="border-b">
                    <th className="text-left py-4 px-4 font-semibold min-w-44">Feature</th>
                    <th className="py-4 px-3 font-bold text-primary">RingSnap</th>
                    <th className="py-4 px-3 font-medium text-muted-foreground">Goodcall</th>
                    <th className="py-4 px-3 font-medium text-muted-foreground">AgentZap</th>
                    <th className="py-4 px-3 font-medium text-muted-foreground">Smith.ai</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_TABLE.map((row, i) => (
                    <tr key={i} className={cn("border-b last:border-0", i % 2 === 0 ? "bg-white" : "bg-slate-50/30")}>
                      <td className="py-3.5 px-4 text-sm font-medium">{row.feature}</td>
                      <td className="py-3.5 px-3 text-center"><CompCell value={row.ringsnap} /></td>
                      <td className="py-3.5 px-3 text-center"><CompCell value={row.goodcall} /></td>
                      <td className="py-3.5 px-3 text-center"><CompCell value={row.agentzap} /></td>
                      <td className="py-3.5 px-3 text-center"><CompCell value={row.smithai} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4 text-center">Prices as of March 2026. Competitor features based on publicly listed plans.</p>
        </div>
      </section>

      <section className="section-spacer px-4 sm:px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: "hsl(var(--charcoal))" }}>How many minutes do you actually need?</h2>
            <p className="text-sm sm:text-base text-muted-foreground max-w-3xl mx-auto">
              Home service calls usually run 2–3 minutes. Use this guide to choose the fastest path to ROI.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {MINUTE_GUIDE.map((item) => (
              <Card key={item.trade} className="border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{item.trade}</CardTitle>
                  <CardDescription>{item.callVolume}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{item.avgCallLength}</p>
                  <p className="text-sm">{item.fit}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5 text-sm sm:text-base text-center">
            <p>
              Want the lowest base cost + pay for usage? <strong>Lite</strong> is your fit. Want to close more jobs 24/7 with predictable billing? <strong>Core</strong> is the best fit for most contractors that rely on phone calls for revenue.
            </p>
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 pb-14">
        <div className="container mx-auto max-w-3xl">
          <div className="rounded-2xl border bg-white p-6 sm:p-8 text-center shadow-sm">
            <Sparkles className="h-6 w-6 text-primary mx-auto mb-3" />
            <h3 className="text-xl sm:text-2xl font-bold" style={{ color: "hsl(var(--charcoal))" }}>Hear RingSnap live</h3>
            <p className="text-muted-foreground text-sm sm:text-base mt-2 mb-5">Listen to a real call flow and hear how RingSnap books jobs in under 2 minutes.</p>
            <Button asChild size="lg" className="w-full sm:w-auto px-8">
              <a href="/#live-demo">Hear RingSnap Live Demo</a>
            </Button>
          </div>
        </div>
      </section>

      <section className="section-spacer px-4 sm:px-6">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8" style={{ color: "hsl(var(--charcoal))" }}>
            Frequently asked questions
          </h2>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div key={i} className="border rounded-lg overflow-hidden">
                <button
                  className="w-full flex justify-between items-center gap-3 px-5 py-4 text-left font-medium text-sm sm:text-base hover:bg-muted/30 transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span>{faq.q}</span>
                  {openFaq === i ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                </button>
                {openFaq === i && <div className="px-5 pb-4 text-sm text-muted-foreground">{faq.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-spacer px-4 sm:px-6 text-center bg-primary/5 border-t">
        <div className="container mx-auto max-w-xl">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{ color: "hsl(var(--charcoal))" }}>
            Ready to stop missing calls?
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base mb-6">3 days free on every plan. No setup fees. Cancel anytime.</p>
          <Button size="lg" onClick={handleSignup} className="text-base w-full sm:w-auto px-8">
            Start Free Trial
          </Button>
        </div>
      </section>
    </div>
  );
};
