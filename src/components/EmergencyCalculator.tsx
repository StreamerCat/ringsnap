import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { PhoneOff, DollarSign, TrendingUp, Calendar, Wrench, Snowflake, Zap, Home, ArrowRight } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EmailCaptureModal } from "./EmailCaptureModal";

type TradeType = "plumbing" | "hvac" | "electrical" | "roofing";

const tradeConfig: Record<TradeType, { calls: number; missedRate: number; jobValue: number; label: string; icon: typeof Wrench }> = {
  plumbing:   { calls: 240, missedRate: 38, jobValue: 1200, label: "Plumbing",   icon: Wrench },
  hvac:       { calls: 220, missedRate: 42, jobValue: 1500, label: "HVAC",       icon: Snowflake },
  electrical: { calls: 200, missedRate: 35, jobValue: 1100, label: "Electrical", icon: Zap },
  roofing:    { calls: 160, missedRate: 45, jobValue: 2000, label: "Roofing",    icon: Home },
};

export const EmergencyCalculator = () => {
  const [trade, setTrade] = useState<TradeType>("plumbing");
  const [monthlyCalls, setMonthlyCalls] = useState(240);
  const [missedPercent, setMissedPercent] = useState(38);
  const [avgJobValue, setAvgJobValue] = useState(1200);
  const [showEmailModal, setShowEmailModal] = useState(false);

  const handleTradeChange = (value: string) => {
    if (!value) return;
    const key = value as TradeType;
    setTrade(key);
    const defaults = tradeConfig[key];
    setMonthlyCalls(defaults.calls);
    setMissedPercent(defaults.missedRate);
    setAvgJobValue(defaults.jobValue);
  };

  const metrics = useMemo(() => {
    const missedCalls = Math.round(monthlyCalls * (missedPercent / 100));
    const lostRevenue = missedCalls * avgJobValue;
    const recoveredRevenue = Math.round(lostRevenue * 0.95);
    const aiCost = monthlyCalls <= 150 ? 59 : monthlyCalls <= 300 ? 129 : monthlyCalls <= 600 ? 229 : 449;
    const netGain = recoveredRevenue - aiCost;
    const roi = aiCost > 0 ? Math.round((netGain / aiCost) * 100) : 0;
    const paybackDays = recoveredRevenue > 0 ? Math.max(1, Math.round((aiCost / recoveredRevenue) * 30)) : 30;
    const breakEvenJobs = Math.max(1, Math.ceil(aiCost / Math.max(avgJobValue, 1)));
    return { missedCalls, lostRevenue, recoveredRevenue, aiCost, netGain, roi, paybackDays, breakEvenJobs };
  }, [monthlyCalls, missedPercent, avgJobValue]);

  const fmt = (n: number) => n.toLocaleString("en-US");

  return (
    <>
      <section id="calculator" className="py-16 sm:py-20 lg:py-24">
        <div className="container mx-auto max-w-4xl px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-12">
            <h2 className="text-headline mb-3">
              How much are missed calls costing&nbsp;you?
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              Select your trade, adjust the numbers, and see what RingSnap could recover every month.
            </p>
          </div>

          <Card className="border border-border/40 shadow-sm">
            <CardContent className="p-5 sm:p-8 space-y-8">

              {/* Trade selector */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Your trade</Label>
                <ToggleGroup
                  type="single"
                  value={trade}
                  onValueChange={handleTradeChange}
                  className="grid grid-cols-2 sm:grid-cols-4 gap-2"
                >
                  {(Object.entries(tradeConfig) as [TradeType, typeof tradeConfig[TradeType]][]).map(([key, { label, icon: Icon }]) => (
                    <ToggleGroupItem
                      key={key}
                      value={key}
                      className="flex items-center justify-center gap-2 rounded-lg border border-border/40 bg-white px-3 py-3 text-sm font-medium transition-colors data-[state=on]:border-primary data-[state=on]:bg-primary/5 data-[state=on]:text-primary hover:bg-muted/50"
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>

              {/* Sliders */}
              <div className="space-y-6">
                <SliderField
                  label="Monthly inbound calls"
                  value={monthlyCalls}
                  onChange={(v) => setMonthlyCalls(v)}
                  min={40}
                  max={600}
                  step={10}
                  display={`${fmt(monthlyCalls)} calls`}
                />
                <SliderField
                  label="Calls going unanswered"
                  value={missedPercent}
                  onChange={(v) => setMissedPercent(v)}
                  min={10}
                  max={70}
                  step={1}
                  display={`${missedPercent}%`}
                  hint={`≈ ${fmt(Math.round(monthlyCalls * missedPercent / 100))} missed calls / month`}
                />
                <SliderField
                  label="Average job value"
                  value={avgJobValue}
                  onChange={(v) => setAvgJobValue(v)}
                  min={200}
                  max={5000}
                  step={50}
                  display={`$${fmt(avgJobValue)}`}
                />
              </div>

              {/* Divider */}
              <div className="border-t border-border/30" />

              {/* Results */}
              <div className="space-y-6">
                {/* Hero metric */}
                <div className="text-center space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Recoverable revenue per month
                  </p>
                  <p className="text-4xl sm:text-5xl font-bold text-metric tracking-tight">
                    ${fmt(metrics.recoveredRevenue)}
                  </p>
                </div>

                {/* Detail grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <MetricCard icon={PhoneOff} label="Missed calls" value={fmt(metrics.missedCalls)} sub="per month" />
                  <MetricCard icon={DollarSign} label="Net gain" value={`$${fmt(metrics.netGain)}`} sub={`${fmt(metrics.roi)}% ROI`} />
                  <MetricCard icon={Calendar} label="Break even" value={`${metrics.breakEvenJobs} job${metrics.breakEvenJobs > 1 ? "s" : ""}`} sub={`~${metrics.paybackDays} days`} />
                  <MetricCard icon={TrendingUp} label="Revenue lost" value={`$${fmt(metrics.lostRevenue)}`} sub="without RingSnap" muted />
                </div>

                {/* CTA */}
                <Button
                  size="lg"
                  className="w-full h-12 text-base"
                  onClick={() => setShowEmailModal(true)}
                >
                  Get your recovery plan
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>

            </CardContent>
          </Card>
        </div>
      </section>

      <EmailCaptureModal
        open={showEmailModal}
        onOpenChange={setShowEmailModal}
        calculatorData={{
          trade,
          customerCalls: monthlyCalls,
          lostRevenue: metrics.lostRevenue,
          recoveredRevenue: metrics.recoveredRevenue,
          netGain: metrics.netGain,
          roi: metrics.roi,
          paybackDays: metrics.paybackDays,
        }}
      />
    </>
  );
};

function SliderField({ label, value, onChange, min, max, step, display, hint }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  display: string;
  hint?: string;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm font-semibold">{label}</Label>
        <span className="text-sm font-semibold text-metric tabular-nums">{display}</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
        min={min}
        max={max}
        step={step}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, sub, muted }: {
  icon: typeof PhoneOff;
  label: string;
  value: string;
  sub: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/30 bg-muted/30 p-3.5">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      </div>
      <p className={`text-lg font-bold text-metric leading-tight ${muted ? "text-destructive/80" : ""}`}>
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}
