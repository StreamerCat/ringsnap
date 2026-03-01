import { ResourceLayout } from "@/components/resources/ResourceLayout";
import { CopyableScriptBlock } from "@/components/resources/CopyableScriptBlock";
import { ResourceCTA } from "@/components/resources/ResourceCTA";
import { RelatedResources } from "@/components/resources/RelatedResources";
import { BenchmarkTable } from "@/components/resources/BenchmarkTable";
import { FAQSection } from "@/components/resources/FAQSection";
import { ChecklistBlock } from "@/components/resources/ChecklistBlock";
import { Link } from "react-router-dom";

const toc = [
    { id: "why-different", label: "Why Plumbing Calls Are Different" },
    { id: "benchmarks", label: "Plumbing Benchmarks" },
    { id: "emergency-script", label: "Emergency Scripts" },
    { id: "drain-cleaning", label: "Drain Cleaning Booking Script" },
    { id: "after-hours", label: "After-Hours Reassurance Script" },
    { id: "intake-checklist", label: "Emergency Intake Checklist" },
    { id: "missed-call-revenue", label: "Missed Call Revenue" },
    { id: "reduce-no-shows", label: "Reduce No-Shows" },
    { id: "faqs", label: "FAQs" },
];

const benchmarks = [
    { metric: "Phone Answer Rate", industryAvg: "58%", topPerformer: "94%+" },
    { metric: "Emergency Call Booking Rate", industryAvg: "42%", topPerformer: "80%+" },
    { metric: "After-Hours Answer Rate", industryAvg: "15%", topPerformer: "92%+" },
    { metric: "Average Speed to Answer", industryAvg: "28 seconds", topPerformer: "Under 8 seconds" },
    { metric: "No-Show Rate", industryAvg: "18%", topPerformer: "Under 5%" },
    { metric: "Average Emergency Job Value", industryAvg: "$385", topPerformer: "$650+" },
];

const faqs = [
    {
        question: "How should dispatchers handle burst pipe calls?",
        answer: "Priority one: walk the caller through shutting off the main water supply. This stops the damage clock. Then capture their address, assess the scope (how much water, which floor, is the ceiling sagging), and dispatch immediately. Never ask non-essential questions while water is actively flowing — every minute of delay means more damage and a more expensive repair for the homeowner.",
    },
    {
        question: "Should plumbing shops charge more for emergency calls?",
        answer: "Yes, and customers expect it. Be transparent about the emergency dispatch fee upfront in the script: 'Our emergency dispatch fee is $XX, which covers getting a licensed plumber to you within [timeframe]. That fee applies toward any repair we do.' Transparency builds trust. Being evasive about pricing erodes it.",
    },
    {
        question: "How do I reduce plumbing appointment no-shows?",
        answer: "Three proven tactics: (1) Send a text confirmation immediately after booking with the date, time, and tech's name. (2) Send a reminder 24 hours before the appointment. (3) Have the tech call 30 minutes before arrival. Shops that do all three see no-show rates drop from 18% to under 5%.",
    },
    {
        question: "What's the best way to handle sewer backup calls?",
        answer: "Sewer backups are health hazards, so treat them with urgency. Your script should cover: (1) Ask if sewage is actively flowing into the home. (2) Advise them to avoid using any drains or toilets. (3) If sewage is in a living area, advise them to keep children and pets away. (4) Dispatch immediately — these calls should never wait.",
    },
    {
        question: "Can an AI receptionist handle plumbing emergency calls?",
        answer: "Yes. AI receptionists like RingSnap can be configured with emergency triage scripts that walk callers through safety steps (like shutting off the water main), capture all intake information, and dispatch or transfer to your on-call plumber — all within 60 seconds, 24/7.",
    },
    {
        question: "How many after-hours plumbing calls turn into jobs?",
        answer: "For shops that actually answer after-hours calls, the booking rate is significantly higher than daytime calls — often 60-80% — because after-hours callers are dealing with active emergencies. The catch is that most shops don't answer these calls at all, sending 85% of their highest-value leads to voicemail or a competitor.",
    },
];

