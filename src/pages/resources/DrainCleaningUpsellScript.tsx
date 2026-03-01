import { ResourceLayout } from "@/components/resources/ResourceLayout";
import { CopyableScriptBlock } from "@/components/resources/CopyableScriptBlock";
import { ResourceCTA } from "@/components/resources/ResourceCTA";
import { RelatedResources } from "@/components/resources/RelatedResources";
import { FAQSection } from "@/components/resources/FAQSection";

const faqs = [
    { question: "What's the average revenue for a drain cleaning call?", answer: "A basic drain clearing runs $150–$350. Add a camera inspection ($150–$300) and the job doubles. If the camera reveals root intrusion or pipe damage, you're looking at a hydro-jet ($400–$800) or line repair ($1,500–$5,000+). That's why the upsell conversation matters — it turns a $200 call into a $500–$2,000 job." },
    { question: "Is it pushy to recommend a camera inspection?", answer: "No — it's professional. If a patient went to the doctor with recurring headaches, you'd expect the doctor to investigate, not just prescribe aspirin. Similarly, a recurring drain clog has an underlying cause that a camera inspection reveals. You're doing the customer a favor by finding the real problem instead of applying a temporary fix." },
    { question: "How do I train techs to present upsells naturally?", answer: "Frame everything as education, not selling. 'Based on what I'm seeing, I'd recommend we run a camera to see what's causing these recurring backups. That way we fix it once instead of you calling us again next month.' The tech is advising, not pitching." },
    { question: "What percentage of drain cleanings lead to additional work?", answer: "When techs offer camera inspections, about 60–70% of customers say yes. Of those inspections, roughly 40% reveal conditions that warrant additional work (root intrusion, pipe damage, buildup). That means about 25% of all drain cleaning calls can convert to higher-value jobs." },
];

