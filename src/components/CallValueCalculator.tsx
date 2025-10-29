import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  DollarSign,
  Mail,
  PhoneCall,
  Share2,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";

const CAPTURE_RATE = 0.7;

export const CallValueCalculator = () => {
  const [monthlyCalls, setMonthlyCalls] = useState<[number]>([180]);
  const [answerRate, setAnswerRate] = useState<[number]>([60]);
  const [avgJobValue, setAvgJobValue] = useState<[number]>([1200]);

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);

  const normCalls = monthlyCalls[0];
  const normAnswerRate = answerRate[0];
  const normAvgJobValue = avgJobValue[0];

  const formattedRevenue = useMemo(
    () => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }),
    []
  );

  const answeredCalls = Math.round(normCalls * (normAnswerRate / 100));
  const missedCalls = Math.max(0, normCalls - answeredCalls);
  const recoveredJobs = Math.round(missedCalls * CAPTURE_RATE);
  const recoveredRevenueMonthly = recoveredJobs * normAvgJobValue;
  const recoveredRevenueYearly = recoveredRevenueMonthly * 12;

  const aiCost =
    normCalls <= 20 ? 297 : normCalls <= 40 ? 797 : 1497;

  const planName =
    normCalls <= 20 ? "Starter" : normCalls <= 40 ? "Growth" : "Pro";

  const netGainMonthly = recoveredRevenueMonthly - aiCost;
  const paybackJobs = Math.max(1, Math.ceil(aiCost / Math.max(normAvgJobValue, 1)));
  const paybackDays = Math.max(
    1,
    Math.round((aiCost / Math.max(recoveredRevenueMonthly, 1)) * 30)
  );

  const roiSummary = useMemo(
    () =>
      `We’re currently missing ${missedCalls} calls a month. If RingSnap books even ~70% of them, that’s ~${recoveredJobs} extra jobs worth $${formattedRevenue.format(
        recoveredRevenueMonthly
      )}/mo (${planName} plan at $${formattedRevenue.format(aiCost)}/mo pays for itself in about ${paybackJobs} jobs).`,
    [aiCost, formattedRevenue, missedCalls, paybackJobs, planName, recoveredJobs, recoveredRevenueMonthly]
  );

  const handleSendReport = async () => {
    if (!email || submitting || submitted) return;
    setSubmitting(true);

    try {
      await fetch("/api/snap-lead", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          monthlyCalls: normCalls,
          answerRate: normAnswerRate,
          avgJobValue: normAvgJobValue,
          missedCalls,
          recoveredJobs,
          recoveredRevenueMonthly,
          recoveredRevenueYearly,
          aiCost,
          planName,
          netGainMonthly,
          paybackJobs,
          paybackDays,
        }),
      });

      setSubmitted(true);

      const pricingEl = document.getElementById("pricing");
      pricingEl?.scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      console.error("Error saving lead", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleScrollToPricing = () => {
    const pricingEl = document.getElementById("pricing");
    pricingEl?.scrollIntoView({ behavior: "smooth" });
  };

  const handleCopySummary = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(roiSummary);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        throw new Error("Clipboard not supported");
      }
    } catch (error) {
      console.error("Failed to copy summary", error);
    }
  };

  return (
    <section
      id="calculator"
      className="section-spacer bg-gradient-to-b from-white to-gray-50"
    >
      <div className="container mx-auto px-4 max-w-5xl">
        <hr className="section-divider mb-8 sm:mb-12" />

        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <AlertTriangle className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium">Missed calls are missed jobs</span>
          </div>

          <h2 className="text-h2 mb-3">
            How much revenue are you leaving on the table?
          </h2>

          <p className="text-body-default text-muted-foreground max-w-2xl mx-auto">
            RingSnap answers every call in under one second, sounds human, books the job on your calendar, and never sleeps. Adjust your numbers below to see what that’s worth for you.
          </p>
        </div>

        <Card className="card-tier-1 shadow-xl border border-gray-200/80 rounded-2xl">
          <CardContent className="p-6 sm:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-start">
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm flex items-center gap-1.5">
                      <PhoneCall className="w-4 h-4 opacity-70" />
                      Calls per month
                    </Label>
                    <span className="text-sm font-bold text-metric">
                      {normCalls} calls
                    </span>
                  </div>

                  <input
                    type="tel"
                    inputMode="numeric"
                    value={normCalls}
                    onChange={(e) =>
                      setMonthlyCalls([
                        Math.max(
                          20,
                          Math.min(600, Number(e.target.value) || 180)
                        ),
                      ])
                    }
                    className="sm:hidden w-full h-12 px-4 rounded-md border border-input text-center text-lg font-bold input-focus"
                  />

                  <Slider
                    value={monthlyCalls}
                    onValueChange={setMonthlyCalls}
                    min={20}
                    max={600}
                    step={10}
                    className="hidden sm:block input-focus"
                  />
                  <p className="text-xs text-muted-foreground">
                    Typical plumbing / HVAC / electrical: 80 to 300 calls a month
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 opacity-70" />
                      % answered live by a human
                    </Label>
                    <span className="text-sm font-bold text-metric">
                      {normAnswerRate}%
                    </span>
                  </div>

                  <input
                    type="tel"
                    inputMode="numeric"
                    value={normAnswerRate}
                    onChange={(e) =>
                      setAnswerRate([
                        Math.max(
                          10,
                          Math.min(100, Number(e.target.value) || 60)
                        ),
                      ])
                    }
                    className="sm:hidden w-full h-12 px-4 rounded-md border border-input text-center text-lg font-bold input-focus"
                  />

                  <Slider
                    value={answerRate}
                    onValueChange={setAnswerRate}
                    min={10}
                    max={100}
                    step={5}
                    className="hidden sm:block input-focus"
                  />
                  <p className="text-xs text-muted-foreground">
                    Most shops only answer 38 to 62 percent in real time
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 opacity-70" />
                      Avg booked job value
                    </Label>
                    <span className="text-sm font-bold text-metric">
                      ${normAvgJobValue.toLocaleString()}
                    </span>
                  </div>

                  <input
                    type="tel"
                    inputMode="numeric"
                    value={normAvgJobValue}
                    onChange={(e) =>
                      setAvgJobValue([
                        Math.max(
                          200,
                          Math.min(5000, Number(e.target.value) || 1200)
                        ),
                      ])
                    }
                    className="sm:hidden w-full h-12 px-4 rounded-md border border-input text-center text-lg font-bold input-focus"
                  />

                  <Slider
                    value={avgJobValue}
                    onValueChange={setAvgJobValue}
                    min={200}
                    max={5000}
                    step={100}
                    className="hidden sm:block input-focus"
                  />
                  <p className="text-xs text-muted-foreground">
                    Mix of emergencies, quotes, and scheduled jobs
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>Pro tip: bump your answer rate just 10% and the ROI doubles.</span>
                </div>
              </div>

              <div className="flex flex-col justify-between h-full space-y-8 lg:space-y-10">
                <div className="space-y-3 text-center lg:text-left">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    You could be adding
                  </div>

                  <div className="text-4xl sm:text-5xl font-bold text-green-600 leading-tight animate-count-up">
                    +${recoveredRevenueMonthly.toLocaleString()}/month
                  </div>

                  <div className="text-base sm:text-lg font-semibold text-muted-foreground">
                    ≈ ${recoveredRevenueYearly.toLocaleString()} per year
                  </div>

                  <p className="text-sm text-muted-foreground max-w-[32ch] lg:max-w-none mx-auto lg:mx-0">
                    This is revenue from calls you’re currently missing. RingSnap answers instantly, books the job, and puts it on your calendar.
                  </p>

                  <div className="flex flex-wrap justify-center lg:justify-start gap-2 pt-2">
                    <Badge variant="secondary" className="border border-primary/20 bg-primary/10 text-primary">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Trusted by 450+ contractors
                    </Badge>
                    <Badge variant="outline" className="border-dashed">
                      <Users className="w-3.5 h-3.5 mr-1" /> Avg CSAT 4.8/5
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border border-gray-200 bg-white/50 p-4 text-center">
                    <div className="flex items-center justify-center gap-2 text-[13px] font-medium text-muted-foreground mb-1">
                      <PhoneCall className="w-4 h-4 opacity-80" />
                      <span>Missed calls</span>
                    </div>
                    <div className="text-xl font-bold text-slate-900">{missedCalls}</div>
                    <div className="text-[11px] text-muted-foreground">per month</div>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-white/50 p-4 text-center">
                    <div className="flex items-center justify-center gap-2 text-[13px] font-medium text-muted-foreground mb-1">
                      <Calendar className="w-4 h-4 opacity-80" />
                      <span>Payback</span>
                    </div>
                    <div className="text-xl font-bold text-slate-900">{paybackJobs} jobs</div>
                    <div className="text-[11px] text-muted-foreground">~{paybackDays} days</div>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-white/50 p-4 text-center sm:col-span-1 col-span-2">
                    <div className="flex items-center justify-center gap-2 text-[13px] font-medium text-muted-foreground mb-1">
                      <TrendingUp className="w-4 h-4 opacity-80" />
                      <span>Your plan</span>
                    </div>
                    <div className="text-xl font-bold text-slate-900">{planName}</div>
                    <div className="text-[11px] text-muted-foreground">
                      ${aiCost.toLocaleString()}/mo
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto h-11 font-semibold"
                    onClick={handleScrollToPricing}
                  >
                    See plan breakdown
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full sm:w-auto h-11 text-sm"
                    onClick={handleCopySummary}
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    {copied ? "Copied" : "Share with a partner"}
                  </Button>
                </div>

                <div className="space-y-3 rounded-xl border border-gray-200 bg-slate-50 p-4 sm:p-5">
                  {!submitted ? (
                    <>
                      <div className="flex items-start sm:items-center gap-2 sm:gap-3">
                        <Mail className="w-5 h-5 text-primary shrink-0" />
                        <div className="text-sm">
                          <div className="font-semibold text-slate-900">
                            Get this ROI report in your inbox
                          </div>
                          <div className="text-muted-foreground text-xs leading-relaxed">
                            We’ll send you a breakdown with your numbers so you can forward it to your partner or ops lead.
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3">
                        <Input
                          type="email"
                          placeholder="you@company.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="bg-white"
                        />
                        <Button
                          onClick={handleSendReport}
                          disabled={submitting}
                          className="w-full sm:w-auto h-11 text-base font-semibold rounded-full bg-primary text-white shadow-lg hover:shadow-xl transition-all"
                        >
                          {submitting ? "Sending..." : "Send my ROI report"}
                        </Button>
                      </div>

                      <div className="text-[11px] text-muted-foreground text-center sm:text-left">
                        No spam. Just your math.
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-sm font-medium text-slate-900">
                      Check your inbox. Your ROI breakdown is on the way.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
