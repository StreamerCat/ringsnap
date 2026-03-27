import { ResourceLayout } from "@/components/resources/ResourceLayout";
import { CopyableScriptBlock } from "@/components/resources/CopyableScriptBlock";
import { ResourceCTA } from "@/components/resources/ResourceCTA";
import { RelatedResources } from "@/components/resources/RelatedResources";
import { BenchmarkTable } from "@/components/resources/BenchmarkTable";
import { FAQSection } from "@/components/resources/FAQSection";
import { ChecklistBlock } from "@/components/resources/ChecklistBlock";
import { Link } from "react-router-dom";

const toc = [
    { id: "safety-first", label: "Safety First: Screening Calls" },
    { id: "benchmarks", label: "Electrical Benchmarks" },
    { id: "call-script", label: "Electrician Call Script" },
    { id: "panel-upgrade", label: "Panel Upgrade Booking Script" },
    { id: "power-outage", label: "Power Outage Script" },
    { id: "safety-triage", label: "Safety Triage Checklist" },
    { id: "missed-call-revenue", label: "Missed Call Revenue" },
    { id: "after-hours", label: "After-Hours Without Burnout" },
    { id: "faqs", label: "FAQs" },
];

const benchmarks = [
    { metric: "Phone Answer Rate", industryAvg: "60%", topPerformer: "93%+" },
    { metric: "First-Call Booking Rate", industryAvg: "32%", topPerformer: "58%+" },
    { metric: "After-Hours Answer Rate", industryAvg: "12%", topPerformer: "88%+" },
    { metric: "Average Speed to Answer", industryAvg: "26 seconds", topPerformer: "Under 10 seconds" },
    { metric: "Emergency Call Conversion", industryAvg: "38%", topPerformer: "75%+" },
    { metric: "Average Service Call Value", industryAvg: "$320", topPerformer: "$550+" },
];

const faqs = [
    {
        question: "What are the most important questions to ask on an electrical call?",
        answer: "Safety questions come first: Do you smell burning? Do you see sparks or smoke? Is anyone in contact with the electrical source? Have you turned off the breaker? These determine whether you're dispatching an emergency or scheduling a service call. After safety, ask about the specific issue, home age, and panel type.",
    },
    {
        question: "How should dispatchers handle calls about sparking outlets?",
        answer: "Treat any sparking, burning smell, or visible smoke as a potential emergency. Instruct the caller to turn off the breaker to that circuit if they can do so safely. If they can't identify the breaker — or if the panel itself is sparking — tell them to leave the home and call 911 first, then save the line for follow-up dispatch once they're safe.",
    },
    {
        question: "Should electrical companies offer after-hours service?",
        answer: "Electricians have the lowest after-hours answer rate in the trades (12%). Yet electrical emergencies — panel fires, complete outages, sparking — are among the most urgent and highest-value calls. Offering reliable after-hours coverage, even if through an AI receptionist, positions you ahead of 88% of your competitors.",
    },
    {
        question: "How do I book more panel upgrade jobs over the phone?",
        answer: "Panel upgrades are rarely impulse calls. The customer is usually calling because they have a specific pain point: tripping breakers, flickering lights, wanting to add an EV charger or hot tub. Ask about these triggers, explain the safety and capacity implications, and frame the consult as educational: 'Our electrician will evaluate your panel and tell you exactly what you need — no surprises.'",
    },
    {
        question: "Can an AI handle electrical emergency triage?",
        answer: "Yes. AI receptionists like RingSnap can be programmed with safety triage scripts that ask the critical questions (sparking, smoke, burning smell), guide callers through breaker shutoff, and dispatch or transfer to your on-call electrician when needed. The AI follows the exact triage protocol you set, 24/7.",
    },
    {
        question: "How do I differentiate between a utility outage and a panel issue?",
        answer: "Your script should walk callers through a quick check: Are your neighbors' lights out too? Check your main breaker — is it tripped? Try flipping it off and back on. If the whole neighborhood is dark, it's a utility issue and you should direct them to their power company. If it's just their home, you have a dispatch opportunity.",
    },
];

