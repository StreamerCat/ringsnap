import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Phone, ClipboardList, MessageSquare, Calendar, TrendingUp, AlertTriangle, DollarSign, UserCheck, CheckCircle2 } from "lucide-react";

type Scenario = "emergency" | "price-shopper" | "repeat-customer";
type Step = 1 | 2 | 3 | 4 | 5;

const STEPS = [{
  id: 1 as Step,
  title: "Instant Answer",
  description: "24/7 coverage, picks up in under 2 rings",
  icon: Phone
}, {
  id: 2 as Step,
  title: "Filter & Qualify",
  description: "Checks service area, job type, and urgency",
  icon: ClipboardList
}, {
  id: 3 as Step,
  title: "Resolve Concerns",
  description: "Handles questions on price, timing, and trust",
  icon: MessageSquare
}, {
  id: 4 as Step,
  title: "Book or Transfer",
  description: "Secures the appointment or warm transfers",
  icon: Calendar
}, {
  id: 5 as Step,
  title: "Get Smarter",
  description: "Outcomes refine your future talk tracks",
  icon: TrendingUp
}];

const SCENARIOS: Record<Scenario, {
  label: string;
  icon: React.ElementType;
}> = {
  "emergency": {
    label: "Emergency Job",
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
    1: "This is [Company Name]. I can help quickly—is everyone safe right now?",
    2: "Got it. I see your address. Can you turn off the main water valve while we talk?",
    3: "We can have a tech there in 45 mins. The emergency dispatch fee is [Fee]. Should I send them?",
    4: "They're on the way. I've sent you a text with their name and arrival time.",
    5: "I've logged the incident details so the tech arrives prepped and ready."
  },
  "price-shopper": {
    1: "Thanks for calling [Company Name]. How can I make your day better?",
    2: "I can help with that water heater. Is it leaking or just not heating?",
    3: "We don't give blind phone quotes, but we waive the diagnostic fee if you do the work.",
    4: "Great. I have a slot tomorrow at 8am or 2pm. Which works for you?",
    5: "I've noted that price was the main concern for future follow-ups."
  },
  "repeat-customer": {
    1: "Thanks for calling [Company Name]. Are you a current customer?",
    2: "Welcome back, Sarah. Are we looking at the same property on Maple Street?",
    3: "Since you're a member, you get priority booking and 15% off this service.",
    4: "You're all set for Thursday. I've requested Mike since he was there last time.",
    5: "I've updated your customer file with this new job history."
  }
};

const LOGGED_CONTENT: Record<Step, string[]> = {
  1: [
    "Caller ID & Name match",
    "Emergency flag detected",
    "Time of call recorded"
  ],
  2: [
    "Job type validation",
    "Service area confirmation",
    "Urgency level set"
  ],
  3: [
    "Questions asked by caller",
    "Specific answers given",
    "Pricing/Warranty terms explained"
  ],
  4: [
    "Appointment slot locked",
    "Tech assigned (if applicable)",
    "Confirmation SMS sent"
  ],
  5: [
    "Outcome used to tune talk tracks",
    "Routing rules updated",
    "Private to your account (never shared)"
  ]
};

const PROOF_CHIPS = [
  "More booked jobs",
  "Fewer callbacks",
  "Better data",
  "Consistent brand voice"
];

export const RingSnapCallToCashInteractive = () => {
  const [scenario, setScenario] = useState<Scenario>("emergency");
  const [selectedStep, setSelectedStep] = useState<Step>(1);

  return <div className="w-full">
    {/* Title */}
    <div className="text-center mb-6">
      <h2 className="text-h2 mb-2">How RingSnap turns calls into booked jobs</h2>
      <p className="text-body-default text-muted-foreground">
        Tap a scenario to see it in action.
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
        }]) => <TabsTrigger key={key} value={key} className={cn("flex items-center justify-center gap-2 py-3 px-2 rounded-lg text-sm font-medium transition-all", "data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary", "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2")}>
            <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </TabsTrigger>)}
      </TabsList>

      {/* Tab Content */}
      {Object.keys(SCENARIOS).map(scenarioKey => <TabsContent key={scenarioKey} value={scenarioKey} className="mt-0 focus-visible:outline-none">

        {/* Steps Grid - Vertical on Mobile, Horizontal on Desktop */}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-5 mb-6" role="listbox" aria-label="Call handling steps">
          {STEPS.map(step => {
            const Icon = step.icon;
            const isActive = selectedStep === step.id;
            return <button
              key={step.id}
              onClick={() => setSelectedStep(step.id)}
              role="option"
              aria-selected={isActive}
              className={cn("flex sm:flex-col items-center text-left sm:text-center p-3 sm:p-4 rounded-xl border-2 transition-all hover:border-primary/30",
                "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none",
                isActive ? "border-primary bg-primary/5 shadow-md scale-[1.02] sm:scale-105 z-10" : "border-muted bg-white shadow-sm"
              )}>
              <div className={cn("w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center mr-3 sm:mr-0 sm:mb-2 transition-colors", isActive ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
                <Icon className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="flex flex-col">
                <span className={cn("text-sm font-bold leading-tight", isActive ? "text-primary" : "text-foreground")}>{step.title}</span>
                <span className="text-xs text-muted-foreground mt-1 leading-tight hidden sm:block">
                  {step.description}
                </span>
              </div>
            </button>;
          })}
        </div>

        {/* Mobile Step Description Helper */}
        <div className="sm:hidden mb-4 p-3 bg-muted/20 rounded-lg text-center">
          <p className="text-sm text-foreground font-medium">{STEPS[selectedStep - 1].description}</p>
        </div>

        {/* Content Display */}
        <Card className="card-tier-2 mb-6 overflo-hidden bg-white border-primary/10 shadow-lg">
          <CardContent className="p-6 md:p-8 grid md:grid-cols-2 gap-8 items-start">
            {/* What RingSnap says */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="default" className="text-xs font-bold uppercase tracking-wider">What We Say</Badge>
              </div>
              <div className="relative">
                <div className="absolute -left-3 -top-2 text-4xl text-muted-foreground/20 font-serif">“</div>
                <p className="text-lg md:text-xl leading-relaxed font-medium text-foreground pl-2">
                  {SCENARIO_SNIPPETS[scenario as Scenario][selectedStep]}
                </p>
                <div className="absolute -bottom-4 text-4xl text-muted-foreground/20 font-serif">”</div>
              </div>
            </div>

            {/* What gets logged */}
            <div className="space-y-3 pt-6 md:pt-0 border-t md:border-t-0 md:border-l md:pl-8 border-dashed border-muted-foreground/20">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary" className="text-xs font-bold uppercase tracking-wider bg-purple-100 text-purple-700">What Gets Logged</Badge>
              </div>
              <ul className="space-y-2">
                {LOGGED_CONTENT[selectedStep].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </TabsContent>)}
    </Tabs>

    {/* Proof Chips */}
    <div className="flex flex-wrap justify-center gap-3">
      {PROOF_CHIPS.map(chip => <Badge key={chip} variant="outline" className="px-3 py-1.5 text-xs font-medium bg-white border-primary/20 text-muted-foreground">
        {chip}
      </Badge>)}
    </div>
  </div>;
};

export default RingSnapCallToCashInteractive;