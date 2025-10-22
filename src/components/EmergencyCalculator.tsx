import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DollarSign, TrendingUp, Calendar, AlertTriangle } from "lucide-react";
import { EmailCaptureModal } from "./EmailCaptureModal";

export const EmergencyCalculator = () => {
  const [trade, setTrade] = useState("plumbing");
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

  const tradeDefaults: Record<string, { value: number; label: string }> = {
    plumbing: { value: 1200, label: "Plumbing (Emergency Repairs)" },
    hvac: { value: 1500, label: "HVAC (System Failures)" },
    electrical: { value: 1100, label: "Electrical (Power Outages)" },
    roofing: { value: 2000, label: "Roofing (Storm Damage)" },
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

          <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {/* Calculator Inputs */}
            <Card>
              <CardHeader>
                <CardTitle>Calculate Your Lost Revenue</CardTitle>
                <CardDescription>See exactly how much you're leaving on the table</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Trade Selection */}
                <div className="space-y-2">
                  <Label>Your Trade</Label>
                  <Select value={trade} onValueChange={(value) => {
                    setTrade(value);
                    setAvgValue([tradeDefaults[value].value]);
                  }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(tradeDefaults).map(([key, { label }]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
              </CardContent>
            </Card>

            {/* Results */}
            <Card className="border-2 border-primary">
              <CardHeader>
                <CardTitle className="text-2xl">Your Recovery Potential</CardTitle>
                <CardDescription>With 95% AI capture rate</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Lost Revenue */}
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-destructive" />
                      <span className="font-medium">Currently Losing</span>
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-destructive">
                    ${lostRevenue.toLocaleString()}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {missedCalls} missed emergency calls/month
                  </p>
                </div>

                {/* Revenue Recovered */}
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-primary" />
                      <span className="font-medium">Revenue Recovered</span>
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-primary">
                    ${recoveredRevenue.toLocaleString()}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    95% of emergency calls captured
                  </p>
                </div>

                {/* Net Monthly Gain */}
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm text-muted-foreground">AI Cost (recommended plan)</span>
                    <span className="font-semibold">${aiCost}/month</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="font-medium">Net Monthly Gain</span>
                    <span className="text-2xl font-bold text-primary">${netGain.toLocaleString()}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-primary" />
                      <div>
                        <div className="text-2xl font-bold">{roi}%</div>
                        <div className="text-xs text-muted-foreground">ROI</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" />
                      <div>
                        <div className="text-2xl font-bold">{paybackDays}</div>
                        <div className="text-xs text-muted-foreground">Days to payback</div>
                      </div>
                    </div>
                  </div>
                </div>

                <Button className="w-full h-12 text-lg" onClick={() => setShowEmailModal(true)}>
                  Get Your Personalized Recovery Plan
                </Button>
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
