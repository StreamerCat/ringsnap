import { ChangeEvent, FormEvent, useMemo, useReducer, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  DollarSign,
  Download,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  TrendingUp
} from "lucide-react";

type CalculatorState = {
  calls: number;
  answerRate: number;
  jobValue: number;
};

type CalculatorAction =
  | {
      type: "update";
      field: keyof CalculatorState;
      value: number;
    }
  | {
      type: "applyPreset";
      preset: keyof typeof tradePresets;
    };

const calculatorReducer = (state: CalculatorState, action: CalculatorAction): CalculatorState => {
  switch (action.type) {
    case "update":
      return {
        ...state,
        [action.field]: action.value
      };
    case "applyPreset":
      return {
        ...tradePresets[action.preset].defaults
      };
    default:
      return state;
  }
};

const tradePresets = {
  plumbing: {
    label: "Plumber",
    defaults: {
      calls: 210,
      answerRate: 54,
      jobValue: 975
    },
    insight: "Burst pipe callers hire the first plumber who answers—Google's data shows a 3× close rate over web forms."
  },
  hvac: {
    label: "HVAC",
    defaults: {
      calls: 260,
      answerRate: 58,
      jobValue: 1450
    },
    insight: "Peak-season HVAC installs average $1,450 and 68% of searchers convert by phone within 30 minutes."
  },
  roofing: {
    label: "Roofing",
    defaults: {
      calls: 140,
      answerRate: 62,
      jobValue: 2400
    },
    insight: "Insurance-driven roof replacements close near $2,400 when the first responder picks up immediately."
  },
  electrical: {
    label: "Electrical",
    defaults: {
      calls: 180,
      answerRate: 49,
      jobValue: 1250
    },
    insight: "Code-compliance emergencies average $1,250 and two in five callers abandon if it goes to voicemail."
  }
} satisfies Record<string, {
  label: string;
  defaults: CalculatorState;
  insight: string;
}>;

interface CallValueCalculatorProps {
  showPdfDownload?: boolean;
  companyName?: string;
  onPdfDownload?: (metrics: any) => void;
}

