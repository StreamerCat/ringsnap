import { ResourceLayout } from "@/components/resources/ResourceLayout";
import { CopyableScriptBlock } from "@/components/resources/CopyableScriptBlock";
import { ResourceCTA } from "@/components/resources/ResourceCTA";
import { RelatedResources } from "@/components/resources/RelatedResources";
import { FAQSection } from "@/components/resources/FAQSection";
import { ChecklistBlock } from "@/components/resources/ChecklistBlock";

const toc = [
    { id: "when-to-triage", label: "When to Triage" },
    { id: "gas-leak", label: "Gas Leak Protocol" },
    { id: "no-heat", label: "No Heat Script" },
    { id: "ac-failure", label: "AC Failure Script" },
    { id: "triage-checklist", label: "Triage Checklist" },
    { id: "faqs", label: "FAQs" },
];

const faqs = [
    { question: "How do I know if an HVAC call is a true emergency?", answer: "Three automatic triggers: (1) Gas smell near any HVAC equipment, (2) Carbon monoxide detector alarm, (3) System failure during extreme temperatures (below 35°F or above 95°F) with vulnerable people in the home. Everything else can typically wait for the morning." },
    { question: "What if the caller smells gas?", answer: "This is the one scenario where you don't take a full intake. Tell them to leave the home immediately, don't flip any switches, and call the gas company. Keep the line open if possible. Only after they're safe and the gas company is notified do you dispatch." },
    { question: "Should dispatchers give troubleshooting advice?", answer: "Simple checks only: Is the thermostat set correctly? Is the breaker tripped? Is the filter clogged? These can sometimes resolve the issue and save a truck roll. But never ask a caller to open equipment, touch wiring, or do anything that could cause injury." },
    { question: "How fast should we respond to an HVAC emergency?", answer: "Top-performing shops aim for on-site within 2 hours for emergencies, or a callback within 15 minutes after hours. Every additional hour of delay increases the chance the caller books with a competitor." },
];

