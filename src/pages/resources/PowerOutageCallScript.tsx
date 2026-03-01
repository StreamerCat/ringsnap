import { ResourceLayout } from "@/components/resources/ResourceLayout";
import { CopyableScriptBlock } from "@/components/resources/CopyableScriptBlock";
import { ResourceCTA } from "@/components/resources/ResourceCTA";
import { RelatedResources } from "@/components/resources/RelatedResources";
import { FAQSection } from "@/components/resources/FAQSection";
import { ChecklistBlock } from "@/components/resources/ChecklistBlock";

const faqs = [
    { question: "How do I tell if it's a utility outage or a panel issue?", answer: "Two quick checks: (1) Are the neighbors' lights out? If the whole neighborhood is dark, it's the utility company. (2) Check the main breaker — if it's tripped (in the middle or off position), it's likely a panel or home issue. If the main breaker is on and neighbors have power, it's almost certainly an electrical issue in the home." },
    { question: "Should I dispatch for a utility outage?", answer: "No. Direct the caller to their utility company's outage line. However, tell them: 'If your power doesn't come back when the rest of the neighborhood does, call us back — that means the issue might be on your end.' This captures follow-up work without wasting a truck roll." },
    { question: "What causes a main breaker to trip?", answer: "The most common causes: (1) Overloaded panel — too many circuits drawing power simultaneously, (2) Short circuit in wiring, (3) Ground fault, (4) Faulty or aging breaker, (5) Power surge (from lightning or utility issues). Any of these warrant a service call." },
    { question: "How much is a power outage service call worth?", answer: "Diagnostic calls for home power issues typically run $150–$300. If the issue is a failed main breaker, the repair is $300–$500. If it reveals a panel issue requiring replacement, you're looking at $2,000–$5,000+. That's why power outage calls are worth answering — they can lead to significant work." },
];