export const CallValueCalculator = ({
  showPdfDownload = false,
  companyName = "",
  onPdfDownload
}: CallValueCalculatorProps = {}) => {
  const [selectedPreset, setSelectedPreset] = useState<keyof typeof tradePresets>("plumbing");
  const [email, setEmail] = useState("");
  const [repName, setRepName] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [formState, setFormState] = useState<"idle" | "submitted">("idle");
  const [inputs, dispatch] = useReducer(
    calculatorReducer,
    tradePresets[selectedPreset].defaults,
    defaults => ({
      ...defaults
    })
  );

  const numberFormatter = useMemo(() => new Intl.NumberFormat("en-US"), []);

  const metrics = useMemo(() => {
    const monthlyCalls = inputs.calls;
    const answeredCalls = Math.round(monthlyCalls * (inputs.answerRate / 100));
    const missedCalls = Math.max(0, monthlyCalls - answeredCalls);
    const recoveredCallCapture = Math.round(missedCalls * 0.95);
    const lostRevenue = missedCalls * inputs.jobValue;
    const recoveredRevenue = recoveredCallCapture * inputs.jobValue;
    const aiCost = monthlyCalls <= 80 ? 297 : monthlyCalls <= 160 ? 797 : 1497;
    const netGain = recoveredRevenue - aiCost;
    const roi = aiCost > 0 ? Math.round((netGain / aiCost) * 100) : 0;
    const paybackDays = recoveredRevenue > 0 ? Math.max(1, Math.round((aiCost / recoveredRevenue) * 30)) : 30;

    return {
      monthlyCalls,
      answeredCalls,
      missedCalls,
      recoveredCallCapture,
      lostRevenue,
      recoveredRevenue,
      aiCost,
      netGain,
      roi,
      paybackDays
    };
  }, [inputs]);

  const presetInsight = tradePresets[selectedPreset].insight;
  const breakEvenJobs = Math.max(1, Math.ceil(metrics.aiCost / Math.max(inputs.jobValue, 1)));

  const handlePresetClick = (presetKey: keyof typeof tradePresets) => {
    setSelectedPreset(presetKey);
    dispatch({
      type: "applyPreset",
      preset: presetKey
    });
  };

  const handleNumberChange = (field: keyof CalculatorState) => (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value);

    if (Number.isNaN(nextValue)) {
      return;
    }

    const clampedValue = field === "answerRate" ? Math.min(100, Math.max(0, nextValue)) : Math.max(0, nextValue);

    dispatch({
      type: "update",
      field,
      value: clampedValue
    });
  };

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormState("submitted");
  };

  return (
    <section id="calculator" className="section-spacer bg-slate-50">
      <div className="container mx-auto max-w-6xl px-4">
        <hr className="section-divider mb-10" />

        <div className="space-y-12">
          <header className="space-y-6">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.28em] text-primary">
              <Sparkles className="h-5 w-5" /> For home-service teams
            </div>
            <div className="space-y-6">
              <h2 className="text-pretty text-4xl font-bold leading-tight sm:text-5xl">
                Turn every missed call into booked revenue with RingSnap.
              </h2>
              <p className="max-w-3xl text-lg text-muted-foreground sm:text-xl">
                Homeowners still grab the phone first, and 7 in 10 hire whoever answers immediately. Drop in your call volume to
                see how much revenue RingSnap recovers every month.
              </p>
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 text-base font-semibold text-slate-900 sm:text-lg">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                  Built from 1.2k+ service call audits
                </div>
                <p className="mt-3 text-sm text-muted-foreground sm:mt-0 sm:max-w-md">
                  Contractors using RingSnap answer in under 8 seconds and recover $18.7k in booked jobs every month on average.
                </p>
              </div>
            </div>
          </header>

          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="space-y-6">
              <div className="flex flex-wrap items-center gap-3 text-base text-muted-foreground">
                <Badge variant="secondary" className="rounded-full border border-primary/10 bg-primary/10 px-4 py-1.5 text-primary">
                  60-second ROI snapshot
                </Badge>
                <span className="text-sm sm:text-base">Pick the preset that mirrors your job mix to preload benchmarks.</span>
              </div>
              <RadioGroup
                value={selectedPreset}
                onValueChange={value => value && handlePresetClick(value as keyof typeof tradePresets)}
                className="grid gap-3 md:grid-cols-2"
              >
                {(Object.keys(tradePresets) as (keyof typeof tradePresets)[]).map(presetKey => {
                  const preset = tradePresets[presetKey];
                  const defaults = preset.defaults;
                  return (
                    <div key={presetKey}>
                      <RadioGroupItem value={presetKey} id={`trade-${presetKey}`} className="peer sr-only" />
                      <Label
                        htmlFor={`trade-${presetKey}`}
                        className="flex w-full flex-col gap-2 rounded-3xl border border-slate-200 bg-white p-5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
                      >
                        <span className="text-lg font-semibold text-slate-900">{preset.label}</span>
                        <span className="text-sm text-muted-foreground">
                          {numberFormatter.format(defaults.calls)} calls · {defaults.answerRate}% live answer · ${numberFormatter.format(defaults.jobValue)} ticket
                        </span>
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
              <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">{presetInsight}</p>
            </CardHeader>

            <CardContent className="space-y-12">
              <div className="space-y-6">
                <CardTitle className="text-3xl font-semibold text-slate-900">Dial in your call mix</CardTitle>
                <CardDescription className="text-base text-muted-foreground">
                  Update the three inputs below and the ROI story updates instantly.
                </CardDescription>
                <div className="space-y-5">
                  <div className="space-y-3">
                    <Label htmlFor="calls-input" className="flex items-center gap-2 text-base font-semibold text-slate-800">
                      <PhoneCall className="h-5 w-5 text-primary" /> Monthly inbound calls
                    </Label>
                    <Input
                      id="calls-input"
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      value={inputs.calls}
                      onChange={handleNumberChange("calls")}
                      className="h-16 rounded-3xl border-2 border-slate-200 bg-white text-2xl font-semibold text-slate-900 focus-visible:border-primary focus-visible:ring-0"
                    />
                    <p className="text-sm text-muted-foreground">
                      Benchmark: top-quartile crews field 150-280 inbound requests per month across Google and referrals.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="answer-rate-input" className="flex items-center gap-2 text-base font-semibold text-slate-800">
                      <TrendingUp className="h-5 w-5 text-primary" /> % answered live
                    </Label>
                    <Input
                      id="answer-rate-input"
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      inputMode="decimal"
                      value={inputs.answerRate}
                      onChange={handleNumberChange("answerRate")}
                      className="h-16 rounded-3xl border-2 border-slate-200 bg-white text-2xl font-semibold text-slate-900 focus-visible:border-primary focus-visible:ring-0"
                    />
                    <p className="text-sm text-muted-foreground">
                      Every 10% drop in live answer rate leaks {numberFormatter.format(Math.round(inputs.calls * 0.1))} high-intent callers who usually hire whoever picked up first.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="job-value-input" className="flex items-center gap-2 text-base font-semibold text-slate-800">
                      <DollarSign className="h-5 w-5 text-primary" /> Average booked job value
                    </Label>
                    <Input
                      id="job-value-input"
                      type="number"
                      min={0}
                      step={25}
                      inputMode="decimal"
                      value={inputs.jobValue}
                      onChange={handleNumberChange("jobValue")}
                      className="h-16 rounded-3xl border-2 border-slate-200 bg-white text-2xl font-semibold text-slate-900 focus-visible:border-primary focus-visible:ring-0"
                    />
                    <p className="text-sm text-muted-foreground">
                      Each unanswered call walks with roughly ${numberFormatter.format(inputs.jobValue)} in revenue you already paid to generate.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="space-y-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">What changes with RingSnap</div>
                  <div className="space-y-4">
                    <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6">
                      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-rose-500">
                        <AlertTriangle className="h-5 w-5" /> Before RingSnap
                      </div>
                      <p className="mt-4 text-3xl font-bold text-rose-600">
                        {numberFormatter.format(metrics.missedCalls)} missed calls
                      </p>
                      <p className="mt-2 text-lg text-rose-600/80">
                        Leaking ${numberFormatter.format(metrics.lostRevenue)} every month.
                      </p>
                    </div>
                    <div className="rounded-3xl border border-emerald-300 bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-600 p-6 text-white">
                      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/80">
                        <Sparkles className="h-5 w-5" /> After RingSnap
                      </div>
                      <p className="mt-4 text-3xl font-bold">
                        {numberFormatter.format(metrics.recoveredCallCapture)} rescued callers
                      </p>
                      <p className="mt-2 text-lg text-white/90">
                        Worth ${numberFormatter.format(metrics.recoveredRevenue)} in booked jobs.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Plan comparison</div>
                  <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 text-white">
                    <div className="space-y-3 text-lg">
                      <div className="flex flex-col">
                        <span className="text-sm uppercase tracking-wide text-white/60">RingSnap coverage</span>
                        <span className="text-3xl font-bold">${numberFormatter.format(metrics.aiCost)}/mo</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm uppercase tracking-wide text-white/60">Net profit lift</span>
                        <span className="text-3xl font-bold">${numberFormatter.format(metrics.netGain)}</span>
                      </div>
                      <p className="text-sm text-white/70">Break-even in ≈ {breakEvenJobs} booked jobs.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">ROI summary</div>
                  <div className="space-y-4">
                    <div className="rounded-3xl border border-slate-200 bg-white p-6">
                      <div className="text-sm font-semibold uppercase tracking-wide text-slate-600">ROI percentage</div>
                      <div className="mt-2 text-4xl font-bold text-slate-900">{metrics.roi}%</div>
                      <p className="mt-2 text-base text-muted-foreground">Driven by AI follow-up vs. base subscription.</p>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-white p-6">
                      <div className="text-sm font-semibold uppercase tracking-wide text-slate-600">Recovered revenue</div>
                      <div className="mt-2 text-4xl font-bold text-slate-900">${numberFormatter.format(metrics.recoveredRevenue)}</div>
                      <p className="mt-2 text-base text-muted-foreground">Booked back every month from callers you already generated.</p>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-white p-6">
                      <div className="text-sm font-semibold uppercase tracking-wide text-slate-600">Payback period</div>
                      <div className="mt-2 text-4xl font-bold text-slate-900">{metrics.paybackDays} days</div>
                      <p className="mt-2 text-base text-muted-foreground">After that it’s pure profit compared to running voicemail.</p>
                    </div>
                  </div>
                </div>

                {showPdfDownload && companyName && (
                  <Button
                    onClick={() => onPdfDownload?.(metrics)}
                    size="lg"
                    className="w-full rounded-3xl border-2 border-slate-800 bg-white text-slate-900 hover:bg-slate-100"
                  >
                    <Download className="mr-2 h-5 w-5" /> Download ROI Report PDF
                  </Button>
                )}

                <form className="space-y-5" onSubmit={handleFormSubmit}>
                  <div className="space-y-2">
                    <Label
                      htmlFor="summary-email"
                      className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-700"
                    >
                      Email the ROI summary
                    </Label>
                    <Input
                      id="summary-email"
                      type="email"
                      required
                      placeholder="you@company.com"
                      value={email}
                      onChange={event => setEmail(event.target.value)}
                      className="h-14 rounded-3xl border-2 border-slate-200 bg-white text-base text-slate-900 focus-visible:border-primary focus-visible:ring-0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="sales-rep-name"
                      className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-700"
                    >
                      Sales rep name
                    </Label>
                    <Input
                      id="sales-rep-name"
                      type="text"
                      required
                      placeholder="Who is sending this?"
                      value={repName}
                      onChange={event => setRepName(event.target.value)}
                      className="h-14 rounded-3xl border-2 border-slate-200 bg-white text-base text-slate-900 focus-visible:border-primary focus-visible:ring-0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="meeting-date" className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-700">
                      Date to follow up
                    </Label>
                    <Input
                      id="meeting-date"
                      type="date"
                      required
                      value={meetingDate}
                      onChange={event => setMeetingDate(event.target.value)}
                      className="h-14 rounded-3xl border-2 border-slate-200 bg-white text-base text-slate-900 focus-visible:border-primary focus-visible:ring-0"
                    />
                  </div>
                  <Button
                    type="submit"
                    size="lg"
                    className="h-14 w-full rounded-3xl bg-primary text-lg font-semibold text-white hover:bg-primary/90"
                  >
                    Send summary <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                  {formState === "submitted" ? (
                    <div className="flex items-center gap-3 rounded-3xl border border-primary/40 bg-primary/10 p-4 text-sm text-primary">
                      <CheckCircle2 className="h-5 w-5" />
                      We’ll send the recap to {email} with your name ({repName}) and the follow-up date so leadership can respond.
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Your summary email bundles the call math, ROI highlights, and next steps for the leadership team.
                    </p>
                  )}
                </form>

                <div className="rounded-3xl border border-slate-200 bg-white p-6">
                  <p className="text-lg font-semibold text-slate-900">
                    “RingSnap plugged the $38k/mo hole in our call queue and let us scale without hiring.”
                  </p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                    Bryan — Owner, Precision Plumbing
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

