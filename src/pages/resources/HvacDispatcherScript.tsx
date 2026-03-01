import { ResourceLayout } from "@/components/resources/ResourceLayout";
import { CopyableScriptBlock } from "@/components/resources/CopyableScriptBlock";
import { ResourceCTA } from "@/components/resources/ResourceCTA";
import { RelatedResources } from "@/components/resources/RelatedResources";
import { BenchmarkTable } from "@/components/resources/BenchmarkTable";
import { FAQSection } from "@/components/resources/FAQSection";
import { ChecklistBlock } from "@/components/resources/ChecklistBlock";
import { Link } from "react-router-dom";

const toc = [
    { id: "why-shops-lose", label: "Why HVAC Shops Lose Jobs" },
    { id: "benchmarks", label: "Call Handling Benchmarks" },
    { id: "call-flow", label: "The HVAC Call Flow (4 Steps)" },
    { id: "dispatcher-script", label: "Dispatcher Script Template" },
    { id: "price-shopper", label: "Price Shopper Script" },
    { id: "after-hours", label: "After-Hours Script" },
    { id: "intake-checklist", label: "Call Intake Checklist" },
    { id: "missed-call-revenue", label: "Missed Call Revenue" },
    { id: "track-improve", label: "Track & Improve Booking Rate" },
    { id: "faqs", label: "FAQs" },
];

const benchmarks = [
    { metric: "Phone Answer Rate", industryAvg: "62%", topPerformer: "95%+" },
    { metric: "First-Call Booking Rate", industryAvg: "28%", topPerformer: "55–65%" },
    { metric: "Average Speed to Answer", industryAvg: "24 seconds", topPerformer: "Under 10 seconds" },
    { metric: "After-Hours Answer Rate", industryAvg: "18%", topPerformer: "90%+" },
    { metric: "Call Abandonment Rate", industryAvg: "22%", topPerformer: "Under 5%" },
    { metric: "Average Revenue per Inbound Call", industryAvg: "$85", topPerformer: "$180+" },
];

const faqs = [
    {
        question: "How long should an HVAC dispatcher script be?",
        answer: "Keep it under 90 seconds for routine calls. The goal is to capture key information — name, address, system type, symptom — and confirm the appointment. Longer scripts lead to caller drop-off. Emergency calls should be even shorter: capture the safety concern, dispatch or transfer, and confirm an ETA.",
    },
    {
        question: "Should I use a different script for after-hours calls?",
        answer: "Yes. After-hours callers are usually dealing with an urgent situation (no heat in winter, no AC during a heatwave). Your after-hours script should acknowledge the urgency, triage the situation for safety, and either dispatch immediately or set a first-available appointment with a clear ETA. Avoid asking non-essential questions at 2 AM.",
    },
    {
        question: "How do I handle price shoppers without losing them?",
        answer: "Never lead with a price. Acknowledge their question, then pivot to understanding their issue: 'Great question — so I can give you the most accurate answer, can I ask a couple of quick questions about your system?' Once you understand the problem, frame your value: diagnostic expertise, warranty, same-day availability. Then offer a range, not a firm quote.",
    },
    {
        question: "What booking rate should my HVAC shop target?",
        answer: "Industry average is around 28%. Top-performing shops with trained dispatchers and good scripts hit 55–65%. If you're below 40%, start by recording calls, identifying where callers drop off, and testing script changes one section at a time.",
    },
    {
        question: "Can an AI receptionist use these scripts?",
        answer: "Yes. Services like RingSnap let you configure your AI receptionist with custom scripts — including intake questions, emergency triage logic, and price-handling language. The AI follows the exact call flow you set, 24/7, with zero hold times and consistent execution.",
    },
    {
        question: "How many calls does the average HVAC company miss per week?",
        answer: "Studies show that HVAC companies miss 20–40% of inbound calls, depending on crew size and call volume. For a shop receiving 80 calls per week, that's 16–32 missed calls — each worth an average of $350–$500 in potential revenue.",
    },
];

