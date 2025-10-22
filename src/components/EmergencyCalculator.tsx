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
      <section id="calculator" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
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
            <Card className="border-2 border-primary">
              <CardHeader>
                <CardTitle className="text-3xl text-center">You could recover ${recoveredRevenue.toLocaleString()}/month</CardTitle>
                <CardDescription className="text-center text-base">Select your trade and adjust the numbers below</CardDescription>
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
                        className="h-auto py-4 flex flex-col items-center gap-2"
                        onClick={() => handleNicheSelect(key)}
                      >
                        <Icon className="w-5 h-5" />
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
                <div className="space-y-6 pt-6 border-t-2">`
                  <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground font-medium">💰 Recovered revenue per month</p>
                    <p className="text-5xl font-bold text-primary">${recoveredRevenue.toLocaleString()}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 rounded-lg bg-muted">
                      <p className="text-sm text-muted-foreground mb-1">📞 Calls to break even</p>
                      <p className="text-2xl font-bold">{Math.ceil(aiCost / avgValue[0])} calls</p>
                      <p className="text-xs text-muted-foreground mt-1">~{paybackDays} days</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-muted">
                      <p className="text-sm text-muted-foreground mb-1">Net Monthly Gain</p>
                      <p className="text-2xl font-bold text-primary">${netGain.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground mt-1">{roi}% ROI</p>
                    </div>
                  </div>
                  <Button className="w-full h-12 text-lg mt-4" onClick={() => setShowEmailModal(true)}>
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
