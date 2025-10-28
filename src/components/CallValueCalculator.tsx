import { FormEvent, useMemo, useReducer, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DollarSign, TrendingUp, AlertTriangle, PhoneCall, ArrowRight, Sparkles } from "lucide-react";

type CalculatorState = {
  calls: number;
  answerRate: number;
  jobValue: number;
};

type CalculatorAction =
  | { type: "update"; field: keyof CalculatorState; value: number }
  | { type: "applyPreset"; preset: keyof typeof tradePresets };

const calculatorReducer = (state: CalculatorState, action: CalculatorAction): CalculatorState => {
  switch (action.type) {
    case "update":
      return { ...state, [action.field]: action.value };
    case "applyPreset":
      return { ...tradePresets[action.preset].defaults };
    default:
      return state;
  }
};

const tradePresets = {
  plumbing: {
    label: "Plumber",
    defaults: { calls: 210, answerRate: 54, jobValue: 975 },
    insight:
      "Burst pipe callers hire the first plumber who answers—Google's data shows a 3× close rate over web forms.",
  },
  hvac: {
    label: "HVAC",
    defaults: { calls: 260, answerRate: 58, jobValue: 1450 },
    insight:
      "Peak-season HVAC installs average $1,450 and 68% of searchers convert by phone within 30 minutes.",
  },
  roofing: {
    label: "Roofing",
    defaults: { calls: 140, answerRate: 62, jobValue: 2400 },
    insight:
      "Insurance-driven roof replacements close near $2,400 when the first responder picks up immediately.",
  },
  electrical: {
    label: "Electrical",
    defaults: { calls: 180, answerRate: 49, jobValue: 1250 },
    insight:
      "Code-compliance emergencies average $1,250 and two in five callers abandon if it goes to voicemail.",
  },
} satisfies Record<string, { label: string; defaults: CalculatorState; insight: string }>;