const HvacEmergencyTriage = () => (
    <ResourceLayout
        title="HVAC Emergency Call Triage Guide (2026) | RingSnap"
        metaDescription="HVAC emergency triage guide for dispatchers: gas leak protocol, no-heat scripts, AC failure handling, and the triage checklist that separates real emergencies from morning appointments."
        canonical="/resources/hvac-emergency-call-triage/"
        keywords="hvac emergency call triage, hvac emergency dispatch, hvac gas leak protocol, no heat emergency script, ac failure triage"
        breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Resources", href: "/resources/" },
            { label: "HVAC Dispatcher Scripts", href: "/resources/hvac-dispatcher-script-template/" },
            { label: "Emergency Call Triage" },
        ]}
        toc={toc}
    >
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">
            HVAC Emergency Call Triage Guide
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed mb-8">
            Not every urgent-sounding HVAC call is a true emergency. But miss a real one — a gas leak, a no-heat call with an elderly homeowner — and the consequences are serious. This triage guide helps your dispatchers make the right call, every time.
        </p>

        <section id="when-to-triage" className="mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-4">When to Triage: Emergency vs. Urgent vs. Routine</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
                Every HVAC call falls into one of three categories. Your triage process should classify the call within the first 60 seconds so you can route it correctly:
            </p>
            <div className="grid gap-4 mb-4">
                <div className="rounded-xl border-2 border-destructive/30 bg-destructive/5 p-5">
                    <h3 className="font-bold text-foreground mb-2">🚨 Emergency — Dispatch Immediately</h3>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                        <li>Gas smell near HVAC equipment or gas line</li>
                        <li>Carbon monoxide detector alarm</li>
                        <li>No heat with outdoor temp below 35°F + vulnerable occupant</li>
                        <li>No AC with outdoor temp above 95°F + vulnerable occupant</li>
                        <li>Active water leak from HVAC system causing property damage</li>
                        <li>Sparking, burning smell, or smoke from HVAC equipment</li>
                    </ul>
                </div>
                <div className="rounded-xl border-2 border-yellow-500/30 bg-yellow-500/5 p-5">
                    <h3 className="font-bold text-foreground mb-2">⚡ Urgent — Same-Day Priority</h3>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                        <li>System down in moderate weather (uncomfortable but not dangerous)</li>
                        <li>Significant performance loss (system runs but barely cools/heats)</li>
                        <li>Loud, unusual sounds suggesting mechanical failure</li>
                        <li>Commercial HVAC down affecting business operations</li>
                    </ul>
                </div>
                <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-5">
                    <h3 className="font-bold text-foreground mb-2">📅 Routine — Schedule Next Available</h3>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                        <li>Tune-up or maintenance request</li>
                        <li>Filter replacement</li>
                        <li>Minor comfort concern (one room warmer than others)</li>
                        <li>Thermostat questions</li>
                        <li>New system quote or second opinion</li>
                    </ul>
                </div>
            </div>
        </section>

        <section id="gas-leak" className="mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-4">Gas Leak Protocol</h2>
            <CopyableScriptBlock
                title="Gas Leak Emergency Script"
                scenario="Caller reports gas smell near HVAC equipment"
                script={`"I need to address this immediately. If you smell gas:

1. Do NOT flip any light switches or electrical devices.
2. Do NOT use your phone inside the house — step outside first.
3. Leave the home right now with everyone inside.
4. Once you're safely outside, call your gas company at [local number].

Are you outside now? Good.

Once the gas company clears the area, call us back and we'll send a technician to inspect your HVAC system. Our number is [company number].

Your safety is the priority right now. The gas company will shut off the supply if needed and tell you when it's safe to go back inside."`}
            />
        </section>

        <section id="no-heat" className="mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-4">No-Heat Emergency Script</h2>
            <CopyableScriptBlock
                title="No-Heat Triage & Dispatch Script"
                scenario="System not producing heat during cold weather"
                script={`"I'm sorry you're dealing with this. Let me help you figure out the quickest path to getting your heat back.

First, a couple of quick checks:
- Is your thermostat set to HEAT and set above the current room temperature?
- Can you check your breaker panel — is the furnace/heat pump breaker in the ON position?
- When's the last time you changed the air filter?

[If simple fix resolves it:] "Great — sounds like that did it! If the issue comes back, give us a call and we'll send a tech."

[If not resolved:]
- What's the temperature outside right now?
- Is anyone in the home who is elderly, very young, or has a medical condition?

[If vulnerable occupant + cold temps:] "This is a priority for us. I'm dispatching a technician now. They'll be there within [X hours]. In the meantime, use space heaters if you have them — keep them at least 3 feet from anything flammable."

[If no vulnerable occupant:] "I can get a tech to you [tonight / first thing tomorrow morning]. What works better for you?"`}
            />
        </section>

        <section id="ac-failure" className="mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-4">AC Failure Script</h2>
            <CopyableScriptBlock
                title="AC Failure Triage Script"
                scenario="Air conditioning not cooling during hot weather"
                script={`"Let me help you sort this out. A few things to check first:

- Is the thermostat set to COOL and set below the current room temp?
- Is the outdoor unit (condenser) running? Can you hear or see the fan?
- Have you checked the breaker panel?
- When did you last change the filter?

[If outdoor unit not running + breaker not tripped:] "It sounds like there may be an issue with the contactor or capacitor — common and usually a quick fix. Let me get a tech scheduled."

[If system is running but not cooling:] "If the system is running but not cooling, it could be a refrigerant issue or a failing compressor. Best to get eyes on it before it causes more damage."

[Assess urgency — same criteria as no-heat: extreme temps + vulnerable occupants = dispatch now]

I have availability [today/tomorrow]. Our diagnostic fee is [$XX], applied toward the repair. Can I get your name and address?"`}
            />
        </section>

        <section id="triage-checklist" className="mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-4">HVAC Emergency Triage Checklist</h2>
            <ChecklistBlock
                title="Emergency Triage Decision Checklist"
                items={[
                    "SAFETY: Gas smell? → Leave home, call gas company, DO NOT dispatch until area cleared",
                    "SAFETY: CO alarm? → Leave home, call 911, follow up with HVAC dispatch",
                    "SAFETY: Sparking/smoke from equipment? → Turn off breaker, leave area if smoke persists",
                    "URGENCY: Outdoor temp extreme (below 35°F or above 95°F)?",
                    "URGENCY: Vulnerable occupant in home? (elderly, infant, medical condition)",
                    "URGENCY: Property damage occurring? (water leak from unit)",
                    "Classification: Emergency / Urgent / Routine (assign based on above)",
                    "Full intake captured (name, address, phone, system type, symptom)",
                    "Response time communicated to caller",
                    "After-hours fee communicated (if applicable)",
                ]}
            />
        </section>

        <section id="faqs">
            <FAQSection faqs={faqs} />
        </section>

        <ResourceCTA variant="demo" trade="HVAC" service="emergency HVAC" />

        <RelatedResources
            resources={[
                { title: "HVAC Dispatcher Script Template", description: "Complete HVAC dispatcher scripts and call flow.", href: "/resources/hvac-dispatcher-script-template/", tag: "Pillar" },
                { title: "HVAC After-Hours Script", description: "After-hours answering with emergency triage.", href: "/resources/hvac-after-hours-answering-script/", tag: "HVAC" },
                { title: "After-Hours Call Calculator", description: "See how much revenue hides in your after-hours call volume.", href: "/resources/after-hours-call-calculator/", tag: "Calculator" },
            ]}
        />
    </ResourceLayout>
);

export default HvacEmergencyTriage;