const ElectricianCallScript = () => {
    const howToSchema = {
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: "Electrical Call Safety Triage Process",
        description: "Step-by-step safety triage process for handling electrical service calls.",
        step: [
            { "@type": "HowToStep", name: "Assess Immediate Danger", text: "Ask about sparking, smoke, burning smell, or anyone in contact with an electrical source." },
            { "@type": "HowToStep", name: "Guide Safety Action", text: "Direct caller to the breaker panel or advise leaving the home if panel is involved." },
            { "@type": "HowToStep", name: "Classify the Call", text: "Determine if this is an emergency dispatch, urgent same-day, or scheduled service." },
            { "@type": "HowToStep", name: "Capture & Dispatch", text: "Collect details, confirm appointment, explain pricing. Dispatch immediately for emergencies." },
        ],
    };

    return (
        <ResourceLayout
            title="Electrician Call Answering Script + Safety Triage Checklist (2026) | RingSnap"
            metaDescription="Free electrician call answering scripts for safety triage, panel upgrades, power outages, and after-hours calls. Includes safety triage checklist and booking benchmarks."
            canonical="/resources/electrician-call-answering-script/"
            keywords="electrician call answering script, electrician dispatcher script template, electrical emergency call script, electrical call intake checklist, panel upgrade booking script, power outage call script, electrician answering service, electrical safety triage questions"
            breadcrumbs={[
                { label: "Home", href: "/" },
                { label: "Resources", href: "/resources/" },
                { label: "Electrician Call Answering Script" },
            ]}
            toc={toc}
            schema={howToSchema}
            article={{ datePublished: "2026-01-15", dateModified: "2026-03-15" }}
        >
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">
                Electrician Call Answering Script + Safety Triage Checklist (2026)
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                Electrical calls carry higher safety stakes than any other trade. A bad triage can put someone's life at risk. A good triage can save a life and book a high-value job. Below are the scripts, triage checklists, and benchmarks that safety-conscious electrical shops use to handle every call right.
            </p>

            {/* Safety First */}
            <section id="safety-first" className="mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">Safety First: Screening Electrical Calls</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                    The first 30 seconds of an electrical call are the most important. Unlike HVAC or plumbing, an electrical issue can be life-threatening. Sparking outlets can start fires. Downed wires can electrocute. A malfunctioning panel can be an active fire hazard.
                </p>
                <p className="text-muted-foreground leading-relaxed mb-4">
                    Your dispatcher's first job isn't to book an appointment — it's to ensure the caller is safe. Every electrical call script should start with safety screening before moving to intake and scheduling.
                </p>
                <div className="rounded-xl border-2 border-destructive/30 bg-destructive/5 p-6 mb-4">
                    <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
                        <span className="text-destructive">⚠️</span> Immediate Transfer Triggers
                    </h3>
                    <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">
                        <li>Caller reports <strong className="text-foreground">active fire</strong> or <strong className="text-foreground">visible flames</strong> from an electrical source → Tell them to call 911 and leave the home</li>
                        <li>Caller or someone in the home is <strong className="text-foreground">in contact with a live wire</strong> or electrical source → Call 911 immediately</li>
                        <li>Caller reports <strong className="text-foreground">downed power line</strong> on their property → Call 911 and the power company, stay away from the line</li>
                        <li>Strong <strong className="text-foreground">burning smell</strong> from panel or walls with <strong className="text-foreground">visible discoloration</strong> → Turn off main breaker if safe, leave if unsure, call 911</li>
                    </ul>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                    Train every person who answers the phone on these triggers. They should be able to identify and respond to these scenarios without consulting a script — it needs to be instinct.
                </p>
            </section>

            {/* Benchmarks */}
            <section id="benchmarks" className="mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">Electrical Call Handling Benchmarks</h2>
                <BenchmarkTable
                    rows={benchmarks}
                    source="Aggregated from ServiceTitan, NECA, and IEC industry reports (2024-2025)"
                />
                <p className="text-muted-foreground leading-relaxed mt-4">
                    Electrical contractors have the lowest after-hours answer rate of any trade at just 12%. Yet electrical emergencies don't wait for business hours. Shops that solve after-hours coverage capture jobs their competitors literally cannot.
                </p>
            </section>

            {/* Call Script */}
            <section id="call-script" className="mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">Copy/Paste Electrician Call Script</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                    This script branches based on safety assessment. Start with the safety screening for every call before moving into scheduling.
                </p>

                <CopyableScriptBlock
                    title="Safety Concern Call Script"
                    scenario="Sparking, burning smell, panel issues, or other safety concerns"
                    script={`"Thanks for calling [Company Name], this is [Your Name]. How can I help you today?"

[If caller mentions sparking, smoke, burning smell, or anything suggesting active danger:]

"I want to make sure everyone is safe first. Let me ask a couple of quick questions:

1. Do you see any smoke, sparks, or flames right now?
2. Is anyone near the electrical issue or in contact with a wire?
3. Do you smell anything burning?

[IF IMMEDIATE DANGER — fire, active sparks, person in contact with electrical:]
'Please leave the area immediately and call 911. Do not touch anything electrical. I'll stay on the line if you need me, but your safety comes first.'

[IF POTENTIAL HAZARD — burning smell, hot outlet, discolored wall:]
'OK, here's what I'd like you to do: go to your breaker panel and turn off the breaker for that area — or the main breaker if you're not sure which one. That should stop the immediate risk while we get an electrician to you.

Let me get your information so I can dispatch someone:
- Your name and phone number?
- Your address?
- Which part of the home is the issue?
- How old is your home?

I'm marking this as a priority call. We can have an electrician there [within X hours]. Our emergency service fee is [$XX], applied toward the repair.

In the meantime, don't use that circuit or outlet. Our electrician will call you before they arrive.'"`}
                />

                <CopyableScriptBlock
                    title="Routine Service Call Script"
                    scenario="Non-emergency: outlet installation, lighting, code compliance, inspections"
                    script={`"Thanks for calling [Company Name], this is [Your Name]. How can I help you today?"

[Listen to request]

"I can definitely help you with that. Let me ask a few questions so I can send the right electrician:

- What specifically do you need done? (outlet install, lighting, panel inspection, etc.)
- Is this for your home or a business?
- About how old is the building?
- Do you know if it has 100-amp, 150-amp, or 200-amp service?
- Any permits or inspection requirements we should know about?

Great. I have availability [date/time options]. Our [service type] typically runs between [$X and $Y], and the electrician will give you a firm quote before starting any work.

Can I get your name, phone number, and address?

Perfect. You're scheduled for [day] between [time window]. Our electrician [Name] will call you about 30 minutes before arrival. Is there anything else I can help with?"`}
                />
            </section>

            <ResourceCTA variant="download" trade="electrical" service="electrical" />

            {/* Panel Upgrade */}
            <section id="panel-upgrade" className="mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">Panel Upgrade Booking Script</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                    Panel upgrades are high-ticket jobs ($2,000–$5,000+) that often come from callers who don't realize they need one. They call about tripping breakers, flickering lights, or wanting to add a circuit. Your script should educate them on why a panel evaluation makes sense.
                </p>

                <CopyableScriptBlock
                    title="Panel Upgrade Consultation Script"
                    scenario="Tripping breakers, capacity concerns, EV charger or addition planning"
                    script={`"Thanks for calling [Company Name]. It sounds like you might be running into a capacity issue — that's actually pretty common, especially in homes built before [year].

Let me ask a few questions to see what we're dealing with:
- How old is your home?
- Do you know what size panel you have? (100-amp, 150-amp, 200-amp?)
- What's been happening — are breakers tripping, lights flickering, or are you planning to add something new?
- Are you planning any additions — EV charger, hot tub, home office, or kitchen remodel?

[Based on answers:]

Based on what you're describing, it sounds like a panel evaluation would be the smart first step. Our electrician will inspect your current panel, test the load, and tell you exactly:
- Whether you need an upgrade or if there's a simpler fix
- What size panel you'd need for your current and future plans
- What the upgrade would cost, including permits and inspection

The evaluation is [$XX], and if we do the upgrade, that fee applies toward the work. I have availability [date/time]. Want me to get you on the schedule?"`}
                />
                <p className="text-muted-foreground leading-relaxed mt-4">
                    For more detail, see our <Link to="/resources/panel-upgrade-booking-script/" className="text-primary hover:underline">Panel Upgrade Booking Script</Link> guide.
                </p>
            </section>

            {/* Power Outage */}
            <section id="power-outage" className="mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">Power Outage Script</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                    Power outage calls are tricky because many of them aren't your job — they're utility company issues. A good script helps you differentiate quickly so you're only dispatching on jobs you can actually fix and billing for.
                </p>

                <CopyableScriptBlock
                    title="Power Outage Triage Script"
                    scenario="Caller reports partial or complete power loss"
                    script={`"Thanks for calling [Company Name]. I'm sorry you're dealing with a power issue. Let me help you figure out what's going on so we can get it resolved.

First, let me ask a couple of questions to determine if this is something we can fix or if it's a utility company issue:

1. Is the power out in your entire home, or just part of it?
2. Do your neighbors have power? (Can you see their lights?)
3. Have you checked your main breaker panel? Is the main breaker tripped?

[IF NEIGHBORHOOD IS OUT:]
'It sounds like this is a utility outage. I'd recommend calling [local utility company] at [number] to report it and get an ETA for restoration. If your power doesn't come back when the rest of the neighborhood does, give us a call back and we'll send someone out.'

[IF JUST THEIR HOME:]
'OK, so if it's just your home, the issue is likely in your panel, meter, or wiring. Let me ask a couple more questions:
- Can you try flipping the main breaker off and back on?
- Are any individual breakers tripped (flipped to the middle or off position)?
- Have you added any new appliances or devices recently?

[Based on response:]

It sounds like we should get an electrician out to diagnose this. I have availability [today/tomorrow]. The diagnostic fee is [$XX], applied toward the repair. Can I get your name and address?'"`}
                />
                <p className="text-muted-foreground leading-relaxed mt-4">
                    For more detail, check our <Link to="/resources/power-outage-call-script/" className="text-primary hover:underline">Power Outage Call Script</Link>.
                </p>
            </section>

            {/* Safety Triage Checklist */}
            <section id="safety-triage" className="mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">Safety Triage Checklist</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                    Post this next to every phone. Every electrical call should run through this checklist before you move to scheduling. Safety is non-negotiable.
                </p>

                <ChecklistBlock
                    title="Electrical Safety Triage Checklist"
                    items={[
                        "SAFETY: Do you see sparks, smoke, or flames? → If yes, call 911 + leave home",
                        "SAFETY: Is anyone in contact with an electrical source? → If yes, call 911",
                        "SAFETY: Do you smell burning from outlets, switches, or panel? → Turn off breaker",
                        "SAFETY: Is a power line down on your property? → Stay away, call 911 + utility",
                        "Caller's full name",
                        "Callback phone number",
                        "Service address (confirm city/zip)",
                        "Type of issue (panel, outlet, lighting, outage, safety concern, addition)",
                        "Home/building age",
                        "Panel type and size (if known)",
                        "Is the issue in one area or throughout the building?",
                        "Any recent electrical work or additions?",
                        "Access instructions (gate code, dog, lock box)",
                        "Urgency classification: Emergency / Same-Day / Scheduled",
                    ]}
                />
                <p className="text-muted-foreground leading-relaxed mt-4">
                    For standalone safety triage details, see <Link to="/resources/electrical-safety-triage-questions/" className="text-primary hover:underline">Electrical Safety Triage Questions</Link>.
                </p>
            </section>

            {/* Missed Call Revenue */}
            <section id="missed-call-revenue" className="mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">Missed Call Revenue Example</h2>
                <div className="rounded-xl border border-border bg-card p-6 mb-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><span className="text-muted-foreground">Monthly inbound calls:</span></div>
                        <div className="font-semibold">200</div>
                        <div><span className="text-muted-foreground">Current answer rate:</span></div>
                        <div className="font-semibold">60%</div>
                        <div><span className="text-muted-foreground">Missed calls per month:</span></div>
                        <div className="font-semibold text-destructive">80</div>
                        <div><span className="text-muted-foreground">Booking rate on answered calls:</span></div>
                        <div className="font-semibold">32%</div>
                        <div><span className="text-muted-foreground">Average job value:</span></div>
                        <div className="font-semibold">$450</div>
                        <div className="border-t border-border pt-2 col-span-2"></div>
                        <div><span className="font-semibold text-foreground">Lost jobs per month:</span></div>
                        <div className="font-bold text-destructive">~26</div>
                        <div><span className="font-semibold text-foreground">Lost revenue per month:</span></div>
                        <div className="font-bold text-destructive">$11,520</div>
                        <div><span className="font-semibold text-foreground">Lost revenue per year:</span></div>
                        <div className="font-bold text-destructive">$138,240</div>
                    </div>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                    Run your exact numbers with our{" "}
                    <Link to="/resources/missed-call-revenue-calculator/" className="text-primary hover:underline">
                        Missed Call Revenue Calculator
                    </Link>.
                </p>
            </section>

            {/* After-Hours */}
            <section id="after-hours" className="mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">Route After-Hours Calls Without Burnout</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                    After-hours coverage is the electrical trade's biggest gap — and biggest opportunity. But most electrical shop owners don't want to be the one answering the phone at midnight. Here's how to cover after-hours without burning out:
                </p>
                <ul className="list-disc pl-6 space-y-3 text-muted-foreground">
                    <li><strong className="text-foreground">Rotating on-call schedule.</strong> If you have multiple electricians, rotate weekly. The on-call person gets a premium per call or a flat on-call fee — $50–$100/night is standard.</li>
                    <li><strong className="text-foreground">AI receptionist for screening.</strong> Tools like RingSnap can answer every after-hours call, run through your safety triage checklist, and only escalate genuine emergencies to your on-call person. Non-emergencies get scheduled for the morning — no 2 AM wake-up for a tripping breaker.</li>
                    <li><strong className="text-foreground">Clear emergency criteria.</strong> Define exactly what constitutes an after-hours emergency for your shop: active sparking, complete home outage, safety hazard. Everything else waits for business hours. Put this in your script.</li>
                    <li><strong className="text-foreground">Premium pricing for after-hours.</strong> Your emergency rate should be 1.5x–2x your standard rate. Customers in genuine emergencies expect this and will pay it. It also prevents non-urgent callers from requesting after-hours service when they could wait.</li>
                </ul>
            </section>

            {/* FAQs */}
            <section id="faqs">
                <FAQSection faqs={faqs} />
            </section>

            <ResourceCTA variant="demo" trade="electrical" service="electrical" />

            <RelatedResources
                resources={[
                    {
                        title: "Electrical Safety Triage Questions",
                        description: "The 8 safety questions every dispatcher should ask on electrical calls.",
                        href: "/resources/electrical-safety-triage-questions/",
                        tag: "Electrical",
                    },
                    {
                        title: "Panel Upgrade Booking Script",
                        description: "Book panel upgrade consultations from capacity and EV charger inquiries.",
                        href: "/resources/panel-upgrade-booking-script/",
                        tag: "Electrical",
                    },
                    {
                        title: "Power Outage Call Script",
                        description: "Differentiate utility outages from panel issues and dispatch only when needed.",
                        href: "/resources/power-outage-call-script/",
                        tag: "Electrical",
                    },
                ]}
            />
        </ResourceLayout>
    );
};

export default ElectricianCallScript;
