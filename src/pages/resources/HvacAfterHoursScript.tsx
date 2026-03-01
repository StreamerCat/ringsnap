import { ResourceLayout } from "@/components/resources/ResourceLayout";
import { CopyableScriptBlock } from "@/components/resources/CopyableScriptBlock";
import { ResourceCTA } from "@/components/resources/ResourceCTA";
import { RelatedResources } from "@/components/resources/RelatedResources";
import { FAQSection } from "@/components/resources/FAQSection";
import { ChecklistBlock } from "@/components/resources/ChecklistBlock";

const toc = [
    { id: "why-after-hours", label: "Why After-Hours Matters" },
    { id: "script", label: "After-Hours Script" },
    { id: "emergency-triage", label: "Emergency vs. Morning" },
    { id: "checklist", label: "After-Hours Checklist" },
    { id: "faqs", label: "FAQs" },
];

const faqs = [
    { question: "What percentage of HVAC calls come after hours?", answer: "Industry data shows 25–40% of HVAC calls come outside normal business hours (before 8 AM, after 5 PM, and weekends). During extreme weather events — winter cold snaps and summer heat waves — after-hours volume can spike to 50%+ of total calls." },
    { question: "Should I charge more for after-hours HVAC service?", answer: "Yes. Standard practice is 1.5x your regular rate for evenings/weekends and 2x for holidays. Be transparent about this in the script. Callers dealing with an emergency expect to pay more and appreciate honesty." },
    { question: "How do I staff after-hours without burning out my team?", answer: "Three options: (1) Rotating on-call schedule with premium pay ($75–$150 per night). (2) AI receptionist that triages and only escalates true emergencies. (3) Combination: AI screens all calls, on-call tech only gets woken up for genuine emergencies." },
    { question: "What if the caller has a non-emergency after hours?", answer: "Book them for the first available morning slot. The script should still capture all their information and confirm the appointment. Non-emergencies should never wake up your on-call tech." },
];