const PowerOutageCallScript = () => (
    <ResourceLayout
        title="Power Outage Call Script for Electricians (Free Template) | RingSnap"
        metaDescription="Free power outage call script for electrical dispatchers. Differentiate utility outages from panel issues, guide callers through basic checks, and dispatch only when needed."
        canonical="/resources/power-outage-call-script/"
        keywords="power outage call script, electrician outage phone script, power outage triage, electrical service outage dispatch"
        breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Resources", href: "/resources/" },
            { label: "Electrician Scripts", href: "/resources/electrician-call-answering-script/" },
            { label: "Power Outage Call Script" },
        ]}
        toc={[
            { id: "triage-logic", label: "Triage Logic" },
            { id: "script", label: "Power Outage Script" },
            { id: "partial-outage", label: "Partial Outage Script" },
            { id: "checklist", label: "Power Outage Checklist" },
            { id: "faqs", label: "FAQs" },
        ]}
    >
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">
            Power Outage Call Script for Electricians
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed mb-8">
            Power outage calls need fast triage. Half of them are utility issues (not your job). The other half are panel problems, tripped breakers, or wiring faults (high-value dispatches). This script helps your dispatcher sort them out in under 2 minutes.
        </p>

        <section id="triage-logic" className="mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-4">Triage Logic: Utility vs. Your Dispatch</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
                The goal is to identify whether the outage is on the utility side (neighborhood-wide) or on the home's side (panel, breaker, or wiring). This distinction saves you from wasted truck rolls and ensures you're dispatching on real, billable work.
            </p>
            <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div className="rounded-xl border border-border bg-card p-5">
                    <h3 className="font-bold text-foreground mb-3">🏘️ Utility Outage (Not Your Dispatch)</h3>
                    <ul className="list-disc pl-5 space-y-1.5 text-sm text-muted-foreground">
                        <li>Neighbors are also without power</li>
                        <li>Streetlights are off</li>
                        <li>Utility company confirmed outage</li>
                        <li>Main breaker is in the ON position</li>
                    </ul>
                    <p className="text-xs text-muted-foreground mt-3 italic">→ Direct caller to utility company</p>
                </div>
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
                    <h3 className="font-bold text-foreground mb-3">🏠 Home Issue (Your Dispatch)</h3>
                    <ul className="list-disc pl-5 space-y-1.5 text-sm text-muted-foreground">
                        <li>Neighbors have power</li>
                        <li>Main breaker is tripped</li>
                        <li>Only part of the home is out</li>
                        <li>Breaker won't reset or keeps tripping</li>
                        <li>Power surged before going out</li>
                    </ul>
                    <p className="text-xs text-primary mt-3 italic">→ Schedule service call or emergency dispatch</p>
                </div>
            </div>
        </section>

        <section id="script" className="mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-4">Power Outage Triage Script</h2>
            <CopyableScriptBlock
                title="Complete Power Outage Script"
                scenario="Caller reports power is out in their home"
                script={`"Thanks for calling [Company Name]. I'm sorry you're dealing with a power issue — let me help you figure out what's going on.

First, let me ask a couple of quick questions to determine if this is something we can fix or if it's a utility company issue:

1. Is the power out in your ENTIRE home, or just part of it?
   [If just part → skip to Partial Outage section]

2. Can you see if your neighbors have power? Are their lights on? Are the streetlights working?

[IF NEIGHBORHOOD IS OUT:]
'OK — it sounds like this is a utility outage affecting your area. Here's what I'd recommend:
- Call [utility company name] at [phone number] to report the outage and get an ETA
- You can usually check their outage map online at [website]

Now, here's the important part: when the rest of your neighborhood gets power back, if YOUR home doesn't come back on, call us right away. That would mean there's an issue on your panel or meter side that we'd need to fix.

Is there anything else I can help with?'

[IF ONLY THEIR HOME:]
'OK, so your neighbors have power but you don't — that means the issue is on your side. Let me walk you through a quick check:

Can you find your main electrical panel? It's usually in the garage, basement, utility room, or on an exterior wall. 

Is the main breaker — the big one at the top — in the ON position? Or has it tripped to the middle or OFF position?

[IF TRIPPED:]
'Try flipping it all the way OFF first, then back to ON. Sometimes after a power surge, the breaker trips and just needs to be reset.'

[Wait]

'Did that restore power? 
- If yes: Great! If it happens again, give us a call — it could indicate an underlying issue.
- If no / if it trips again immediately: That tells us there's likely a short circuit or ground fault. We need to get an electrician out to diagnose it safely. Don't keep trying to reset it.'

I have availability [today/tomorrow]. Our diagnostic fee is [$XX], applied toward any repair. Can I get your name, address, and phone number?"`}
            />
        </section>

        <section id="partial-outage" className="mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-4">Partial Outage Script</h2>
            <CopyableScriptBlock
                title="Partial Power Loss Script"
                scenario="Power out in some rooms but not others"
                script={`"So part of your home has power and part doesn't — that's actually helpful to know because it narrows down what's happening.

Can you check your breaker panel? Look for any breakers that are flipped to the middle or OFF position. Those are tripped breakers.

[IF THEY FIND TRIPPED BREAKERS:]
'Try flipping each tripped breaker to fully OFF, then back to ON. Did that restore power to those areas?

- If yes: Keep an eye on it. If the breakers trip again — especially the same ones — call us to have it checked. Recurring trips usually mean an overloaded circuit, a failing breaker, or a wiring issue.
- If breaker won't stay on: Don't force it. A breaker that keeps tripping is protecting you from a wiring problem. Leave it off and let's get an electrician there.'

[IF NO BREAKERS ARE TRIPPED:]
'That's actually more concerning. If nothing is tripped but you've still lost power to part of the house, it could be a loose connection, a failed breaker that isn't tripping properly, or a wiring issue. We should definitely get an electrician out to look at it.

I have availability [today/tomorrow]. Can I get your information?'"`}
            />
        </section>

        <section id="checklist" className="mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-4">Power Outage Intake Checklist</h2>
            <ChecklistBlock
                title="Power Outage Triage Checklist"
                items={[
                    "Full outage or partial? (determines script path)",
                    "Neighbors have power? (utility vs. home issue)",
                    "Main breaker checked? (tripped/on/won't reset)",
                    "Individual breakers checked? (any tripped)",
                    "Breaker reset attempted? (did it hold or re-trip)",
                    "Any events before outage? (storm, surge, appliance turning on)",
                    "Home/building age",
                    "Utility company referred (if utility outage)",
                    "Follow-up instruction given: 'Call back if power doesn't return with neighbors'",
                    "Service call scheduled (if home issue confirmed)",
                    "Caller name, address, callback number captured",
                ]}
            />
        </section>

        <section id="faqs">
            <FAQSection faqs={faqs} />
        </section>

        <ResourceCTA variant="demo" trade="electrical" service="power outage" />

        <RelatedResources
            resources={[
                { title: "Electrician Call Answering Script", description: "Complete call scripts with safety triage.", href: "/resources/electrician-call-answering-script/", tag: "Pillar" },
                { title: "Electrical Safety Triage Questions", description: "The 8 questions every dispatcher must ask.", href: "/resources/electrical-safety-triage-questions/", tag: "Electrical" },
                { title: "Panel Upgrade Booking Script", description: "Book panel upgrades from capacity and tripping concerns.", href: "/resources/panel-upgrade-booking-script/", tag: "Electrical" },
            ]}
        />
    </ResourceLayout>
);

export default PowerOutageCallScript;
