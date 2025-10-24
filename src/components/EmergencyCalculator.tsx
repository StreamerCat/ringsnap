import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { DollarSign, TrendingUp, Calendar, AlertTriangle, Wrench, Snowflake, Zap, Home, ArrowRight } from "lucide-react";
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
      <section id="calculator" className="section-spacer bg-gradient-to-b from-white to-gray-50">
        <div className="container mx-auto px-4 max-w-7xl">
          <hr className="section-divider mb-8 sm:mb-12" />
          {/* Problem Statement */}
          <div className="max-w-4xl mx-auto text-center mb-8 sm:mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4 sm:mb-6">
              <AlertTriangle className="w-4 h-4 text-primary" />
              <span className="text-xs sm:text-sm font-medium">Every Missed Emergency Call = Lost Revenue</span>
            </div>
            <div className="w-10 h-1 bg-primary mx-auto mb-4 rounded-full"></div>
            <h2 className="text-h2 mb-4">How Much Are You Losing Right Now?</h2>
            <p className="text-body-default">
              30-40% of calls go unanswered when you're under a sink, on a ladder, or your hands are dirty. Emergency calls are worth 3-5x more than regular jobs.
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            <Card className="card-tier-1">
              <CardHeader>
                <CardTitle className="text-5xl text-center text-metric font-bold animate-count-up" style={{ color: 'hsl(var(--charcoal))' }}>
                  ${recoveredRevenue.toLocaleString()}
                </CardTitle>
                <CardDescription className="text-center text-base sm:text-lg">
                  Recovered revenue per month
                </CardDescription>
                <p className="text-center text-xs sm:text-sm text-slate-600 mt-2">
                  Select your trade and adjust the numbers below
                </p>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Niche Selector Pills */}
                <div className="space-y-3">
                  <Label className="text-sm sm:text-base">Your Trade</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                    {(Object.entries(tradeDefaults) as [TradeType, typeof tradeDefaults[TradeType]][]).map(([key, { label, icon: Icon }]) => (
                      <button
                        key={key}
                        className={`h-auto min-h-[48px] py-3 sm:py-4 flex flex-col items-center gap-2 transition-all duration-200 rounded-md font-medium ${
                          trade === key 
                            ? "bg-primary text-white border-0 hover:scale-105" 
                            : "bg-cream border text-charcoal hover:bg-gradient-to-br hover:from-cream hover:to-white hover:-translate-y-1"
                        }`}
                        style={trade !== key ? { borderColor: 'hsl(var(--charcoal) / 0.3)', color: 'hsl(var(--charcoal))' } : {}}
                        onClick={() => handleNicheSelect(key)}
                      >
                        <Icon className="w-4 sm:w-5 h-4 sm:h-5" />
                        <span className="text-xs sm:text-sm font-semibold">{label}</span>
                      </button>
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
                  <div className="flex justify-between items-center">
                    <Label className="text-sm">Emergency Calls Per Week</Label>
                    <span className="text-sm font-bold text-metric">{emergencyCalls[0]} calls</span>
                  </div>
                  <input 
                    type="tel" 
                    inputMode="numeric"
                    value={emergencyCalls[0]} 
                    onChange={(e) => setEmergencyCalls([Math.max(5, Math.min(50, Number(e.target.value) || 5))])}
                    className="sm:hidden w-full h-12 px-4 rounded-md border border-input text-center text-lg font-bold input-focus"
                  />
                  <Slider value={emergencyCalls} onValueChange={setEmergencyCalls} min={5} max={50} step={1} className="hidden sm:block input-focus" />
                  <p className="text-xs text-muted-foreground">{monthlyEmergencyCalls} emergency calls/month</p>
                </div>

                {/* Missed Percentage */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm">Currently Missed (%)</Label>
                    <span className="text-sm font-bold text-metric">{missedPercent[0]}%</span>
                  </div>
                  <input 
                    type="tel" 
                    inputMode="numeric"
                    value={missedPercent[0]} 
                    onChange={(e) => setMissedPercent([Math.max(20, Math.min(70, Number(e.target.value) || 40))])}
                    className="sm:hidden w-full h-12 px-4 rounded-md border border-input text-center text-lg font-bold input-focus"
                  />
                  <Slider value={missedPercent} onValueChange={setMissedPercent} min={20} max={70} step={5} className="hidden sm:block input-focus" />
                  <p className="text-xs text-muted-foreground">Industry average: 35-40%</p>
                </div>

                {/* Average Job Value */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm">Average Emergency Job Value</Label>
                    <span className="text-sm font-bold text-metric">${avgValue[0].toLocaleString()}</span>
                  </div>
                  <input 
                    type="tel" 
                    inputMode="numeric"
                    value={avgValue[0]} 
                    onChange={(e) => setAvgValue([Math.max(400, Math.min(3000, Number(e.target.value) || 1200))])}
                    className="sm:hidden w-full h-12 px-4 rounded-md border border-input text-center text-lg font-bold input-focus"
                  />
                  <Slider value={avgValue} onValueChange={setAvgValue} min={400} max={3000} step={100} className="hidden sm:block input-focus" />
                  <p className="text-xs text-muted-foreground">Emergency jobs typically worth 3-5x more</p>
                </div>

                {/* Results Section */}
                <div className="space-y-4 sm:space-y-6 pt-6 border-t-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div className="calculator-result-card">
                      <div className="calculator-metric-label flex items-center gap-2 mb-2">
                        <DollarSign className="w-4 h-4 opacity-80" />
                        <span>Monthly gain</span>
                      </div>
                      <div className="calculator-metric-number">${netGain.toLocaleString()}</div>
                      <div className="text-xs mt-1" style={{ color: 'hsl(var(--charcoal) / 0.6)' }}>{roi}% ROI</div>
                    </div>
                    
                    <div className="calculator-result-card">
                      <div className="calculator-metric-label flex items-center gap-2 mb-2">
                        <Calendar className="w-4 h-4 opacity-80" />
                        <span>Break even</span>
                      </div>
                      <div className="calculator-metric-number">{Math.ceil(aiCost / avgValue[0])}</div>
                      <div className="text-xs mt-1" style={{ color: 'hsl(var(--charcoal) / 0.6)' }}>jobs (~{paybackDays} days)</div>
                    </div>
                    
                    <div className="calculator-result-card">
                      <div className="calculator-metric-label flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 opacity-80" />
                        <span>Captured</span>
                      </div>
                      <div className="calculator-metric-number">{missedCalls}</div>
                      <div className="text-xs mt-1" style={{ color: 'hsl(var(--charcoal) / 0.6)' }}>missed → booked</div>
                    </div>
                  </div>
                  <Button className="w-full h-12 text-lg mt-4 rounded-full bg-primary text-white btn-pulse-cta shadow-lg hover:shadow-xl transition-all duration-200" onClick={() => setShowEmailModal(true)}>
                    See How Ringsnap Helps You <ArrowRight className="w-5 h-5 ml-1 inline-block" />
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