export const CallValueCalculator = () => {
  const [selectedPreset, setSelectedPreset] = useState<keyof typeof tradePresets | null>("plumbing");
  const [email, setEmail] = useState("");
  const [formState, setFormState] = useState<"idle" | "submitted">("idle");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const initialState = selectedPreset ? tradePresets[selectedPreset].defaults : { calls: 160, answerRate: 55, jobValue: 1200 };
  const [inputs, dispatch] = useReducer(calculatorReducer, initialState);

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
      paybackDays,
    };
  }, [inputs]);

  const presetInsight = selectedPreset ? tradePresets[selectedPreset].insight : "Home services teams miss 38-62% of inbound calls.";

  const handlePresetClick = (presetKey: keyof typeof tradePresets) => {
    setSelectedPreset(presetKey);
    dispatch({ type: "applyPreset", preset: presetKey });
    setIsAdvancedOpen(false);
  };

  const handleSliderChange = (field: keyof CalculatorState) => (value: number[]) => {
    dispatch({ type: "update", field, value: value[0] });
  };

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormState("submitted");
  };

  return (
    <>
      <section id="calculator" className="section-spacer bg-gradient-to-b from-white via-slate-50 to-slate-100">
        <div className="container mx-auto px-4 max-w-7xl">
          <hr className="section-divider mb-10" />

          <div className="mb-12 max-w-3xl">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm uppercase tracking-[0.18em]">
              <Sparkles className="h-4 w-4" /> ROI Playbook
            </div>
            <h2 className="text-h2 mt-4 mb-3 leading-tight">
              Stop leaking booked jobs—convert 95% of missed calls automatically.
            </h2>
            <p className="text-body-default text-muted-foreground max-w-2xl">
              Google Local Services data shows 65% of home service buyers still dial a number and most hire whoever answers first. Yet the average crew lets 38% of those calls hit voicemail. Plug in your numbers to see the upside RingSnap unlocks, then grab the follow-up scripts we email top performers.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-6">
              <Card className="card-tier-1 border border-slate-200 shadow-sm">
                <CardHeader className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="secondary" className="bg-primary/10 text-primary border border-primary/10">
                      60-second ROI snapshot
                    </Badge>
                    <span>Pick the trade that mirrors your ticket mix to load proven benchmarks.</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(tradePresets) as (keyof typeof tradePresets)[]).map((presetKey) => {
                      const preset = tradePresets[presetKey];
                      const isActive = selectedPreset === presetKey;
                      return (
                        <Button
                          key={preset.label}
                          type="button"
                          variant={isActive ? "default" : "outline"}
                          size="sm"
                          className={`rounded-full ${isActive ? "bg-primary text-white" : "bg-white"}`}
                          onClick={() => handlePresetClick(presetKey)}
                        >
                          {preset.label}
                        </Button>
                      );
                    })}
                  </div>
                  <p className="text-sm text-muted-foreground max-w-xl">
                    {presetInsight}
                  </p>
                  <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
                    <div className="flex items-center justify-between rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-sm">
                        <div className="font-semibold text-slate-700">Using {selectedPreset ? tradePresets[selectedPreset].label : "benchmarks"}</div>
                        <p className="text-xs text-muted-foreground">Dial in the math—every tweak updates the ROI story immediately.</p>
                      </div>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="hover:bg-primary/10">
                          {isAdvancedOpen ? "Hide adjustments" : "Adjust inputs"}
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent forceMount>
                      <CardContent className="mt-6 grid gap-6">
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
                            Each unanswered call walks with roughly ${numberFormatter.format(inputs.jobValue)} in {selectedPreset ? tradePresets[selectedPreset].label.toLowerCase() : "service"} revenue you already paid to generate.
                          </p>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-3">
                  {[{
                    label: "Answered now",
                    value: `${numberFormatter.format(metrics.answeredCalls)} calls`,
                    helper: "Live conversations you already handle",
                  }, {
                    label: "Missed monthly",
                    value: `${numberFormatter.format(metrics.missedCalls)} calls`,
                    helper: "High-intent leads leaking today",
                  }, {
                    label: "Value per call",
                    value: `$${numberFormatter.format(inputs.jobValue)}`,
                    helper: "Average booked revenue on the line",
                  }].map((stat) => (
                    <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{stat.label}</div>
                      <div className="mt-2 text-lg font-semibold text-slate-900">{stat.value}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{stat.helper}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border border-slate-200 shadow-sm">
                <CardHeader className="space-y-2">
                  <CardTitle className="text-xl font-semibold">Why these levers close more jobs</CardTitle>
                  <CardDescription>
                    The Hormozi value equation is simple: increase dream outcome, slash time delay, remove effort. Each lever drives one of those factors.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700">After-hours & overflow</h3>
                    <p className="text-sm text-muted-foreground">
                      37% of homeowner requests land after 5pm. RingSnap answers instantly so your brand delivers first—no waiting, no friction.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700">Lead-to-booked speed</h3>
                    <p className="text-sm text-muted-foreground">
                      73% of buyers hire the first contractor who responds. Our AI receptionist answers instantly and books straight inside ServiceTitan, Housecall Pro, or your CRM.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700">Proactive nurturing</h3>
                    <p className="text-sm text-muted-foreground">
                      Missed calls trigger immediate text follow-ups, two-way booking links, and reactivation cadences so price shoppers never fall through the cracks.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="relative overflow-hidden border-none bg-slate-900 text-white shadow-2xl lg:sticky lg:top-20">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/80 via-primary to-emerald-500 opacity-80" />
              <div className="absolute inset-0 mix-blend-soft-light" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.25), transparent 55%)" }} />
              <CardHeader className="relative space-y-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/70">
                  <AlertTriangle className="h-4 w-4" /> Hidden revenue leak
                </div>
                <CardTitle className="text-4xl font-bold">
                  ${numberFormatter.format(metrics.recoveredRevenue)} <span className="text-lg font-medium text-white/80">recaptured monthly</span>
                </CardTitle>
                <CardDescription className="text-white/80">
                  Based on {numberFormatter.format(metrics.missedCalls)} missed calls you can convert with RingSnap&apos;s AI receptionist.
                </CardDescription>
              </CardHeader>
              <CardContent className="relative space-y-8">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <div className="text-xs uppercase tracking-wide text-white/60">Net new profit</div>
                    <div className="mt-2 text-2xl font-semibold">${numberFormatter.format(metrics.netGain)}</div>
                    <div className="mt-1 text-xs text-white/60">ROI: {metrics.roi}%</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <div className="text-xs uppercase tracking-wide text-white/60">Break-even</div>
                    <div className="mt-2 text-2xl font-semibold">{metrics.paybackDays} days</div>
                    <div className="mt-1 text-xs text-white/60">≈ {Math.max(1, Math.ceil(metrics.aiCost / Math.max(inputs.jobValue, 1)))} booked jobs</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <div className="text-xs uppercase tracking-wide text-white/60">AI receptionist plan</div>
                    <div className="mt-2 text-2xl font-semibold">${numberFormatter.format(metrics.aiCost)}/mo</div>
                    <div className="mt-1 text-xs text-white/60">Locks in 24/7 coverage</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <div className="text-xs uppercase tracking-wide text-white/60">Calls saved</div>
                    <div className="mt-2 text-2xl font-semibold">{numberFormatter.format(metrics.recoveredCallCapture)}</div>
                    <div className="mt-1 text-xs text-white/60">/{numberFormatter.format(metrics.monthlyCalls)} total calls</div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur">
                  <p className="text-sm font-semibold text-white">“RingSnap plugged the $38k/mo hole in our call queue and let us scale without hiring.”</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.2em] text-white/60">Bryan • Owner, Precision Plumbing</p>
                </div>

                <form className="space-y-4" onSubmit={handleFormSubmit}>
                  <div className="space-y-2">
                    <Label htmlFor="roi-email" className="text-xs uppercase tracking-[0.2em] text-white/70">
                      Send the full ROI teardown to my inbox
                    </Label>
                    <Input
                      id="roi-email"
                      type="email"
                      required
                      placeholder="you@company.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="h-12 rounded-full border-white/40 bg-white/20 text-white placeholder:text-white/60 focus-visible:ring-white"
                    />
                  </div>
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full rounded-full bg-white text-slate-900 hover:bg-white/90"
                  >
                    Email me this ROI report <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                  {formState === "submitted" ? (
                    <p className="text-xs text-white/70">
                      Thanks! We&apos;ll send the call scripts, follow-up cadences, and ROI math our top contractors use to close hot leads.
                    </p>
                  ) : (
                    <p className="text-xs text-white/60">
                      No spam—just the proof you need to justify AI coverage to owners and ops leads.
                    </p>
                  )}
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </>
  );
};