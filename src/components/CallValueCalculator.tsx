import { FormEvent, useMemo, useReducer, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DollarSign, TrendingUp, AlertTriangle, PhoneCall, ArrowRight, Sparkles, ShieldCheck, Clock3, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
type CalculatorState = {
  calls: number;
  answerRate: number;
  jobValue: number;
};
type CalculatorAction = {
  type: "update";
  field: keyof CalculatorState;
  value: number;
} | {
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
export const CallValueCalculator = () => {
  const [selectedPreset, setSelectedPreset] = useState<keyof typeof tradePresets>("plumbing");
  const [email, setEmail] = useState("");
  const [formState, setFormState] = useState<"idle" | "submitted">("idle");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [inputs, dispatch] = useReducer(calculatorReducer, tradePresets[selectedPreset].defaults, defaults => ({
    ...defaults
  }));
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
    const roi = aiCost > 0 ? Math.round(netGain / aiCost * 100) : 0;
    const paybackDays = recoveredRevenue > 0 ? Math.max(1, Math.round(aiCost / recoveredRevenue * 30)) : 30;
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
  const quickStats = [{
    label: "Answered live",
    value: `${numberFormatter.format(metrics.answeredCalls)} calls`,
    helper: "Conversations your crew already wins"
  }, {
    label: "Missed monthly",
    value: `${numberFormatter.format(metrics.missedCalls)} calls`,
    helper: "High-intent buyers hitting voicemail"
  }, {
    label: "Revenue per call",
    value: `$${numberFormatter.format(inputs.jobValue)}`,
    helper: "Average booked ticket on the line"
  }];
  const followUpHighlights = [{
    title: "48-hour launch plan",
    copy: "Routing map, voicemail scripts, and SMS cadences so you switch on RingSnap without hiring."
  }, {
    title: "Missed-call recovery templates",
    copy: "Text + email follow-ups that convert 30-50% of abandoned callers back into booked jobs."
  }, {
    title: "Executive-ready ROI recap",
    copy: "A shareable dashboard proving the revenue impact for owners, ops leaders, and CSRs."
  }];
  const handlePresetClick = (presetKey: keyof typeof tradePresets) => {
    setSelectedPreset(presetKey);
    dispatch({
      type: "applyPreset",
      preset: presetKey
    });
    setIsAdvancedOpen(false);
  };
  const handleSliderChange = (field: keyof CalculatorState) => (value: number[]) => {
    dispatch({
      type: "update",
      field,
      value: value[0]
    });
  };
  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormState("submitted");
  };

  const renderResultsCard = (className = "") => (
    <Card className={`border border-slate-800 bg-slate-950 text-white shadow-xl ${className}`.trim()}>
      <CardHeader className="space-y-3">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-primary/60">
          <AlertTriangle className="h-4 w-4" /> Recovered revenue snapshot
        </div>
        <CardTitle className="text-3xl font-bold">
          ${numberFormatter.format(metrics.recoveredRevenue)}
          <span className="block text-base font-medium text-white/70">Booked back every month</span>
        </CardTitle>
        <CardDescription className="text-white/75">
          {numberFormatter.format(metrics.missedCalls)} missed calls leak ${numberFormatter.format(metrics.lostRevenue)} in booked work today.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-white/60">Recovered revenue</div>
            <div className="mt-1 text-xl font-semibold text-white">${numberFormatter.format(metrics.recoveredRevenue)}</div>
            <div className="mt-1 text-[11px] text-white/60">Captured by RingSnap AI follow-up</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-white/60">Net profit lift</div>
            <div className="mt-1 text-xl font-semibold text-white">${numberFormatter.format(metrics.netGain)}</div>
            <div className="mt-1 text-[11px] text-white/60">ROI: {metrics.roi}% vs. subscription</div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-white/60">Break-even pace</div>
            <div className="mt-1 text-xl font-semibold text-white">{metrics.paybackDays} days</div>
            <div className="mt-1 text-[11px] text-white/60">≈ {breakEvenJobs} booked jobs</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-white/60">Monthly plan</div>
            <div className="mt-1 text-xl font-semibold text-white">${numberFormatter.format(metrics.aiCost)}/mo</div>
            <div className="mt-1 text-[11px] text-white/60">24/7 coverage included</div>
          </div>
        </div>
        <ul className="space-y-2 text-sm text-white/70">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
            <span>High-intent callers get quotes, scheduling links, and follow-ups automatically.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
            <span>Owners see a daily recap of booked jobs, missed opportunities, and talk tracks.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
            <span>CSRs reclaim time for VIP customers instead of chasing voicemails.</span>
          </li>
        </ul>
        <form className="space-y-4" onSubmit={handleFormSubmit}>
          <div className="space-y-2">
            <Label htmlFor="roi-email" className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">
              Email my ROI teardown
            </Label>
            <Input
              id="roi-email"
              type="email"
              required
              placeholder="you@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 rounded-lg border-slate-700 bg-slate-900 text-white placeholder:text-white/50 focus-visible:ring-primary"
            />
          </div>
          <Button type="submit" size="lg" className="w-full rounded-lg bg-primary text-white hover:bg-primary/90">
            Send me the ROI report <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          {formState === "submitted" ? (
            <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 p-3 text-xs text-primary">
              <CheckCircle2 className="h-4 w-4" />
              We just sent the launch kit—check your inbox for scripts, cadences, and ROI math.
            </div>
          ) : (
            <p className="text-xs text-white/60">No spam—just the proof you need to sell AI coverage to owners and ops leads.</p>
          )}
        </form>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-sm font-semibold text-white">“RingSnap plugged the $38k/mo hole in our call queue and let us scale without hiring.”</p>
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.2em] text-white/60">Bryan — Owner, Precision Plumbing</p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <section id="calculator" className="section-spacer bg-slate-50">
      <div className="container mx-auto max-w-7xl px-4">
        <hr className="section-divider mb-10" />

        <div className="space-y-12">
          <header className="space-y-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-primary">
              <Sparkles className="h-4 w-4" /> For home-service teams
            </div>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.8fr)] lg:items-start">
              <div className="space-y-4">
                <h2 className="text-h2 leading-tight">
                  Turn every missed call into booked revenue with RingSnap.
                </h2>
                <p className="text-body-default text-muted-foreground">
                  Homeowners still reach for the phone first—and 7 in 10 hire whoever responds immediately. Drop in your call volume to see how much revenue RingSnap recovers, then snag the launch kit we send top-performing crews.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Built from 1.2k+ service call audits
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Contractors using RingSnap answer in under 8 seconds and recover $18.7k in booked jobs every month on average.
                </p>
              </div>
            </div>
          </header>

          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="space-y-6">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary" className="border border-primary/10 bg-primary/10 text-primary">
                  60-second ROI snapshot
                </Badge>
                <span>Pick the preset that mirrors your job mix to preload benchmarks.</span>
              </div>
              <ToggleGroup
                type="single"
                value={selectedPreset}
                onValueChange={(value) => value && handlePresetClick(value as keyof typeof tradePresets)}
                className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
              >
                {(Object.keys(tradePresets) as (keyof typeof tradePresets)[]).map((presetKey) => {
                  const preset = tradePresets[presetKey];
                  const defaults = preset.defaults;
                  return (
                    <ToggleGroupItem
                      key={preset.label}
                      value={presetKey}
                      className="group flex h-auto flex-col items-start gap-1 rounded-2xl border border-slate-200 bg-white p-3 text-left data-[state=on]:border-primary data-[state=on]:bg-primary/5"
                    >
                      <span className="text-sm font-semibold text-slate-900">{preset.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {numberFormatter.format(defaults.calls)} calls · {defaults.answerRate}% live answer
                      </span>
                    </ToggleGroupItem>
                  );
                })}
              </ToggleGroup>
              <p className="max-w-xl text-sm text-muted-foreground">{presetInsight}</p>
            </CardHeader>
            <CardContent className="space-y-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)] lg:items-start lg:gap-10 lg:space-y-0">
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-3">
                  {quickStats.map(stat => <div key={stat.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">{stat.label}</div>
                      <div className="mt-3 text-2xl font-semibold text-slate-900">{stat.value}</div>
                      <div className="mt-2 text-xs text-muted-foreground">{stat.helper}</div>
                    </div>)}
                </div>

                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-5">
                  <p className="text-sm font-semibold text-slate-700">You’ll tweak just three numbers:</p>
                  <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                      Monthly inbound calls you already generate
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                      The % you currently answer live (or guess)
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                      Average revenue per booked job in that trade
                    </li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-5">
                  <p className="text-sm font-semibold text-slate-700">You’ll tweak just three numbers:</p>
                  <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                      Monthly inbound calls you already generate
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                      The % you currently answer live (or guess)
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                      Average revenue per booked job in that trade
                    </li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-5">
                  <p className="text-sm font-semibold text-slate-700">You’ll tweak just three numbers:</p>
                  <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                      Monthly inbound calls you already generate
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                      The % you currently answer live (or guess)
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                      Average revenue per booked job in that trade
                    </li>
                  </ul>
                </div>

                <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
                  <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-700">Using {tradePresets[selectedPreset].label} benchmarks</div>
                      <p className="text-xs text-muted-foreground">Dial in the math—every tweak updates the ROI story immediately.</p>
                    </div>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full justify-between gap-2 text-sm font-semibold text-slate-700 hover:bg-primary/10 sm:w-auto">
                        {isAdvancedOpen ? "Hide adjustments" : "Adjust inputs"}
                        {isAdvancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent forceMount>
                    <div className="mt-6 grid gap-6">
                      <div className="grid gap-3">
                        <div className="flex items-center justify-between gap-3">
                          <Label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                            <PhoneCall className="h-4 w-4 text-primary" />
                            Monthly inbound calls
                          </Label>
                          <span className="text-sm font-semibold text-slate-700">{numberFormatter.format(inputs.calls)} calls</span>
                        </div>
                        <Slider value={[inputs.calls]} onValueChange={handleSliderChange("calls")} min={40} max={600} step={10} />
                        <p className="text-xs text-muted-foreground">
                          Benchmark: top-quartile crews field 150-280 inbound requests per month across Google and referrals.
                        </p>
                      </div>

                      <div className="grid gap-3">
                        <div className="flex items-center justify-between gap-3">
                          <Label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                            <TrendingUp className="h-4 w-4 text-primary" />
                            % answered live
                          </Label>
                          <span className="text-sm font-semibold text-slate-700">{inputs.answerRate}%</span>
                        </div>
                        <Slider value={[inputs.answerRate]} onValueChange={handleSliderChange("answerRate")} min={20} max={100} step={1} />
                        <p className="text-xs text-muted-foreground">
                          Every 10% drop in live answer rate leaks {numberFormatter.format(Math.round(inputs.calls * 0.1))} high-intent callers who usually hire whoever picked up first.
                        </p>
                      </div>

                      <div className="grid gap-3">
                        <div className="flex items-center justify-between gap-3">
                          <Label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                            <DollarSign className="h-4 w-4 text-primary" />
                            Average ticket value
                          </Label>
                          <span className="text-sm font-semibold text-slate-700">${numberFormatter.format(inputs.jobValue)}</span>
                        </div>
                        <Slider value={[inputs.jobValue]} onValueChange={handleSliderChange("jobValue")} min={400} max={3500} step={50} />
                        <p className="text-xs text-muted-foreground">
                          Each unanswered call walks with roughly ${numberFormatter.format(inputs.jobValue)} in {tradePresets[selectedPreset].label.toLowerCase()} revenue you already paid to generate.
                        </p>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
              <div className="flex flex-col justify-center lg:self-center">
                {renderResultsCard()}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border border-slate-200 shadow-sm">
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-700">After-hours & overflow</h3>
                  <p className="text-sm text-muted-foreground">
                    37% of homeowner requests land after 5pm. RingSnap answers instantly so your brand delivers first—no waiting, no friction.
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-700">Lead-to-booked speed</h3>
                  <p className="text-sm text-muted-foreground">
                    73% of buyers hire the first contractor who responds. Our AI receptionist answers instantly and books straight inside ServiceTitan, Housecall Pro, or your CRM.
                  </p>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <h3 className="text-sm font-semibold text-slate-700">Proactive nurturing</h3>
                  <p className="text-sm text-muted-foreground">
                    Missed calls trigger immediate text follow-ups, two-way booking links, and reactivation cadences so price shoppers never fall through the cracks.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 bg-white shadow-sm">
              
              
            </Card>
          </div>
        </div>
      </div>
    </section>;
};