const PlumbingDispatcherScript = () => {
    const howToSchema = {
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: "Plumbing Emergency Call Handling Flow",
        description: "Step-by-step process for handling plumbing emergency calls.",
        step: [
            { "@type": "HowToStep", name: "Assess Urgency", text: "Determine if water is actively flowing or if sewage is present. Safety first." },
            { "@type": "HowToStep", name: "Guide Immediate Action", text: "Walk the caller through shutting off the water main or avoiding affected areas." },
            { "@type": "HowToStep", name: "Capture Key Details", text: "Name, address, phone, nature of emergency, scope of water/damage." },
            { "@type": "HowToStep", name: "Dispatch & Confirm", text: "Dispatch your on-call plumber, confirm ETA, and explain the emergency fee." },
        ],
    };

    return (
        <ResourceLayout
            title="Plumbing Dispatcher Script Template + Emergency Call Intake (2026) | RingSnap"
            metaDescription="Free plumbing dispatcher scripts for burst pipes, sewer backups, drain cleaning, and after-hours calls. Includes emergency intake checklist and booking benchmarks."
            canonical="/resources/plumbing-dispatcher-script-template/"
            keywords="plumbing dispatcher script template, plumbing call center script, plumbing emergency call script, plumbing call intake checklist, after hours plumbing answering script, burst pipe phone script, sewer backup phone script, drain cleaning booking script, plumber missed calls"
            breadcrumbs={[
                { label: "Home", href: "/" },
                { label: "Resources", href: "/resources/" },
                { label: "Plumbing Dispatcher Script Template" },
            ]}
            toc={toc}
            schema={howToSchema}
        >
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">
                Plumbing Dispatcher Script Template + Emergency Call Intake (2026)
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                Plumbing calls are different from any other trade. Water damage gets worse by the minute. Sewer backups are health hazards. Callers are panicking. Your dispatcher scripts need to handle urgency, guide immediate action, and get a truck rolling — fast. Here are the exact scripts and checklists top plumbing shops use.
            </p>

            {/* Why Plumbing Calls Are Different */}
            <section id="why-different" className="mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">Why Plumbing Calls Are Different</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                    HVAC callers usually have a problem that's uncomfortable but not actively destructive. Electrical callers worry about safety but can flip a breaker while they wait. Plumbing callers? They're watching water pour through their ceiling, sewage back up into their bathtub, or their water heater fail before a houseful of guests arrives.
                </p>
                <p className="text-muted-foreground leading-relaxed mb-4">
                    This creates three dynamics that your scripts must account for:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
                    <li><strong className="text-foreground">Damage is actively worsening.</strong> Every minute you spend on the phone, the repair bill grows. Your script must prioritize stopping the damage (guiding the caller to the shutoff valve) before capturing intake information.</li>
                    <li><strong className="text-foreground">Callers are emotionally escalated.</strong> A burst pipe at 2 AM triggers a panic response. Your script needs reassurance language — not just efficiency. "We're going to take care of this" reduces caller anxiety and prevents them from calling the next plumber on the list.</li>
                    <li><strong className="text-foreground">Emergency plumbing has the highest job values.</strong> A burst pipe repair with water damage remediation can easily run $2,000–$8,000. After-hours sewer line jobs routinely top $3,000. These are the calls you absolutely cannot afford to miss or mishandle.</li>
                    <li><strong className="text-foreground">Health and safety stakes are real.</strong> Sewer backups involve biohazards. Gas water heater issues can involve carbon monoxide. Your dispatcher needs to triage for safety, not just schedule an appointment.</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed">
                    The scripts below are built for this reality — fast, safety-conscious, and designed to keep panicked callers on the line until you've got them booked.
                </p>
            </section>

            {/* Benchmarks */}
            <section id="benchmarks" className="mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">Plumbing Call Handling Benchmarks</h2>
                <BenchmarkTable
                    rows={benchmarks}
                    source="Aggregated from ServiceTitan, Jobber, and PHCC industry data (2024-2025)"
                />
                <p className="text-muted-foreground leading-relaxed mt-4">
                    Notice the gap in after-hours answer rate: 15% vs. 92%. That gap represents the single biggest revenue opportunity for most plumbing shops. The calls are coming in — you're just not picking up.
                </p>
            </section>

            {/* Emergency Scripts */}
            <section id="emergency-script" className="mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">Copy/Paste Plumbing Emergency Scripts</h2>

                <CopyableScriptBlock
                    title="Burst Pipe Emergency Script"
                    scenario="Active water leak or burst pipe"
                    script={`"Thanks for calling [Company Name]. I can hear this is urgent — let me help you right now.

Is water actively flowing right now? 

[IF YES]
OK, here's what I need you to do immediately: find your main water shutoff valve. It's usually near your water meter, in the basement, crawl space, or near the street. Turn it clockwise — righty-tighty — until it stops. That will stop the water.

[Wait for them to do it]

Great. Is the water stopped? Good — you just prevented a lot of additional damage.

Now let me get your information so I can dispatch a plumber to you right away:
- Your name?
- Your address?
- Best phone number?
- Can you tell me where the pipe burst — kitchen, bathroom, basement?
- How much water are we looking at?

OK, I'm dispatching a plumber to you now. They'll be there within [X hours/minutes]. Our emergency dispatch fee is [$XX], which gets applied to the repair. 

In the meantime, if you can safely do so, move any valuables or electronics away from the water. Do NOT use any electrical outlets near the water.

Our plumber will call you about 15 minutes before they arrive. We'll take care of this for you."`}
                />

                <CopyableScriptBlock
                    title="Sewer Backup Emergency Script"
                    scenario="Sewage coming up through drains or toilets"
                    script={`"Thanks for calling [Company Name]. A sewer backup is something we take very seriously — let me get you help right away.

First, a few safety questions:
- Is sewage actively coming up into your home?
- Which drains are affected?
- Do you have children or pets in the house?

[IF SEWAGE IN LIVING AREAS]
OK, I need you to keep everyone — especially children and pets — away from the affected area. Sewage water carries bacteria and should not be touched without gloves. Don't use any drains, toilets, or run any water until our plumber gets there.

Let me get your details:
- Your name and address?
- Your phone number?
- Is this a single story or multi-story home?
- Any previous sewer issues?

I'm marking this as a priority dispatch. Our plumber will be there within [X time]. The emergency service fee is [$XX], applied toward the repair.

Please don't try to clean up the sewage yourself — our team will handle it safely. Is there anything else I can help with right now?"`}
                />

                <CopyableScriptBlock
                    title="No Hot Water Script"
                    scenario="Water heater failure"
                    script={`"Thanks for calling [Company Name], this is [Your Name]. Sorry to hear about the hot water situation — let me see what we can do.

A few quick questions:
- Is your water heater gas or electric?
- [IF GAS] Do you smell gas anywhere near the water heater? [If yes: 'Please leave the area, don't flip any switches, and call your gas company. I'll stay on the line with you.']
- About how old is the water heater?
- Are you seeing any water around the base of the unit?
- Have you checked the pilot light (gas) or breaker panel (electric)?

[Based on answers, determine urgency]

Based on what you're describing, [this sounds like it could be a simple fix / we should get a plumber out to diagnose it / we'll want to check that unit before a larger issue develops].

I have availability [today/tomorrow]. Our diagnostic fee is [$XX], which goes toward any repair or replacement. Can I get you on the schedule?"`}
                />
            </section>

            <ResourceCTA variant="download" trade="plumbing" service="plumbing" />

            {/* Drain Cleaning Booking Script */}
            <section id="drain-cleaning" className="mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">Drain Cleaning Booking Script</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                    Drain cleaning calls are your bread-and-butter — and your best upsell opportunity. A simple drain clearing can lead to a camera inspection, which can lead to a line repair or replacement worth 10x the original call. Your script should plant these seeds without being pushy.
                </p>

                <CopyableScriptBlock
                    title="Drain Cleaning Booking Script"
                    scenario="Slow drain, clogged drain, or recurring backup"
                    script={`"Thanks for calling [Company Name]. Let me help you get that drain taken care of.

Can you tell me which drain is giving you trouble?
- Kitchen sink, bathroom, shower, toilet, main line?
- Is it draining slowly, completely clogged, or backing up?
- Have you noticed this happening more than once recently?
- Have you tried anything so far — like a plunger or drain cleaner?

[If recurring:] "When drains keep backing up, it's usually a sign there's something going on further down the line that a basic clearing won't fix. Our plumbers bring a camera so we can see exactly what's happening inside the pipe — tree roots, buildup, or a damaged section. That way we fix it once instead of having you call us again next month."

I have availability [today/tomorrow]. Our drain clearing starts at [$XX], and if we run the camera, there's an additional [$XX] for the inspection. Most customers do both since we're already there.

Can I get your name and address to get you on the schedule?"`}
                />
                <p className="text-muted-foreground leading-relaxed mt-4">
                    For detailed upsell strategies, see our <Link to="/resources/drain-cleaning-upsell-script/" className="text-primary hover:underline">Drain Cleaning Upsell Script</Link>.
                </p>
            </section>

            {/* After-Hours */}
            <section id="after-hours" className="mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">After-Hours Reassurance Script</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                    After-hours plumbing callers are almost always dealing with an emergency. They're stressed, it's late, and they need someone to tell them it's going to be OK. Your script should reassure first, triage second, and book third.
                </p>

                <CopyableScriptBlock
                    title="After-Hours Plumbing Script"
                    scenario="Calls outside business hours"
                    script={`"Thank you for calling [Company Name]. I know calling a plumber at this hour means something serious is going on — let me help.

Can you tell me what's happening?

[LISTEN — let them describe the situation fully before asking questions]

OK, here's what we're going to do. [Reassurance statement based on scenario]:
- Burst pipe: "You did the right thing calling. Let me walk you through shutting off the water, and then I'll get a plumber headed your way."
- Sewer backup: "I know that's stressful. Let's keep everyone safe and get a plumber to you quickly."
- No hot water: "That's frustrating, especially at this hour. Let me see how fast we can get someone to you."

Let me grab your information:
- Name, address, phone number?
- What's the situation — what do you see?

I'm reaching out to our on-call plumber now. You should hear from them within [15-30 minutes] with an ETA. Our after-hours fee is [$XX], applied toward the repair.

Is there anything else I can help with while you wait? Hang in there — we'll get this sorted out."`}
                />
            </section>

            {/* Intake Checklist */}
            <section id="intake-checklist" className="mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">Emergency Call Intake Checklist</h2>
                <ChecklistBlock
                    title="Plumbing Emergency Intake Checklist"
                    items={[
                        "Caller's full name",
                        "Callback phone number",
                        "Service address (confirm city/zip)",
                        "SAFETY CHECK: Gas smell? Standing water near electrical? Sewage in living area?",
                        "Type of emergency (burst pipe, sewer backup, no hot water, gas water heater issue)",
                        "Is water actively flowing? Has shutoff valve been turned?",
                        "Location of the issue (which room/floor)",
                        "Scope of water damage (estimated area, ceiling dripping, flooring affected)",
                        "Home type (single story, multi-story, basement, crawl space, slab)",
                        "Previous plumbing issues at this address?",
                        "Access instructions (gate code, dog, lock box)",
                        "Preferred contact method for ETA updates",
                        "Emergency dispatch fee communicated? (Y/N)",
                    ]}
                />
            </section>

            {/* Missed Call Revenue */}
            <section id="missed-call-revenue" className="mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">Missed Call Revenue Example</h2>
                <div className="rounded-xl border border-border bg-card p-6 mb-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><span className="text-muted-foreground">Monthly inbound calls:</span></div>
                        <div className="font-semibold">250</div>
                        <div><span className="text-muted-foreground">Current answer rate:</span></div>
                        <div className="font-semibold">58%</div>
                        <div><span className="text-muted-foreground">Missed calls per month:</span></div>
                        <div className="font-semibold text-destructive">105</div>
                        <div><span className="text-muted-foreground">Emergency call %:</span></div>
                        <div className="font-semibold">35%</div>
                        <div><span className="text-muted-foreground">Average emergency job value:</span></div>
                        <div className="font-semibold">$650</div>
                        <div className="border-t border-border pt-2 col-span-2"></div>
                        <div><span className="font-semibold text-foreground">Lost emergency jobs/month:</span></div>
                        <div className="font-bold text-destructive">~15</div>
                        <div><span className="font-semibold text-foreground">Lost revenue per month:</span></div>
                        <div className="font-bold text-destructive">$9,750</div>
                        <div><span className="font-semibold text-foreground">Lost revenue per year:</span></div>
                        <div className="font-bold text-destructive">$117,000</div>
                    </div>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                    And that's just emergency calls. Factor in routine service calls and you're likely leaving $150K+ on the table annually. Use our{" "}
                    <Link to="/resources/missed-call-revenue-calculator/" className="text-primary hover:underline">
                        Missed Call Revenue Calculator
                    </Link>{" "}
                    to see your exact numbers.
                </p>
            </section>

            {/* Reduce No-Shows */}
            <section id="reduce-no-shows" className="mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">Reduce No-Shows and Improve Close Rate</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                    Booking the call is only half the battle. The other half is making sure the customer is home when your plumber arrives and that the plumber closes the job. Here's what top-performing shops do differently:
                </p>
                <ul className="list-disc pl-6 space-y-3 text-muted-foreground">
                    <li><strong className="text-foreground">Instant text confirmation.</strong> Within 60 seconds of booking, send a text with the appointment date, time window, and tech's name. This makes the appointment feel real and committed.</li>
                    <li><strong className="text-foreground">24-hour reminder.</strong> Automated text or call the day before: "Reminder: [Tech Name] from [Company] will be at your home tomorrow between [time window]."</li>
                    <li><strong className="text-foreground">30-minute ETA call from the tech.</strong> This dramatically reduces no-shows and "I forgot" cancellations. It also sets the professional tone for the visit.</li>
                    <li><strong className="text-foreground">Collect a credit card for emergencies.</strong> For after-hours and emergency dispatches, collecting a card upfront reduces no-shows to near zero. Frame it as: "To confirm the emergency dispatch, I'll need a card on file. You won't be charged until the work is complete."</li>
                    <li><strong className="text-foreground">Train techs on next-step selling.</strong> A drain cleaning should always end with a camera inspection recommendation. A water heater repair should include a conversation about the unit's age and replacement timeline. This isn't upselling — it's professional service.</li>
                </ul>
            </section>

            {/* FAQs */}
            <section id="faqs">
                <FAQSection faqs={faqs} />
            </section>

            <ResourceCTA variant="demo" trade="plumbing" service="plumbing" />

            <RelatedResources
                resources={[
                    {
                        title: "Burst Pipe Call Script",
                        description: "Step-by-step script for handling burst pipe emergencies on the phone.",
                        href: "/resources/burst-pipe-call-script/",
                        tag: "Plumbing",
                    },
                    {
                        title: "Sewer Backup Call Script",
                        description: "Safety-first script for sewer backup calls with health hazard guidance.",
                        href: "/resources/sewer-backup-call-script/",
                        tag: "Plumbing",
                    },
                    {
                        title: "Drain Cleaning Upsell Script",
                        description: "Turn a drain clearing into a full-value visit with camera inspections.",
                        href: "/resources/drain-cleaning-upsell-script/",
                        tag: "Plumbing",
                    },
                ]}
            />
        </ResourceLayout>
    );
};

export default PlumbingDispatcherScript;