const HvacDispatcherScript = () => {
    const howToSchema = {
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: "HVAC Call Flow: 4 Steps to Book Every Call",
        description: "A step-by-step call flow for HVAC dispatchers to consistently book service calls.",
        step: [
            { "@type": "HowToStep", name: "Greet & Identify", text: "Answer within 3 rings. Use the company name and your first name. Ask how you can help today." },
            { "@type": "HowToStep", name: "Qualify the Call", text: "Determine if the call is an emergency, maintenance, or new install. Capture the system type and primary symptom." },
            { "@type": "HowToStep", name: "Capture Information", text: "Collect name, address, phone number, system details, and preferred appointment window." },
            { "@type": "HowToStep", name: "Confirm & Set Expectations", text: "Repeat the appointment time, provide a technician ETA, and explain what to expect on the visit." },
        ],
    };

    return (
        <ResourceLayout
            title="HVAC Dispatcher Script Template + Call Intake Checklist (2026) | RingSnap"
            metaDescription="Free copy/paste HVAC dispatcher scripts for booking calls, handling price shoppers, after-hours coverage, and emergency triage. Includes call intake checklist and benchmarks."
            canonical="/resources/hvac-dispatcher-script-template/"
            keywords="hvac dispatcher script template, hvac call booking script, hvac call scripts, hvac call intake checklist, after hours hvac answering script, hvac phone answering script, hvac price shopper script, hvac emergency call script, hvac booking rate, hvac missed calls"
            breadcrumbs={[
                { label: "Home", href: "/" },
                { label: "Resources", href: "/resources/" },
                { label: "HVAC Dispatcher Script Template" },
            ]}
            toc={toc}
            schema={howToSchema}
        >
            {/* H1 */}
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">
                HVAC Dispatcher Script Template + Call Intake Checklist (2026)
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                Every missed or mishandled call costs your HVAC shop $350–$500 in lost revenue. Below you'll find the exact dispatcher scripts, intake checklists, and benchmarks that top-performing shops use to book 55%+ of inbound calls — ready to copy, paste, and start using today.
            </p>

            {/* Why HVAC Shops Lose Booked Jobs on the Phone */}
            <section id="why-shops-lose" className="mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">Why HVAC Shops Lose Booked Jobs on the Phone</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                    The average HVAC company answers only 62% of inbound calls. Of the calls that do get answered, fewer than 1 in 3 result in a booked appointment. That means for every 100 calls your phone rings, you're booking roughly 18 jobs — and losing 82 potential customers to competitors who simply pick up the phone faster.
                </p>
                <p className="text-muted-foreground leading-relaxed mb-4">
                    The reasons are painfully consistent across the industry:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
                    <li><strong className="text-foreground">Techs answering the phone mid-job.</strong> They're distracted, rushed, and can't give the caller proper attention. The customer hears background noise and gets a vague "we'll try to get someone out there" instead of a confirmed appointment.</li>
                    <li><strong className="text-foreground">No script or call structure.</strong> Every person who touches the phone handles calls differently. One office manager books at 50%; another at 15%. Without a script, your booking rate is a lottery.</li>
                    <li><strong className="text-foreground">Price shoppers get a price and hang up.</strong> When a caller asks "how much for a tune-up?" and your team gives a flat number, the caller has zero reason to book with you versus the next company on Google.</li>
                    <li><strong className="text-foreground">After-hours calls go to voicemail.</strong> 78% of callers who reach voicemail hang up and call the next contractor. They don't leave a message — they leave your funnel.</li>
                    <li><strong className="text-foreground">No triage for emergencies.</strong> A no-heat call in January gets treated the same as a filter replacement request. The customer with the $2,000 repair hears "we can come next Tuesday" and calls someone who can come tonight.</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed">
                    The fix isn't complicated. It starts with a script that your entire team follows — consistently, on every call, including after hours.
                </p>
            </section>

            {/* Benchmarks */}
            <section id="benchmarks" className="mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">HVAC Call Handling Benchmarks</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                    Before you can improve, you need to know where you stand. Here's how the average HVAC shop compares to top performers:
                </p>
                <BenchmarkTable
                    rows={benchmarks}
                    source="Aggregated from ServiceTitan, Housecall Pro, and ACCA industry reports (2024-2025)"
                />
                <p className="text-muted-foreground leading-relaxed mt-4">
                    If your numbers are closer to the left column, every percentage point you move toward the right column directly translates to more booked jobs and more revenue — without spending another dollar on marketing.
                </p>
            </section>

            {/* 4-Step Call Flow */}
            <section id="call-flow" className="mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">The HVAC Call Flow (4 Steps)</h2>
                <p className="text-muted-foreground leading-relaxed mb-6">
                    Every successful call follows the same four-step structure. Nail this flow and your booking rate will climb, regardless of who's answering the phone.
                </p>
                <div className="grid gap-4 mb-6">
                    {[
                        { step: "1", title: "Greet & Identify", desc: "Answer within 3 rings. Use your company name and first name: 'Thanks for calling [Company Name], this is [Name], how can I help you today?' Warm, professional, fast." },
                        { step: "2", title: "Qualify the Call", desc: "Determine urgency: Is this an emergency (no heat, gas smell, CO detector)? Routine maintenance? New install request? This determines which script path you follow and how fast you need to act." },
                        { step: "3", title: "Capture Information", desc: "Collect the essentials: name, address, callback number, system type/age if known, primary symptom, and preferred appointment window. Use the intake checklist below — don't rely on memory." },
                        { step: "4", title: "Confirm & Set Expectations", desc: "Repeat the appointment time. Provide a tech ETA or arrival window. Explain what the tech will do on-site. Thank them and give them a direct callback number. Done." },
                    ].map((item) => (
                        <div key={item.step} className="flex gap-4 p-4 rounded-xl border border-border bg-card">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                                {item.step}
                            </div>
                            <div>
                                <h3 className="font-semibold text-foreground mb-1">{item.title}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Dispatcher Scripts */}
            <section id="dispatcher-script" className="mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">Copy/Paste HVAC Dispatcher Script Template</h2>
                <p className="text-muted-foreground leading-relaxed mb-6">
                    These scripts are designed to be read naturally — not robotically. Train your team to use them as a guide, hitting every key point while keeping their own conversational tone.
                </p>

                <CopyableScriptBlock
                    title="Standard Inbound Call Script"
                    scenario="AC repair, tune-up, equipment concern"
                    script={`"Thanks for calling [Company Name], this is [Your Name]. How can I help you today?"

[Listen to the customer's concern]

"I can definitely help you with that. Let me grab a few quick details so we can get someone out to you.

Can I get your name?
And the best phone number to reach you?
What's the service address?

Great. Can you tell me a little more about what's going on?
- What kind of system do you have — central air, heat pump, furnace, mini-split?
- About how old is the unit, roughly?
- When did you first notice the issue?

Perfect. Based on what you're describing, I'd recommend we send a tech out to diagnose it properly. We have availability [date/time options]. Which works best for you?

Great, I've got you scheduled for [day] between [time window]. Our technician [Name] will give you a call about 30 minutes before arrival. The diagnostic fee is [$XX], which gets applied toward any repair we do.

Is there anything else I can help with? … Thank you for calling [Company Name]. We'll see you on [day]!"`}
                />

                <CopyableScriptBlock
                    title="Emergency / No-Heat / No-AC Script"
                    scenario="Urgent: system down in extreme weather"
                    script={`"Thanks for calling [Company Name], this is [Your Name]. I understand you're dealing with [no heat / no AC] — let me help you right away.

First, is anyone in the home who is elderly, very young, or has a medical condition? [If yes, prioritize dispatch]

Can I get your name and address?

OK — a few quick questions so I can get the right tech to you fast:
- Do you smell gas or hear any unusual sounds from the unit?
- What type of system do you have?
- Have you checked your thermostat settings and breaker panel?

[If gas smell: 'Please leave the home immediately, do not flip any switches, and call your gas company. I'm noting this as an emergency dispatch.']

Based on what you've told me, I'm marking this as a priority call. We can have someone to you [within X hours / this evening / first thing tomorrow morning].

Our emergency dispatch fee is [$XX], and that goes toward any repair. I'll have our tech call you about 30 minutes before arrival.

Stay [warm/cool] — we'll take care of this for you."`}
                />
            </section>

            {/* Mid-page CTA */}
            <ResourceCTA variant="download" trade="HVAC" service="HVAC" />

            {/* Price Shopper Script */}
            <section id="price-shopper" className="mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">Price Shopper Script</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                    Price shoppers aren't bad leads — they're uninformed leads. They don't know how to evaluate HVAC companies, so they default to the only metric they understand: price. Your job is to shift the conversation from cost to value, without being evasive about pricing.
                </p>

                <CopyableScriptBlock
                    title="Price Shopper Handling Script"
                    scenario="Customer asks: 'How much do you charge for a tune-up?'"
                    script={`"That's a great question, and I want to make sure I give you the most accurate answer.

Our [tune-up / diagnostic / repair] typically runs between [$X and $Y], depending on your system type and what we find during the visit.

But here's what sets us apart — our techs don't just check a few boxes. We do a full [XX]-point inspection, test your system's efficiency, and walk you through everything we find with photos. If there's a repair needed, you'll know exactly what it is and why before we do anything.

We also [include a 1-year warranty on repairs / offer same-day service / have been in business for X years / are rated 4.9 on Google].

I have availability [today/tomorrow]. Would you like me to get you on the schedule?"

[If they hesitate: "No pressure at all. I'll send you our details so you have them when you're ready. Can I get your email?"]`}
                />
                <p className="text-muted-foreground leading-relaxed mt-4">
                    For a deeper dive on price shopper strategies, see our dedicated <Link to="/resources/hvac-price-shopper-phone-script/" className="text-primary hover:underline">HVAC Price Shopper Phone Script</Link> guide.
                </p>
            </section>

            {/* After Hours Script */}
            <section id="after-hours" className="mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">After-Hours HVAC Script</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                    After-hours calls represent 25–40% of total call volume for most HVAC shops, and they skew heavily toward emergencies — your highest-value jobs. Every after-hours call that hits voicemail is likely a $400–$1,200 job going to the competitor who answers.
                </p>

                <CopyableScriptBlock
                    title="After-Hours Answering Script"
                    scenario="Calls received outside business hours"
                    script={`"Thank you for calling [Company Name]. Our office is currently closed, but I can absolutely help you.

Are you calling about an emergency — like no heat, no AC, or a gas concern? Or is this something we can schedule during business hours?

[IF EMERGENCY]
Let me get your information so I can reach our on-call technician:
- Your name and callback number?
- Your address?
- What's happening with your system right now?

I'm going to contact our on-call tech and have them call you back within [15-30 minutes]. Our after-hours dispatch fee is [$XX], which applies toward any repair.

If you smell gas, please leave the home and call your gas company immediately.

[IF NON-EMERGENCY]
No problem — I can get you scheduled for our first available slot tomorrow.
- Your name and the best number to reach you?
- Can you briefly describe what's going on?

Great, I've got you down for [first available]. Someone from our team will confirm your appointment in the morning. Is there anything else I can help with?

Thanks for calling [Company Name]. We appreciate your patience!"`}
                />
                <p className="text-muted-foreground leading-relaxed mt-4">
                    For more detail on after-hours coverage, see our <Link to="/resources/hvac-after-hours-answering-script/" className="text-primary hover:underline">HVAC After-Hours Answering Script</Link> guide.
                </p>
            </section>

            {/* Intake Checklist */}
            <section id="intake-checklist" className="mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">HVAC Call Intake Checklist</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                    Print this out or paste it into your CRM. Every call should capture these data points — no exceptions. Missing information leads to wasted truck rolls and frustrated techs.
                </p>

                <ChecklistBlock
                    title="HVAC Call Intake Checklist"
                    items={[
                        "Caller's full name",
                        "Callback phone number",
                        "Service address (confirm city/zip)",
                        "Is this an emergency? (no heat, no AC, gas smell, CO detector)",
                        "System type (central air, heat pump, furnace, mini-split, boiler)",
                        "Approximate system age",
                        "Primary symptom / complaint",
                        "When did the issue start?",
                        "Has anything changed recently? (thermostat, power outage, filter)",
                        "Preferred appointment date and time window",
                        "How did they hear about us?",
                        "Any access instructions (gate code, dog, lock box)",
                        "Email address (for confirmation)",
                    ]}
                />
            </section>

            {/* Missed Call Revenue */}
            <section id="missed-call-revenue" className="mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">Missed Call Revenue Example</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                    Let's make the cost of missed calls tangible. Consider a mid-sized HVAC shop:
                </p>
                <div className="rounded-xl border border-border bg-card p-6 mb-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><span className="text-muted-foreground">Monthly inbound calls:</span></div>
                        <div className="font-semibold">300</div>
                        <div><span className="text-muted-foreground">Current answer rate:</span></div>
                        <div className="font-semibold">65%</div>
                        <div><span className="text-muted-foreground">Missed calls per month:</span></div>
                        <div className="font-semibold text-destructive">105</div>
                        <div><span className="text-muted-foreground">Booking rate on answered calls:</span></div>
                        <div className="font-semibold">30%</div>
                        <div><span className="text-muted-foreground">Average job value:</span></div>
                        <div className="font-semibold">$425</div>
                        <div className="border-t border-border pt-2 col-span-2"></div>
                        <div><span className="font-semibold text-foreground">Lost jobs per month:</span></div>
                        <div className="font-bold text-destructive">~32</div>
                        <div><span className="font-semibold text-foreground">Lost revenue per month:</span></div>
                        <div className="font-bold text-destructive">$13,388</div>
                        <div><span className="font-semibold text-foreground">Lost revenue per year:</span></div>
                        <div className="font-bold text-destructive">$160,650</div>
                    </div>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                    That's over $160K in annual revenue from calls that simply went unanswered. Run your own numbers with our{" "}
                    <Link to="/resources/missed-call-revenue-calculator/" className="text-primary hover:underline">
                        Missed Call Revenue Calculator
                    </Link>.
                </p>
            </section>

            {/* Track and Improve */}
            <section id="track-improve" className="mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">How to Track and Improve Your Booking Rate</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                    You can't improve what you don't measure. Here's a simple framework to start tracking and improving your phone performance:
                </p>
                <ol className="list-decimal pl-6 space-y-3 text-muted-foreground">
                    <li>
                        <strong className="text-foreground">Record every inbound call.</strong> Use your phone system's built-in recording or a service like RingSnap that records and transcribes automatically. You need to hear what's actually happening on the phone.
                    </li>
                    <li>
                        <strong className="text-foreground">Track 3 numbers weekly:</strong> answer rate, booking rate, and average speed to answer. Post them where your team can see them.
                    </li>
                    <li>
                        <strong className="text-foreground">Listen to 5 calls per week.</strong> Pick a mix of booked and unbooked calls. Identify patterns — where do callers drop off? Where does the script break down?
                    </li>
                    <li>
                        <strong className="text-foreground">Test one change at a time.</strong> Update your greeting one week. Change how you handle price shoppers the next. Measure the impact before making more changes.
                    </li>
                    <li>
                        <strong className="text-foreground">Role-play with your team.</strong> Run through the scripts live. The best dispatchers practice — just like the best techs practice their diagnostic flow.
                    </li>
                    <li>
                        <strong className="text-foreground">Consider automation for after-hours.</strong> AI receptionists like RingSnap can run your exact scripts 24/7 with zero hold time, covering the 35% of calls that come after your office closes.
                    </li>
                </ol>
            </section>

            {/* FAQs */}
            <section id="faqs">
                <FAQSection faqs={faqs} />
            </section>

            {/* End CTA */}
            <ResourceCTA variant="demo" trade="HVAC" service="HVAC" />

            {/* Related Resources */}
            <RelatedResources
                resources={[
                    {
                        title: "HVAC After-Hours Answering Script",
                        description: "Complete after-hours script with emergency triage and overnight booking.",
                        href: "/resources/hvac-after-hours-answering-script/",
                        tag: "HVAC",
                    },
                    {
                        title: "HVAC Price Shopper Phone Script",
                        description: "Turn price shoppers into booked appointments with value-first conversations.",
                        href: "/resources/hvac-price-shopper-phone-script/",
                        tag: "HVAC",
                    },
                    {
                        title: "Missed Call Revenue Calculator",
                        description: "Calculate exactly how much your shop loses from unanswered calls.",
                        href: "/resources/missed-call-revenue-calculator/",
                        tag: "Calculator",
                    },
                ]}
            />
        </ResourceLayout>
    );
};

export default HvacDispatcherScript;
