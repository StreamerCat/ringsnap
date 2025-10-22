import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { DollarSign, TrendingUp, Calendar, AlertTriangle, Wrench, Snowflake, Zap, Home } from "lucide-react";
import { EmailCaptureModal } from "./EmailCaptureModal";

type TradeType = "plumbing" | "hvac" | "electrical" | "roofing";

export const EmergencyCalculator = () => {
  const [trade, setTrade] = useState<TradeType>("plumbing");
  const [emergencyCalls, setEmergencyCalls] = useState([15]);
  const [missedPercent, setMissedPercent] = useState([40]);
  const [avgValue, setAvgValue] = useState([1200]);
  const [showEmailModal, setShowEmailModal] = useState(false);

  // Calculations
  const monthlyEmergencyCalls = emergencyCalls[0] * 4;
  const missedCalls = Math.round(monthlyEmergencyCalls * (missedPercent[0] / 100));
  const lostRevenue = missedCalls * avgValue[0];
  const recoveredRevenue = Math.round(lostRevenue * 0.95); // 95% capture rate
  const aiCost = emergencyCalls[0] <= 20 ? 297 : emergencyCalls[0] <= 40 ? 797 : 1497;
  const netGain = recoveredRevenue - aiCost;
  const roi = Math.round((netGain / aiCost) * 100);
  const paybackDays = Math.round((aiCost / recoveredRevenue) * 30);

  const tradeDefaults: Record<TradeType, { value: number; calls: number; missedRate: number; label: string; icon: any }> = {
    plumbing: { value: 1200, calls: 60, missedRate: 38, label: "Plumber", icon: Wrench },
    hvac: { value: 1500, calls: 55, missedRate: 42, label: "HVAC", icon: Snowflake },
    electrical: { value: 1100, calls: 50, missedRate: 35, label: "Electrician", icon: Zap },
    roofing: { value: 2000, calls: 40, missedRate: 45, label: "Roofer", icon: Home },
  };

  const handleNicheSelect = (niche: TradeType) => {
    setTrade(niche);
    const defaults = tradeDefaults[niche];
    setAvgValue([defaults.value]);
    setEmergencyCalls([Math.round(defaults.calls / 4)]);
    setMissedPercent([defaults.missedRate]);
  };

  return (
    <>
      <section id="calculator" className="py-20 bg-gradient-to-b from-white to-gray-50">
        <div className="container mx-auto px-4 max-w-7xl">
          {/* Problem Statement */}
          <div className="max-w-4xl mx-auto text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-destructive/10 border border-destructive/20 mb-6">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <span className="text-sm font-medium">Every Missed Emergency Call = Lost Revenue</span>
            </div>
            <h2 className="text-4xl font-bold mb-4">How Much Are You Losing Right Now?</h2>
            <p className="text-xl text-muted-foreground">
              30-40% of calls go unanswered when you're under a sink, on a ladder, or your hands are dirty. Emergency calls are worth 3-5x more than regular jobs.
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            <Card className="border-2 border-emerald-500 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)]">
              <CardHeader>
                <CardTitle className="text-5xl text-center tabular-nums text-emerald-600">
                  ${recoveredRevenue.toLocaleString()}
                </CardTitle>
                <CardDescription className="text-center text-lg">
                  Recovered revenue per month
                </CardDescription>
                <p className="text-center text-sm text-slate-600 mt-2">
                  Select your trade and adjust the numbers below
                </p>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Niche Selector Pills */}
                <div className="space-y-3">
                  <Label className="text-base">Your Trade</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {(Object.entries(tradeDefaults) as [TradeType, typeof tradeDefaults[TradeType]][]).map(([key, { label, icon: Icon }]) => (
                      <Button
                        key={key}
                        variant={trade === key ? "default" : "outline"}
                        className="h-auto py-4 flex flex-col items-center gap-2 hover:-translate-y-0.5 transition-transform duration-200"
                        onClick={() => handleNicheSelect(key)}
                      >
                        <Icon className="w-5 h-5 opacity-80 hover:opacity-100 transition-opacity" />
                        <span className="text-sm font-semibold">{label}</span>
                      </Button>
                    ))}
                  </div>
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="w-full text-xs"
                    onClick={() => handleNicheSelect(trade)}
                  >
                    Use {tradeDefaults[trade].label} defaults
                  </Button>
                </div>

                {/* Emergency Calls Per Week */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Emergency Calls Per Week</Label>
                    <span className="text-sm font-bold">{emergencyCalls[0]} calls</span>
                  </div>
                  <Slider value={emergencyCalls} onValueChange={setEmergencyCalls} min={5} max={50} step={1} />
                  <p className="text-xs text-muted-foreground">{monthlyEmergencyCalls} emergency calls/month</p>
                </div>

                {/* Missed Percentage */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Currently Missed (%)</Label>
                    <span className="text-sm font-bold">{missedPercent[0]}%</span>
                  </div>
                  <Slider value={missedPercent} onValueChange={setMissedPercent} min={20} max={70} step={5} />
                  <p className="text-xs text-muted-foreground">Industry average: 35-40%</p>
                </div>

                {/* Average Job Value */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Average Emergency Job Value</Label>
                    <span className="text-sm font-bold">${avgValue[0].toLocaleString()}</span>
                  </div>
                  <Slider value={avgValue} onValueChange={setAvgValue} min={400} max={3000} step={100} />
                  <p className="text-xs text-muted-foreground">Emergency jobs typically worth 3-5x more</p>
                </div>

                {/* Results Section */}
                <div className="space-y-6 pt-6 border-t-2">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-5 rounded-2xl bg-white border shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
                        <DollarSign className="w-4 h-4 opacity-80" />
                        <span>Monthly gain</span>
                      </div>
                      <div className="text-3xl font-bold tabular-nums">${netGain.toLocaleString()}</div>
                      <div className="text-xs text-slate-500 mt-1">{roi}% ROI</div>
                    </div>
                    
                    <div className="p-5 rounded-2xl bg-white border shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
                        <Calendar className="w-4 h-4 opacity-80" />
                        <span>Break even</span>
                      </div>
                      <div className="text-3xl font-bold tabular-nums">{Math.ceil(aiCost / avgValue[0])}</div>
                      <div className="text-xs text-slate-500 mt-1">jobs (~{paybackDays} days)</div>
                    </div>
                    
                    <div className="p-5 rounded-2xl bg-white border shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
                        <TrendingUp className="w-4 h-4 opacity-80" />
                        <span>Captured</span>
                      </div>
                      <div className="text-3xl font-bold tabular-nums">{missedCalls}</div>
                      <div className="text-xs text-slate-500 mt-1">missed → booked</div>
                    </div>
                  </div>
                  <Button className="w-full h-12 text-lg mt-4 shadow-lg hover:shadow-emerald-500/20 transition-all duration-200" onClick={() => setShowEmailModal(true)}>
                    Get Your Personalized Recovery Plan
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <EmailCaptureModal 
        open={showEmailModal} 
        onOpenChange={setShowEmailModal}
        calculatorData={{
          trade,
          emergencyCalls: emergencyCalls[0],
          lostRevenue,
          recoveredRevenue,
          netGain,
          roi,
          paybackDays
        }}
      />
    </>
  );
};
