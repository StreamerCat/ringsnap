import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Phone, ClipboardList, MessageSquare, Calendar, TrendingUp, AlertTriangle, DollarSign, UserCheck } from "lucide-react";
type Scenario = "emergency" | "price-shopper" | "repeat-customer";
type Step = 1 | 2 | 3 | 4 | 5;
const STEPS = [{
  id: 1 as Step,
  title: "Answer fast",
  description: "Under 2 rings, 24/7",
  icon: Phone
}, {
  id: 2 as Step,
  title: "Qualify",
  description: "Job type, urgency, location, budget fit",
  icon: ClipboardList
}, {
  id: 3 as Step,
  title: "Handle objections",
  description: "Pricing, timing, comparisons, trust questions",
  icon: MessageSquare
}, {
  id: 4 as Step,
  title: "Book or hand off",
  description: "Appointment booked or clean transfer with notes",
  icon: Calendar
}, {
  id: 5 as Step,
  title: "Improve automatically",
  description: "Uses outcomes and patterns to refine talk tracks and routing",
  icon: TrendingUp
}];
const SCENARIOS: Record<Scenario, {
  label: string;
  icon: React.ElementType;
}> = {
  "emergency": {
    label: "Emergency",
    icon: AlertTriangle
  },
  "price-shopper": {
    label: "Price Shopper",
    icon: DollarSign
  },
  "repeat-customer": {
    label: "Repeat Customer",
    icon: UserCheck
  }
};
const SCENARIO_SNIPPETS: Record<Scenario, Record<Step, string>> = {
  "emergency": {
    1: "Thanks for calling. Is anyone in danger right now?",
    2: "Where are you located and what's happening?",
    3: "Here's what to do right now to prevent more damage.",
    4: "I'm routing the on call tech and sending a confirmation text.",
    5: "I'll log what happened so follow ups stay consistent."
  },
  "price-shopper": {
    1: "Happy to help. What kind of service do you need today?",
    2: "Is this urgent or can we schedule a window?",
    3: "We can give a range now and confirm after a couple quick questions.",
    4: "Let's lock a time that works. Morning or afternoon?",
    5: "I'll log the key details so the next conversation starts ahead."
  },
  "repeat-customer": {
    1: "Good to hear from you. Are you calling about the same issue or something new?",
    2: "What's the address and best contact number?",
    3: "We can request the same tech when available.",
    4: "Booked. You'll get a confirmation and arrival window by text.",
    5: "I'll log your preference so it's remembered next time."
  }
};
const getLoggedContent = (step: Step): string => {
  if (step === 5) {
    return "Patterns used to refine talk tracks and routing over time. Calls are not shared with other businesses.";
  }
  return "Intent, key details, and outcome recorded for follow up and quality.";
};
const PROOF_CHIPS = ["Booked jobs, not voicemails", "Fewer missed calls", "Better close rate from the same leads", "Consistent talk track across every call"];
export const RingSnapCallToCashInteractive = () => {
  const [scenario, setScenario] = useState<Scenario>("emergency");
  const [selectedStep, setSelectedStep] = useState<Step>(1);
  return <div className="w-full">
            {/* Title */}
            <div className="text-center mb-6">
                <h2 className="text-h2 mb-2">How RingSnap turns calls into booked jobs</h2>
                <p className="text-body-default text-muted-foreground">
                    Tap a scenario. Then tap a step.
                </p>
            </div>

            {/* Scenario Tabs */}
            <Tabs value={scenario} onValueChange={value => {
      setScenario(value as Scenario);
      setSelectedStep(1);
    }} className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-auto p-1 bg-muted/50 rounded-xl mb-6">
                    {Object.entries(SCENARIOS).map(([key, {
          label,
          icon: Icon
        }]) => <TabsTrigger key={key} value={key} className={cn("flex items-center gap-2 py-3 px-4 rounded-lg text-sm font-medium transition-all", "data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary", "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2")}>
                            <Icon className="w-4 h-4" aria-hidden="true" />
                            <span className="hidden sm:inline">{label}</span>
                            <span className="sm:hidden">{label.split(" ")[0]}</span>
                        </TabsTrigger>)}
                </TabsList>

                {/* Tab Content - same for all scenarios, just different data */}
                {Object.keys(SCENARIOS).map(scenarioKey => <TabsContent key={scenarioKey} value={scenarioKey} className="mt-0">
                        {/* Steps Grid */}
                        <div className="grid gap-3 sm:grid-cols-5 mb-6" role="listbox" aria-label="Call handling steps">
                            {STEPS.map(step => {
            const Icon = step.icon;
            const isActive = selectedStep === step.id;
            return <button key={step.id} onClick={() => setSelectedStep(step.id)} role="option" aria-selected={isActive} className={cn("flex flex-col items-center text-center p-4 rounded-xl border-2 transition-all min-h-[100px]", "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none", isActive ? "border-primary bg-primary/5 shadow-md" : "border-muted bg-white hover:border-primary/30 hover:shadow-sm")}>
                                        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-colors", isActive ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
                                            <Icon className="w-5 h-5" aria-hidden="true" />
                                        </div>
                                        <span className="text-xs font-semibold leading-tight">{step.title}</span>
                                        <span className="text-xs text-muted-foreground mt-1 hidden sm:block leading-tight">
                                            {step.description}
                                        </span>
                                    </button>;
          })}
                        </div>

                        {/* Content Display */}
                        <Card className="card-tier-2 mb-6">
                            <CardContent className="p-6 space-y-4">
                                {/* What RingSnap says */}
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Badge variant="default" className="text-xs">What RingSnap says</Badge>
                                    </div>
                                    <p className="text-base leading-relaxed italic text-foreground">
                                        "{SCENARIO_SNIPPETS[scenario as Scenario][selectedStep]}"
                                    </p>
                                </div>

                                {/* What gets logged */}
                                <div className="pt-4 border-t">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Badge variant="secondary" className="text-xs">What gets logged</Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        {getLoggedContent(selectedStep)}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>)}
            </Tabs>

            {/* Proof Chips */}
            <div className="flex flex-wrap justify-center gap-3 mb-4">
                {PROOF_CHIPS.map(chip => <Badge key={chip} variant="outline" className="px-4 py-2 text-sm font-medium bg-white border-primary/20">
                        {chip}
                    </Badge>)}
            </div>

            {/* Trust Micro Line */}
            
        </div>;
};
export default RingSnapCallToCashInteractive;