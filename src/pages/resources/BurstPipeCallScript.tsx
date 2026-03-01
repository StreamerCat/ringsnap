import { ResourceLayout } from "@/components/resources/ResourceLayout";
import { CopyableScriptBlock } from "@/components/resources/CopyableScriptBlock";
import { ResourceCTA } from "@/components/resources/ResourceCTA";
import { RelatedResources } from "@/components/resources/RelatedResources";
import { FAQSection } from "@/components/resources/FAQSection";
import { ChecklistBlock } from "@/components/resources/ChecklistBlock";

const faqs = [
    { question: "What's the first thing I should tell a caller with a burst pipe?", answer: "Tell them to find and shut off the main water supply valve immediately. This stops the damage clock. Every minute of delay means more water damage, more drywall, more flooring, and a bigger restoration bill. Once the water is off, you can take a proper intake." },
    { question: "How fast should I dispatch for a burst pipe?", answer: "Ideally within 1–2 hours. Burst pipes are true emergencies — water damage compounds exponentially. The longer you wait, the more the customer will need a plumber AND a water damage restoration company." },
    { question: "Should I charge an emergency fee for burst pipes?", answer: "Yes. Burst pipe calls are emergencies that disrupt your schedule and often require after-hours or weekend response. Standard practice is a $99–$199 emergency dispatch fee, applied toward the repair. Be transparent about this in the script." },
    { question: "What if the caller can't find their shutoff valve?", answer: "Walk them through common locations: near the water meter, in the basement, crawl space, utility room, or near the street. If they truly can't find it, tell them to call their water utility to shut off at the meter. In the meantime, have them collect water in buckets and towels to minimize damage." },
];

const BurstPipeCallScript = () => (
    <ResourceLayout
        title="Burst Pipe Call Script for Plumbers (Free Template) | RingSnap"
        metaDescription="Free burst pipe phone script for plumbing dispatchers. Walk callers through shutoff, assess damage scope, and dispatch your crew fast. Copy, paste, and use today."
        canonical="/resources/burst-pipe-call-script/"
        keywords="burst pipe call script, burst pipe phone script, plumbing emergency script, burst pipe dispatch"
        breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Resources", href: "/resources/" },
            { label: "Plumbing Scripts", href: "/resources/plumbing-dispatcher-script-template/" },
            { label: "Burst Pipe Call Script" },
        ]}
        toc={[
            { id: "why-speed", label: "Why Speed Matters" },
            { id: "script", label: "Burst Pipe Script" },
            { id: "checklist", label: "Burst Pipe Checklist" },
            { id: "faqs", label: "FAQs" },
        ]}
    >
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">
            Burst Pipe Call Script for Plumbers
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed mb-8">
            When a homeowner calls about a burst pipe, they're watching their home get destroyed in real time. Your dispatcher has two jobs: stop the damage (guide them to the shutoff valve) and get a truck rolling. This script handles both — calmly, professionally, and fast.
        </p>

        <section id="why-speed" className="mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-4">Why Speed Matters: The Cost of Delay</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
                Water damage costs increase exponentially with time. An insurance industry study found that water damage costs roughly double for every hour it goes unaddressed. A burst pipe that's caught and shut off in 15 minutes might cause $2,000 in damage. The same pipe left running for 2 hours can easily cause $10,000–$30,000 in structural, flooring, and mold remediation costs.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
                For your plumbing shop, that means two things: your dispatcher's ability to guide the caller through shutting off the water is literally saving them thousands of dollars, and your speed of dispatch directly affects how much work (and revenue) the job involves.
            </p>
            <p className="text-muted-foreground leading-relaxed">
                Burst pipe calls are high-value emergencies — typically $500–$3,000 for the plumbing repair alone, plus potential referral revenue from water damage restoration. But only if you answer the phone and get there first.
            </p>
        </section>

        <section id="script" className="mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-4">Copy/Paste Burst Pipe Call Script</h2>

            <CopyableScriptBlock
                title="Burst Pipe Emergency Script"
                scenario="Active water leak or pipe burst"
                script={`"Thanks for calling [Company Name]. It sounds like you've got water coming in — let me help you stop it right now.

FIRST: Is water actively flowing?

[IF YES — STOP THE WATER FIRST]
'OK, here's what we need to do right now: find your main water shutoff valve and turn it off. Here's where to look:
- Near your water meter (usually in the basement, crawl space, or utility room)
- On the wall where the main water line enters your home
- Near the street — there may be a valve box in your front yard

Turn it clockwise — righty-tighty — until it stops.

[Wait while they do it]

Is the water stopped? [IF CAN'T FIND IT: 'Call your water company and ask them to shut off at the meter. Their number is usually on your water bill.']

OK, good. You just saved yourself a lot of additional damage. Now let me get your information so I can get a plumber to you right away.

- Your name?
- Your address?
- Callback number?
- Where did the pipe burst? (kitchen, bathroom, basement, crawl space?)
- Is water on more than one floor?
- Approximately how long was water flowing before you caught it?
- Are any electrical outlets, panels, or appliances near the water?

I'm dispatching a plumber to you now. They'll be there within [X time]. Our emergency dispatch fee is [$XX], applied toward the repair.

While you wait:
- Turn off electricity to any areas with standing water (at the breaker panel, not the outlets)
- If you can safely do it, start removing water with towels, buckets, or a wet-dry vac
- Move any valuables or electronics to a dry area
- Take photos for your insurance — they'll need documentation

Our plumber will call you about 15 minutes before arrival. We'll get this taken care of."`}
            />
        </section>

        <section id="checklist" className="mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-4">Burst Pipe Intake Checklist</h2>
            <ChecklistBlock
                title="Burst Pipe Emergency Checklist"
                items={[
                    "Water shutoff guided? Main valve located and turned off?",
                    "Caller name and callback number",
                    "Service address (confirm city/zip)",
                    "Location of burst (room, floor, indoor/outdoor)",
                    "Pipe type if known (copper, PEX, galvanized, PVC)",
                    "Duration of active water flow (estimate)",
                    "Water on multiple floors?",
                    "Electrical near standing water? (advise breaker shutoff)",
                    "Home type (slab, crawl space, basement, multi-story)",
                    "Insurance documentation advised (photos)",
                    "Emergency dispatch fee communicated",
                    "Access instructions (gate code, lockbox, dog)",
                ]}
            />
        </section>

        <section id="faqs">
            <FAQSection faqs={faqs} />
        </section>

        <ResourceCTA variant="demo" trade="plumbing" />

        <RelatedResources
            resources={[
                { title: "Plumbing Dispatcher Script Template", description: "Complete plumbing scripts, benchmarks, and checklists.", href: "/resources/plumbing-dispatcher-script-template/", tag: "Pillar" },
                { title: "Sewer Backup Call Script", description: "Handle sewer backup emergencies with safety-first triage.", href: "/resources/sewer-backup-call-script/", tag: "Plumbing" },
                { title: "Missed Call Revenue Calculator", description: "See how much revenue you lose from missed emergency calls.", href: "/resources/missed-call-revenue-calculator/", tag: "Calculator" },
            ]}
        />
    </ResourceLayout>
);

export default BurstPipeCallScript;