const DrainCleaningUpsellScript = () => (
    <ResourceLayout
        title="Drain Cleaning Upsell Script for Plumbers (Free Template) | RingSnap"
        metaDescription="Free drain cleaning upsell scripts for plumbers. Turn basic drain clearings into full-value visits with camera inspections, maintenance plans, and line treatments."
        canonical="/resources/drain-cleaning-upsell-script/"
        keywords="drain cleaning upsell script, drain cleaning booking script, plumber upsell script, camera inspection upsell, drain cleaning revenue"
        breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Resources", href: "/resources/" },
            { label: "Plumbing Scripts", href: "/resources/plumbing-dispatcher-script-template/" },
            { label: "Drain Cleaning Upsell Script" },
        ]}
        toc={[
            { id: "revenue-opportunity", label: "The Revenue Opportunity" },
            { id: "booking-script", label: "Booking Script with Upsell Seed" },
            { id: "on-site-scripts", label: "On-Site Upsell Scripts" },
            { id: "faqs", label: "FAQs" },
        ]}
    >
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">
            Drain Cleaning Upsell Script for Plumbers
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed mb-8">
            Drain cleaning calls are your bread-and-butter. But a $200 drain clearing can become a $500–$2,000 visit when your team knows how to present camera inspections, line treatments, and maintenance plans in a way that feels helpful — not pushy. Here are the scripts.
        </p>

        <section id="revenue-opportunity" className="mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-4">The Revenue Opportunity in Every Drain Call</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
                Most plumbing shops treat drain cleaning as a simple, low-margin service. Clear the clog, collect $200, move on. But here's what the data shows:
            </p>
            <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div className="rounded-xl border border-border bg-card p-4 text-center">
                    <div className="text-2xl font-bold text-primary mb-1">$200</div>
                    <div className="text-xs text-muted-foreground">Basic drain clearing</div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 text-center">
                    <div className="text-2xl font-bold text-primary mb-1">$450</div>
                    <div className="text-xs text-muted-foreground">+ Camera inspection</div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 text-center">
                    <div className="text-2xl font-bold text-primary mb-1">$1,200+</div>
                    <div className="text-xs text-muted-foreground">+ Hydro-jet or line repair</div>
                </div>
            </div>
            <p className="text-muted-foreground leading-relaxed mb-4">
                The upsell starts on the phone — not on-site. When your dispatcher plants the seed for a camera inspection during the booking call, the customer arrives expecting a thorough visit, not just a quick snake-and-go. This makes the tech's job dramatically easier.
            </p>
            <p className="text-muted-foreground leading-relaxed">
                The key is framing everything as education and prevention, not selling. You're not upselling — you're providing complete service that saves the customer money long-term.
            </p>
        </section>

        <section id="booking-script" className="mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-4">Booking Script with Upsell Seed</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
                This script is designed for the dispatcher or receptionist during the initial booking call. It plants the seed for a camera inspection naturally.
            </p>

            <CopyableScriptBlock
                title="Drain Cleaning Booking with Upsell Seed"
                scenario="Customer calls about a clogged or slow drain"
                script={`"Thanks for calling [Company Name]. I can help you get that drain taken care of.

Can you tell me about the drain that's giving you issues?
- Which drain? (kitchen, bathroom, shower, toilet, floor drain, main line?)
- Is it draining slowly, completely stopped, or backing up?
- Has this happened before? How recently?
- Have you tried anything — plunger, drain cleaner?

[IF RECURRING:]
'When drains back up more than once, it usually means there's something happening further down the line — tree roots, buildup, or a pipe issue. Our plumber can clear it right away, and while he's there, he can run a small camera into the line to see exactly what's causing the repeat backups. That way we fix the actual problem, not just the symptom.'

[IF FIRST TIME:]
'Got it. Our plumber will come out and clear the clog. He also brings a camera so if he suspects anything beyond a simple blockage, he can take a quick look and let you know what he sees. Totally up to you on that.'

Our drain clearing starts at [$XX]. If you'd like the camera inspection, it's an additional [$XX]. Most customers do both since the plumber is already there — saves you from paying a separate trip if we need to come back.

I have availability [today/tomorrow]. Can I get your name and address?"`}
            />
        </section>

        <section id="on-site-scripts" className="mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-4">On-Site Upsell Scripts for Techs</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
                These scripts are for your plumber after they've cleared the drain. The key is education — show the customer what you found and explain what it means.
            </p>

            <CopyableScriptBlock
                title="Camera Inspection Presentation"
                scenario="After clearing the drain, tech recommends a camera inspection"
                script={`"OK, I've got your drain flowing again. Here's what I noticed — the clog was [grease buildup / root material / debris], and based on what I pulled out, I'd recommend running our camera through the line real quick.

Here's why: what I cleared today is the symptom, but [grease buildup like this / root material / the type of debris I found] usually means there's more going on further down the pipe. The camera lets me see the whole line — I can show you on screen exactly what's in there.

If it's clean, great — you'll have peace of mind. If there's a problem, we catch it now before it turns into an emergency backup at 2 AM.

The camera inspection is [$XX], and I can do it right now since I'm already here. Want me to take a look?"`}
            />

            <CopyableScriptBlock
                title="Hydro-Jetting Recommendation"
                scenario="Camera shows significant buildup or root intrusion"
                script={`"So here's what the camera is showing us — [describe what's visible on screen]. You can see [the root intrusion / grease buildup / scale] along the pipe walls. This is what's been causing your recurring backups.

What I did today cleared the immediate blockage, but those [roots/buildup] are going to cause this drain to back up again — probably within [timeframe estimate].

The permanent fix here is a hydro-jet service. It's a high-pressure water cleaning that removes everything from the pipe walls — roots, grease, scale, all of it. It essentially restores the pipe to like-new condition.

The hydro-jet is [$XX]. Most customers prefer to do it now since I'm already here and the drain is accessible. Otherwise, you're looking at another trip charge when it backs up again in a few [weeks/months].

What would you like to do?"`}
            />
        </section>

        <section id="faqs">
            <FAQSection faqs={faqs} />
        </section>

        <ResourceCTA variant="demo" trade="plumbing" />

        <RelatedResources
            resources={[
                { title: "Plumbing Dispatcher Script Template", description: "All plumbing scripts and intake checklists.", href: "/resources/plumbing-dispatcher-script-template/", tag: "Pillar" },
                { title: "Increase Average Ticket Planner", description: "Plan upsell strategies and revenue growth by trade.", href: "/resources/increase-average-ticket/", tag: "Calculator" },
                { title: "Service Pricing Calculator", description: "Build profitable pricing for drain cleaning services.", href: "/resources/service-pricing-calculator/", tag: "Calculator" },
            ]}
        />
    </ResourceLayout>
);

export default DrainCleaningUpsellScript;
