import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { DollarSign, TrendingUp, Calendar, AlertTriangle, PhoneCall, ArrowRight } from "lucide-react";

export const CallValueCalculator = () => {
  const [customerCalls, setCustomerCalls] = useState([100]);
  const [missedPercent, setMissedPercent] = useState([40]);
  const [avgValue, setAvgValue] = useState([1200]);

  // Calculations
  const monthlyCalls = customerCalls[0];
  const missedCalls = Math.round(monthlyCalls * (1 - missedPercent[0] / 100));
  const lostRevenue = missedCalls * avgValue[0];
  const recoveredRevenue = Math.round(lostRevenue * 0.95); // 95% capture rate
  const aiCost = customerCalls[0] <= 20 ? 297 : customerCalls[0] <= 40 ? 797 : 1497;
  const netGain = recoveredRevenue - aiCost;
  const roi = Math.round((netGain / aiCost) * 100);
  const paybackDays = Math.round((aiCost / recoveredRevenue) * 30);

  return (
    <>
      <section id="calculator" className="section-spacer bg-gradient-to-b from-white to-gray-50">
        <div className="container mx-auto px-4 max-w-7xl">
          <hr className="section-divider mb-8 sm:mb-12" />
          {/* Problem Statement */}
          <div className="max-w-4xl mx-auto text-center mb-8 sm:mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4 sm:mb-6">
              <AlertTriangle className="w-4 h-4 text-primary" />
              <span className="text-xs sm:text-sm font-medium">Every Missed Call = Lost Revenue</span>
            </div>
            <div className="w-10 h-1 bg-primary mx-auto mb-4 rounded-full"></div>
            <h2 className="text-h2 mb-4">See Your Actual Missed Revenue</h2>
            <p className="text-body-default mb-4">
              Every missed call—whether it's a burst pipe at 2am or a quote request at 2pm—is potential revenue walking to your competitors.
            </p>
            <p className="text-body-default text-sm">
              Emergencies, quotes, scheduling, follow-ups—every customer call is an opportunity. Here's what you're losing:
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            <Card className="card-tier-1">
              <CardHeader className="text-center space-y-3 pb-6">
                <div className="text-sm text-muted-foreground uppercase tracking-wide font-semibold">
                  You're Losing
                </div>
                <CardTitle className="text-5xl sm:text-6xl lg:text-7xl font-bold text-red-600 animate-count-up">
                  ${lostRevenue.toLocaleString()}/Month
                </CardTitle>
                <CardDescription className="text-2xl sm:text-3xl font-semibold" style={{ color: 'hsl(var(--charcoal) / 0.7)' }}>
                  That's ${(lostRevenue * 12).toLocaleString()}/Year in Revenue
                </CardDescription>
                <p className="text-base text-muted-foreground pt-4 max-w-2xl mx-auto">
                  With RingSnap, capture an extra <span className="font-bold text-primary">{Math.round(missedCalls * 0.7)} appointments/month</span> worth <span className="font-bold text-primary">${Math.round(missedCalls * 0.7 * avgValue[0]).toLocaleString()}</span>
                </p>
              </CardHeader>
              <CardContent className="space-y-8">

                {/* Customer Calls Per Month */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm flex items-center gap-1.5">
                      <PhoneCall className="w-4 h-4 inline opacity-70" />
                      Calls received per month
                    </Label>
                    <span className="text-sm font-bold text-metric">{customerCalls[0]} calls</span>
                  </div>
                  <input 
                    type="tel" 
                    inputMode="numeric"
                    value={customerCalls[0]} 
                    onChange={(e) => setCustomerCalls([Math.max(20, Math.min(600, Number(e.target.value) || 100))])}
                    className="sm:hidden w-full h-12 px-4 rounded-md border border-input text-center text-lg font-bold input-focus"
                  />
                  <Slider value={customerCalls} onValueChange={setCustomerCalls} min={20} max={600} step={10} className="hidden sm:block input-focus" />
                  <p className="text-xs text-muted-foreground">Average home service contractor: 80-300 calls/month</p>
                </div>

                {/* Answer Percentage */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 inline opacity-70" />
                      % of calls you currently answer
                    </Label>
                    <span className="text-sm font-bold text-metric">{missedPercent[0]}%</span>
                  </div>
                  <input 
                    type="tel" 
                    inputMode="numeric"
                    value={missedPercent[0]} 
                    onChange={(e) => setMissedPercent([Math.max(0, Math.min(100, Number(e.target.value) || 40))])}
                    className="sm:hidden w-full h-12 px-4 rounded-md border border-input text-center text-lg font-bold input-focus"
                  />
                  <Slider value={missedPercent} onValueChange={setMissedPercent} min={0} max={100} step={5} className="hidden sm:block input-focus" />
                  <p className="text-xs text-muted-foreground">Industry average: 38-62% answered</p>
                </div>

                {/* Average Job Value */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 inline opacity-70" />
                      Average job value
                    </Label>
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
                  <p className="text-xs text-muted-foreground">Includes all call types: emergencies, quotes, scheduling</p>
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
                      <div className="text-xs mt-1" style={{ color: 'hsl(var(--charcoal) / 0.6)' }}>calls you're missing each month</div>
                    </div>
                  </div>
                  <p className="text-xs text-center text-muted-foreground mt-4 px-4">
                    This includes 24/7 emergencies, daytime quotes, appointment requests, and follow-up calls—everything your customers call about.
                  </p>
                  <Button 
                    className="w-full h-12 text-lg mt-4 rounded-full bg-primary text-white btn-pulse-cta shadow-lg hover:shadow-xl transition-all duration-200" 
                    onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    See Your ROI <ArrowRight className="w-5 h-5 ml-1 inline-block" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </>
  );
};