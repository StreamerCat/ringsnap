import { useState, type ElementType } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AlertTriangle, DollarSign, UserCheck, CheckCircle2, ArrowRight, PhoneCall, ClipboardList, CalendarCheck2 } from "lucide-react";

type Scenario = "emergency" | "price-shopper" | "repeat-customer";
type PhaseId = "answer-identify" | "qualify-decide" | "confirm-log";

const USE_LEGACY_DIFFERENCE_INTERACTIVE = import.meta.env.VITE_USE_LEGACY_DIFFERENCE_INTERACTIVE === "true";

const PHASES: {
  id: PhaseId;
  title: string;
  description: string;
  icon: ElementType;
}[] = [
  {
    id: "answer-identify",
    title: "Answer + Identify",
    description: "Fast pickup and instant context.",
    icon: PhoneCall
  },
  {
    id: "qualify-decide",
    title: "Qualify + Decide",
    description: "Confirm fit, urgency, and next best action.",
    icon: ClipboardList
  },
  {
    id: "confirm-log",
    title: "Confirm + Log",
    description: "Lock in the outcome and capture the call details.",
    icon: CalendarCheck2
  }
];

const SCENARIOS: Record<Scenario, {
  label: string;
  icon: ElementType;
}> = {
  emergency: {
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

type StoryPhase = {
  phaseTitle: string;
  callerSays: string[];
  ringSnapSaysDoes: string[];
  supportTitle: string;
  supportBullets: string[];
  result: {
    title: string;
    outcome: string;
    details: string[];
    learningNote?: string;
  };
};

const SCENARIO_STORIES: Record<Scenario, Record<PhaseId, StoryPhase>> = {
  emergency: {
    "answer-identify": {
      phaseTitle: "Stabilize + Control",
      callerSays: [
        "My basement is flooding. It's getting worse."
      ],
      ringSnapSaysDoes: [
        "Okay, I've got you. Is the water still actively running?",
        "Do you know where your main shutoff valve is?",
        "What's the address so I can get help headed your way?"
      ],
      supportTitle: "What's happening behind the scenes",
      supportBullets: [
        "Emergency keywords detected",
        "Service area confirmed",
        "Address captured before escalation"
      ],
      result: {
        title: "Business result",
        outcome: "The call is controlled immediately. No panic. No lost time.",
        details: [
          "Urgency is recognized fast",
          "Caller stays engaged",
          "Your team gets clean intake details"
        ]
      }
    },
    "qualify-decide": {
      phaseTitle: "Decide + Escalate",
      callerSays: [
        "Can someone come right now?"
      ],
      ringSnapSaysDoes: [
        "Yes. We have an on-call tech.",
        "This qualifies as an emergency, so I'm connecting you directly.",
        "I'll send them a quick summary so you don't have to repeat everything."
      ],
      supportTitle: "Behind the scenes",
      supportBullets: [
        "After-hours rule matched",
        "Warm transfer triggered",
        "Tech receives issue summary before answering"
      ],
      result: {
        title: "Business result",
        outcome: "High-value emergency routed instantly instead of going to voicemail.",
        details: [
          "Correct escalation happens quickly",
          "No repeat story for the homeowner",
          "Revenue-critical calls are protected"
        ]
      }
    },
    "confirm-log": {
      phaseTitle: "Confirm + Secure",
      callerSays: [],
      ringSnapSaysDoes: [
        "You're connected now.",
        "If we get disconnected, I'll call you back.",
        "You'll also get a text confirming we're on the way."
      ],
      supportTitle: "What gets captured",
      supportBullets: [
        "Caller name and number",
        "Address and urgency level",
        "Outcome, recording, and transcript"
      ],
      result: {
        title: "Business result",
        outcome: "Emergency job secured. Full call record logged. Dispatch aligned.",
        details: [
          "Caller confidence stays high",
          "Team handoff is clean",
          "Follow-up risk is reduced"
        ]
      }
    }
  },
  "price-shopper": {
    "answer-identify": {
      phaseTitle: "Control the Frame",
      callerSays: [
        "How much do you charge for a water heater?"
      ],
      ringSnapSaysDoes: [
        "Great question. To give you the right number, can I ask two quick things?",
        "Is it gas or electric?",
        "About how old is the current unit?"
      ],
      supportTitle: "What this does",
      supportBullets: [
        "Establishes authority",
        "Prevents blind quoting",
        "Keeps control of the conversation"
      ],
      result: {
        title: "Business result",
        outcome: "You're no longer competing on a random price.",
        details: [
          "Conversation stays consultative",
          "Value is framed early",
          "Lead quality improves"
        ]
      }
    },
    "qualify-decide": {
      phaseTitle: "Handle the Objection",
      callerSays: [
        "I'm calling a few companies."
      ],
      ringSnapSaysDoes: [
        "Totally makes sense.",
        "Most installs vary based on venting, code requirements, and setup.",
        "The fastest way to get firm pricing is a quick visit so we can see it properly.",
        "Do mornings or afternoons work better?"
      ],
      supportTitle: "What this does",
      supportBullets: [
        "Validates without discounting",
        "Explains variability",
        "Moves toward scheduling"
      ],
      result: {
        title: "Business result",
        outcome: "Caller shifts from price shopping to booking.",
        details: [
          "Objection handled with confidence",
          "No race to the bottom",
          "Next step is clear"
        ]
      }
    },
    "confirm-log": {
      phaseTitle: "Close the Job",
      callerSays: [
        "Tomorrow morning works."
      ],
      ringSnapSaysDoes: [
        "Perfect. You're booked for tomorrow morning.",
        "I'm sending confirmation now.",
        "I've noted the current unit details so the tech shows up prepared."
      ],
      supportTitle: "What gets captured",
      supportBullets: [
        "Service type and unit details",
        "Confirmed time window",
        "Outcome, recording, and transcript"
      ],
      result: {
        title: "Business result",
        outcome: "Appointment locked. Context saved. Higher close rate.",
        details: [
          "Dispatch is prepared",
          "No missing details",
          "Revenue opportunity is secured"
        ]
      }
    }
  },
  "repeat-customer": {
    "answer-identify": {
      phaseTitle: "Recognize + Build Trust",
      callerSays: [
        "You serviced our AC last year."
      ],
      ringSnapSaysDoes: [
        "Welcome back.",
        "Are we talking about the same unit?",
        "Is it completely down or still running?"
      ],
      supportTitle: "What this does",
      supportBullets: [
        "Signals memory",
        "Uses relevant diagnostic framing",
        "Shows competence"
      ],
      result: {
        title: "Business result",
        outcome: "Trust is reinforced immediately.",
        details: [
          "Customer feels known",
          "Conversation starts faster",
          "Confidence goes up"
        ]
      }
    },
    "qualify-decide": {
      phaseTitle: "Guide + Prioritize",
      callerSays: [
        "Can I get the same tech?"
      ],
      ringSnapSaysDoes: [
        "I'll request them.",
        "Is this urgent today or can we schedule the next available slot?",
        "Let's get you taken care of."
      ],
      supportTitle: "What this does",
      supportBullets: [
        "Honors loyalty",
        "Captures urgency",
        "Moves decisively"
      ],
      result: {
        title: "Business result",
        outcome: "Retention protected. No friction.",
        details: [
          "Priority is set correctly",
          "Loyal customer stays engaged",
          "Scheduling momentum is maintained"
        ]
      }
    },
    "confirm-log": {
      phaseTitle: "Confirm + Document",
      callerSays: [],
      ringSnapSaysDoes: [
        "You're confirmed for Thursday.",
        "Confirmation text is on the way.",
        "I've added notes from today's call so it's seamless."
      ],
      supportTitle: "What gets captured",
      supportBullets: [
        "Service history notes",
        "Confirmed appointment window",
        "Outcome, recording, and transcript"
      ],
      result: {
        title: "Business result",
        outcome: "Repeat revenue secured. Clean service history maintained.",
        details: [
          "Handoff to the field is smoother",
          "Team keeps continuity",
          "Customer experience stays consistent"
        ]
      }
    }
  }
};

const OUTCOME_LINKS = [
  { label: "See call flow", href: "#mechanism-section" },
  { label: "See learning model", href: "#learning-section" },
  { label: "See controls", href: "#control-section" },
  { label: "See outcomes", href: "#proof-section" }
];

type LegacyStep = 1 | 2 | 3 | 4 | 5;
const LEGACY_STEPS = [
  "Instant Answer",
  "Filter & Qualify",
  "Resolve Concerns",
  "Book or Transfer",
  "Get Smarter"
] as const;

type LegacyStepContent = {
  callerSays: string;
  ringSnapSays: string;
  loggedOutcome: string;
};

const LEGACY_SCENARIO_CONTENT: Record<Scenario, Record<LegacyStep, LegacyStepContent>> = {
  emergency: {
    1: {
      callerSays: "My basement is flooding and it keeps rising.",
      ringSnapSays: "I can help right now. Is the water still running and are you safe?",
      loggedOutcome: "Emergency intent and immediate safety context captured in seconds."
    },
    2: {
      callerSays: "Yes, it's still active and I need someone now.",
      ringSnapSays: "Got it. What's the service address so I can route the on-call team?",
      loggedOutcome: "Service area, urgency, and address are qualified before escalation."
    },
    3: {
      callerSays: "How fast can someone get here?",
      ringSnapSays: "You're being prioritized as an active emergency. I'm connecting dispatch now.",
      loggedOutcome: "Concern resolved with clear timing expectations and confidence-building language."
    },
    4: {
      callerSays: "Okay, please send them.",
      ringSnapSays: "Confirmed. I'm transferring you and sending your notes so you don't repeat anything.",
      loggedOutcome: "Warm transfer triggered with full intake summary."
    },
    5: {
      callerSays: "Thanks for moving so quickly.",
      ringSnapSays: "You're all set. We'll text confirmation and keep this record attached to the job.",
      loggedOutcome: "Call recording, transcript, and emergency disposition logged for follow-up learning."
    }
  },
  "price-shopper": {
    1: {
      callerSays: "How much do you charge for a water heater install?",
      ringSnapSays: "Great question—I'll get you a real number after two quick fit questions.",
      loggedOutcome: "Price-only opener converted into a guided consultative script."
    },
    2: {
      callerSays: "I'm comparing a few companies.",
      ringSnapSays: "Totally fair. Is your current unit gas or electric, and how old is it?",
      loggedOutcome: "Key qualifier details captured to avoid blind quoting."
    },
    3: {
      callerSays: "Can you at least give me a ballpark?",
      ringSnapSays: "Ballparks vary by venting and code, so the fastest path is a quick assessment visit.",
      loggedOutcome: "Objection handled without discounting; value frame maintained."
    },
    4: {
      callerSays: "Tomorrow morning might work.",
      ringSnapSays: "Perfect—I'll lock in tomorrow morning and text confirmation now.",
      loggedOutcome: "Appointment booked with service notes attached for dispatch."
    },
    5: {
      callerSays: "Sounds good.",
      ringSnapSays: "Done. We saved your preferences so the next quote call is even faster.",
      loggedOutcome: "Outcome tagged as converted from price shopper for future optimization."
    }
  },
  "repeat-customer": {
    1: {
      callerSays: "You worked on our AC last year.",
      ringSnapSays: "Welcome back—are we talking about that same unit today?",
      loggedOutcome: "Caller recognized as existing customer with prior service context."
    },
    2: {
      callerSays: "Yes, and it's struggling again.",
      ringSnapSays: "Is it fully down or still running so we can prioritize correctly?",
      loggedOutcome: "Urgency and equipment details qualified using service history."
    },
    3: {
      callerSays: "Can we get the same tech?",
      ringSnapSays: "I'll request that tech and secure the fastest available window.",
      loggedOutcome: "Loyalty concern addressed while preserving schedule momentum."
    },
    4: {
      callerSays: "Thursday works best.",
      ringSnapSays: "You're confirmed for Thursday and we'll send a reminder text.",
      loggedOutcome: "Return-customer appointment booked with continuity notes."
    },
    5: {
      callerSays: "Great, thank you.",
      ringSnapSays: "Anytime—today's notes are saved to your profile for the next call.",
      loggedOutcome: "Transcript and disposition logged to strengthen future repeat interactions."
    }
  }
};

const LegacyInteractive = () => {
  const [scenario, setScenario] = useState<Scenario>("emergency");
  const [selectedStep, setSelectedStep] = useState<LegacyStep>(1);
  const activeStep = LEGACY_SCENARIO_CONTENT[scenario][selectedStep];

  return <div className="w-full">
    <div className="text-center mb-4">
      <h2 className="text-h2 mb-2">How RingSnap turns every inbound call into booked revenue</h2>
      <p className="text-body-default text-muted-foreground">Tap a scenario to see it in action.</p>
      <p className="text-xs text-muted-foreground mt-2">Legacy module enabled via VITE_USE_LEGACY_DIFFERENCE_INTERACTIVE=true.</p>
    </div>

    <Tabs value={scenario} onValueChange={(value) => {
      setScenario(value as Scenario);
      setSelectedStep(1);
    }} className="w-full">
      <TabsList className="grid w-full grid-cols-3 h-auto p-1 bg-muted/50 rounded-xl mb-4">
        {Object.entries(SCENARIOS).map(([key, { label, icon: Icon }]) => <TabsTrigger key={key} value={key} className="flex items-center justify-center gap-2 py-3 px-2 rounded-lg text-sm font-medium">
          <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span className="truncate">{label}</span>
        </TabsTrigger>)}
      </TabsList>
      <TabsContent value={scenario}>
        <div className="grid gap-2 sm:grid-cols-5">
          {LEGACY_STEPS.map((step, index) => (
            <button
              key={step}
              onClick={() => setSelectedStep((index + 1) as LegacyStep)}
              aria-pressed={selectedStep === index + 1}
              className={cn("rounded-lg border p-3 text-sm text-left", selectedStep === index + 1 ? "border-primary bg-primary/5" : "border-muted")}
            >
              {step}
            </button>
          ))}
        </div>

        <Card className="card-tier-2 mt-3 bg-white border-primary/10 shadow-sm">
          <CardContent className="p-4 md:p-5 grid gap-3 md:gap-4 md:grid-cols-3">
            <section className="space-y-2" aria-labelledby="legacy-caller-says-title">
              <Badge variant="outline" id="legacy-caller-says-title" className="text-xs font-bold uppercase tracking-wider border-primary/20 text-primary">Caller says</Badge>
              <p className="rounded-xl bg-muted/40 border border-muted px-3 py-2 text-sm text-foreground leading-relaxed">{activeStep.callerSays}</p>
            </section>
            <section className="space-y-2" aria-labelledby="legacy-ringsnap-says-title">
              <Badge variant="default" id="legacy-ringsnap-says-title" className="text-xs font-bold uppercase tracking-wider">RingSnap says</Badge>
              <p className="rounded-xl bg-primary/5 border border-primary/15 px-3 py-2 text-sm text-foreground leading-relaxed">{activeStep.ringSnapSays}</p>
            </section>
            <section className="space-y-2" aria-labelledby="legacy-logged-outcome-title">
              <Badge variant="secondary" id="legacy-logged-outcome-title" className="text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700">Logged outcome</Badge>
              <p className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm text-foreground leading-relaxed">{activeStep.loggedOutcome}</p>
            </section>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  </div>;
};

export const RingSnapCallToCashInteractive = () => {
  const [scenario, setScenario] = useState<Scenario>("emergency");
  const [selectedPhase, setSelectedPhase] = useState<PhaseId>("answer-identify");

  if (USE_LEGACY_DIFFERENCE_INTERACTIVE) {
    return <LegacyInteractive />;
  }

  const activeStory = SCENARIO_STORIES[scenario][selectedPhase];

  return <div className="w-full">
    <div className="text-center mb-4">
      <h2 className="text-h2 mb-2">How RingSnap turns every inbound call into booked revenue</h2>
      <p className="text-body-default text-muted-foreground">Pick a scenario. See the call, the decision, and the result.</p>
    </div>

    <Tabs
      value={scenario}
      onValueChange={(value) => {
        setScenario(value as Scenario);
        setSelectedPhase("answer-identify");
      }}
      className="w-full"
    >
      <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 h-auto p-1 bg-muted/50 rounded-xl mb-5">
        {Object.entries(SCENARIOS).map(([key, { label, icon: Icon }]) => <TabsTrigger key={key} value={key} className={cn("flex items-center justify-center gap-2 py-3 px-2 rounded-lg text-sm font-medium transition-all", "data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary", "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2")}>
          <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span className="truncate">{label}</span>
        </TabsTrigger>)}
      </TabsList>

      {Object.keys(SCENARIOS).map((scenarioKey) => (
        <TabsContent key={scenarioKey} value={scenarioKey} className="mt-0 focus-visible:outline-none">
          <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-3 mb-5" role="group" aria-label="Call handling phases">
            {PHASES.map((phase) => {
              const Icon = phase.icon;
              const isActive = selectedPhase === phase.id;
              return (
                <button
                  key={phase.id}
                  onClick={() => setSelectedPhase(phase.id)}
                  aria-pressed={isActive}
                  className={cn(
                    "flex items-center text-left p-3.5 rounded-xl border-2 transition-all",
                    "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none",
                    isActive ? "border-primary bg-primary/5 shadow-md" : "border-muted bg-white shadow-sm hover:border-primary/30"
                  )}
                >
                  <div className={cn("w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center mr-3 transition-colors", isActive ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className={cn("text-sm font-bold leading-tight", isActive ? "text-primary" : "text-foreground")}>Phase {phase.id === "answer-identify" ? "1" : phase.id === "qualify-decide" ? "2" : "3"}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-tight">{SCENARIO_STORIES[scenario][phase.id].phaseTitle}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <Card className="card-tier-2 mb-4 bg-white border-primary/10 shadow-md overflow-hidden">
            <CardContent className="p-4 md:p-6 grid gap-4 md:gap-5 md:grid-cols-3">
              <section className="space-y-3" aria-labelledby="caller-says-title">
                <Badge variant="outline" id="caller-says-title" className="text-xs font-bold uppercase tracking-wider border-primary/20 text-primary">Caller says</Badge>
                {activeStory.callerSays.length > 0 ? (
                  <ul className="space-y-2">
                    {activeStory.callerSays.map((item, index) => (
                      <li key={`caller-${index}`} className="rounded-xl bg-muted/40 border border-muted px-3 py-2 text-sm text-foreground leading-relaxed">
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-xl bg-muted/20 border border-dashed border-muted px-3 py-2 text-sm text-muted-foreground">
                    Caller is already in motion—RingSnap confirms next steps and keeps the handoff clean.
                  </p>
                )}
              </section>

              <section className="space-y-3" aria-labelledby="ringsnap-says-title">
                <Badge variant="default" id="ringsnap-says-title" className="text-xs font-bold uppercase tracking-wider">RingSnap says / does</Badge>
                <ul className="space-y-2">
                  {activeStory.ringSnapSaysDoes.map((item, index) => (
                    <li key={`ringsnap-${index}`} className="rounded-xl bg-primary/5 border border-primary/15 px-3 py-2 text-sm text-foreground leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="space-y-3" aria-labelledby="you-get-title">
                <Badge variant="secondary" id="you-get-title" className="text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700">You get</Badge>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-3">
                  <p className="font-semibold text-sm text-foreground">{activeStory.result.title}</p>
                  <p className="inline-flex items-center gap-2 rounded-full bg-white border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700">
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    {activeStory.result.outcome}
                  </p>
                  <ul className="space-y-2">
                    {activeStory.result.details.map((detail) => (
                      <li key={detail} className="flex items-start gap-2 text-xs text-foreground/90">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                  {activeStory.result.learningNote && (
                    <p className="text-xs text-muted-foreground border-t border-emerald-200 pt-2">{activeStory.result.learningNote}</p>
                  )}
                </div>
              </section>
            </CardContent>
          </Card>

          <Card className="card-tier-2 mb-4 bg-white">
            <CardContent className="p-4 md:p-5">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="secondary" className="text-xs font-bold uppercase tracking-wider bg-purple-100 text-purple-700">{activeStory.supportTitle}</Badge>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {activeStory.supportBullets.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      ))}
    </Tabs>

    <div className="flex flex-wrap justify-center gap-2 mt-1">
      {OUTCOME_LINKS.map((chip) => (
        <a
          key={chip.label}
          href={chip.href}
          className="px-2.5 py-1 text-xs font-medium bg-white border border-primary/20 text-muted-foreground rounded-full hover:text-primary hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {chip.label}
        </a>
      ))}
    </div>
  </div>;
};

export default RingSnapCallToCashInteractive;