const HvacAfterHoursScript = () => (
    <ResourceLayout
        title="HVAC After-Hours Answering Script (Free Template) | RingSnap"
        metaDescription="Free after-hours HVAC answering script with emergency triage, overnight booking, and reassurance language. Copy, paste, and stop losing after-hours revenue."
        canonical="/resources/hvac-after-hours-answering-script/"
        keywords="after hours hvac answering script, hvac after hours phone script, hvac overnight answering, hvac emergency after hours"
        breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Resources", href: "/resources/" },
            { label: "HVAC Dispatcher Scripts", href: "/resources/hvac-dispatcher-script-template/" },
            { label: "After-Hours Answering Script" },
        ]}
        toc={toc}
    >
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">
            HVAC After-Hours Answering Script
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed mb-8">
            Between 25% and 40% of your HVAC calls come after your office closes. Without a live answer, those calls — many of them high-value emergencies — go straight to your competitor. This script ensures every after-hours caller gets a professional, reassuring response that books the job or dispatches your on-call tech.
        </p>

        <section id="why-after-hours" className="mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-4">Why After-Hours Coverage Is Non-Negotiable</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
                Here's what happens when an HVAC call goes to voicemail after hours: the caller immediately calls the next contractor on Google. Studies show 78% of callers who reach voicemail won't leave a message — they'll just move on. In the HVAC world, that's a $400–$1,200 emergency call walking out the door.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
                The math is straightforward. If your shop receives 300 calls per month and 30% come after hours, that's 90 after-hours calls. At a typical 18% after-hours answer rate, you're missing 74 calls. If even 40% of those are bookable emergencies at an average of $600, you're leaving <strong className="text-foreground">$17,760 per month</strong> on the table — over $213,000 annually.
            </p>
            <p className="text-muted-foreground leading-relaxed">
                You don't need to answer every call personally. You need a system — script, triage logic, and a way to dispatch true emergencies — that works while you sleep. Here's that system.
            </p>
        </section>

        <section id="script" className="mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-4">Copy/Paste After-Hours HVAC Script</h2>

            <CopyableScriptBlock
                title="After-Hours HVAC Answering Script"
                scenario="All calls received outside business hours"
                script={`"Thank you for calling [Company Name]. Our office is closed right now, but we're still here to help you.

Are you calling about a heating or cooling emergency — like no heat, no AC, a gas smell, or a carbon monoxide concern? Or is this something we can schedule during business hours?

[IF EMERGENCY — no heat, no AC in extreme weather, gas smell, CO alarm]

'I understand this is urgent. Let me get your information so I can reach our on-call technician:

- Your name?
- Your phone number?
- Your address?
- What's happening with your system right now?
- Is anyone in the home who is elderly, very young, or has a medical condition?

I'm going to contact our on-call tech right now. They'll call you back within 15 to 30 minutes with an ETA. Our after-hours emergency rate is [$XX], which applies toward any repair.

A few things while you wait:
- If you smell gas: leave the home immediately and call your gas company at [number].
- If your CO detector is going off: leave the home and call 911.
- If it's a no-heat situation: space heaters can help in the meantime — just keep them away from anything flammable.

We'll get you taken care of tonight.'

[IF NON-EMERGENCY — tune-up, filter, noise, minor concern]

'No problem at all. I can get you scheduled for our first available slot tomorrow.

- Your name?
- Best phone number?
- Can you briefly describe what's going on?

Great. I've got you down for [first available morning slot]. Someone from our team will call you to confirm in the morning. 

If anything changes or the situation becomes urgent overnight, don't hesitate to call us back.

Thank you for calling [Company Name] — we'll talk to you tomorrow!'"`}
            />
        </section>

        <section id="emergency-triage" className="mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-4">Emergency vs. Schedule-for-Morning Decision Guide</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
                Not every after-hours HVAC call needs an emergency dispatch. Here's a quick guide for your dispatcher (or AI receptionist) to determine whether to wake up the on-call tech:
            </p>
            <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-xl border-2 border-destructive/30 bg-destructive/5 p-5">
                    <h3 className="font-bold text-foreground mb-3">🚨 Dispatch Now</h3>
                    <ul className="list-disc pl-5 space-y-1.5 text-sm text-muted-foreground">
                        <li>No heat when outdoor temp is below 35°F</li>
                        <li>No AC when outdoor temp is above 95°F</li>
                        <li>Gas smell near HVAC equipment</li>
                        <li>CO detector alarm</li>
                        <li>Elderly, infant, or medically fragile person in home</li>
                        <li>Active water leak from HVAC system</li>
                    </ul>
                </div>
                <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-5">
                    <h3 className="font-bold text-foreground mb-3">🕐 Schedule for Morning</h3>
                    <ul className="list-disc pl-5 space-y-1.5 text-sm text-muted-foreground">
                        <li>Unusual noise but system is running</li>
                        <li>System running but not keeping up</li>
                        <li>Thermostat issues</li>
                        <li>Routine maintenance or tune-up</li>
                        <li>Filter replacement</li>
                        <li>Minor comfort concern (one room warm)</li>
                    </ul>
                </div>
            </div>
        </section>

        <section id="checklist" className="mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-4">After-Hours Intake Checklist</h2>
            <ChecklistBlock
                title="After-Hours HVAC Intake"
                items={[
                    "Caller name and callback number",
                    "Service address",
                    "Emergency or non-emergency? (based on triage guide above)",
                    "System type (furnace, AC, heat pump, mini-split)",
                    "Primary symptom (no heat, no cooling, leak, noise, smell)",
                    "Safety concern? (gas smell, CO alarm)",
                    "Vulnerable person in home? (elderly, infant, medical)",
                    "After-hours fee communicated",
                    "On-call tech notified (if emergency)",
                    "Morning appointment set (if non-emergency)",
                ]}
            />
        </section>

        <section id="faqs">
            <FAQSection faqs={faqs} />
        </section>

        <ResourceCTA variant="demo" trade="HVAC" />

        <RelatedResources
            resources={[
                { title: "HVAC Dispatcher Script Template", description: "Complete HVAC call scripts, benchmarks, and intake checklists.", href: "/resources/hvac-dispatcher-script-template/", tag: "Pillar" },
                { title: "HVAC Emergency Call Triage", description: "Triage guide for gas leaks, no-heat, and AC failures.", href: "/resources/hvac-emergency-call-triage/", tag: "HVAC" },
                { title: "Missed Call Revenue Calculator", description: "Calculate your monthly and annual lost revenue from missed calls.", href: "/resources/missed-call-revenue-calculator/", tag: "Calculator" },
            ]}
        />
    </ResourceLayout>
);

export default HvacAfterHoursScript;
