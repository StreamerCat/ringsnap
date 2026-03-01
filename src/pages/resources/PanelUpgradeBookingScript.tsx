import { ResourceLayout } from "@/components/resources/ResourceLayout";
import { CopyableScriptBlock } from "@/components/resources/CopyableScriptBlock";
import { ResourceCTA } from "@/components/resources/ResourceCTA";
import { RelatedResources } from "@/components/resources/RelatedResources";
import { FAQSection } from "@/components/resources/FAQSection";
import { ChecklistBlock } from "@/components/resources/ChecklistBlock";

const faqs = [
    { question: "What's the average panel upgrade job worth?", answer: "A 200-amp panel upgrade typically ranges from $2,000 to $4,500 depending on your market, the complexity of the installation, and whether the meter base needs replacement. In high-cost markets, premium panel upgrades can exceed $6,000." },
    { question: "What triggers someone to call about a panel upgrade?", answer: "The most common triggers: (1) Adding an EV charger, (2) Kitchen or bathroom remodel, (3) Adding a hot tub or pool, (4) Repeatedly tripping breakers, (5) Real estate inspection flagged the panel, (6) Planning to add solar panels. Each trigger requires slightly different questions." },
    { question: "Should I quote a panel upgrade over the phone?", answer: "Never give a firm quote over the phone. Too many variables (meter base condition, permit requirements, wire routing, existing panel brand). Instead, offer a paid evaluation: 'Our electrician will inspect your current panel and give you a firm quote with zero surprises.' The evaluation fee should apply toward the work." },
    { question: "How many panel upgrade quotes convert to jobs?", answer: "When you do an in-person evaluation and educate the customer, close rates range from 50–70%. The key is showing them their current panel condition, explaining the safety and capacity implications, and presenting clear pricing options. Shops that skip education and just hand over a number close at 20–30%." },
];

const PanelUpgradeBookingScript = () => (
    <ResourceLayout
        title="Panel Upgrade Booking Script for Electricians (Free Template) | RingSnap"
        metaDescription="Free panel upgrade booking script for electrical dispatchers. Book $2,000–$5,000+ panel upgrade consultations from capacity concerns and EV charger inquiries."
        canonical="/resources/panel-upgrade-booking-script/"
        keywords="panel upgrade booking script, electrical panel upgrade phone script, book panel upgrade, ev charger panel script"
        breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Resources", href: "/resources/" },
            { label: "Electrician Scripts", href: "/resources/electrician-call-answering-script/" },
            { label: "Panel Upgrade Booking Script" },
        ]}
        toc={[
            { id: "high-ticket", label: "High-Ticket Opportunity" },
            { id: "trigger-questions", label: "Trigger Questions" },
            { id: "booking-script", label: "Booking Script" },
            { id: "checklist", label: "Panel Upgrade Checklist" },
            { id: "faqs", label: "FAQs" },
        ]}
    >
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">
            Panel Upgrade Booking Script for Electricians
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed mb-8">
            Panel upgrade calls are your highest-value residential jobs — $2,000 to $5,000+ per job. But they rarely start as "I need a panel upgrade." They start as "my breakers keep tripping" or "I want to add an EV charger." This script helps your dispatcher recognize the opportunity and book the evaluation.
        </p>

        <section id="high-ticket" className="mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-4">Why Panel Upgrades Are Your Best Revenue Opportunity</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
                Panel upgrades occupy a sweet spot in electrical work: they're high-margin, relatively predictable in scope, and driven by real needs that aren't going away. The massive growth in EV ownership alone is creating a surge in panel upgrade demand — most homes with 100-amp panels can't support a Level 2 EV charger without an upgrade.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
                The challenge is that homeowners don't think in terms of "panel upgrades." They think in terms of their immediate problem: breakers tripping, lights flickering, or wanting to add something new. Your dispatcher's job is to connect those symptoms to the solution (panel evaluation) in a way that feels educational, not salesy.
            </p>
            <p className="text-muted-foreground leading-relaxed">
                A well-trained dispatcher can increase your panel upgrade bookings by 40–60% simply by asking the right follow-up questions when callers mention trigger symptoms.
            </p>
        </section>

        <section id="trigger-questions" className="mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-4">Trigger Questions: Identifying Hidden Panel Upgrade Needs</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
                When a caller mentions any of these, your dispatcher should pivot to the panel upgrade conversation:
            </p>
            <div className="grid md:grid-cols-2 gap-3 mb-4">
                {[
                    { trigger: '"My breakers keep tripping"', followUp: "How often? Which circuits? When was the panel installed?" },
                    { trigger: '"I want to add an EV charger"', followUp: "What amp service do you have? Is your panel full?" },
                    { trigger: '"We\'re remodeling the kitchen"', followUp: "Are you adding appliances? Your panel may need more capacity." },
                    { trigger: '"We want a hot tub/pool"', followUp: "Those need dedicated 50-60A circuits. Let's check your panel capacity." },
                    { trigger: '"Our home inspector flagged the panel"', followUp: "What brand/type? Federal Pacific?  Zinsco? Those have safety recalls." },
                    { trigger: '"We\'re adding solar panels"', followUp: "Your panel needs a solar-ready upgrade with back-feed breaker space." },
                ].map((item, i) => (
                    <div key={i} className="rounded-xl border border-border bg-card p-4">
                        <p className="font-semibold text-foreground text-sm mb-1">{item.trigger}</p>
                        <p className="text-xs text-muted-foreground">→ {item.followUp}</p>
                    </div>
                ))}
            </div>
        </section>

        <section id="booking-script" className="mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-4">Copy/Paste Panel Upgrade Booking Script</h2>

            <CopyableScriptBlock
                title="Panel Upgrade Consultation Booking"
                scenario="Caller mentions tripping breakers, capacity concerns, or new additions"
                script={`"Thanks for calling [Company Name]. It sounds like you might be running into a capacity issue with your electrical panel — that's actually really common, especially in homes built before 2000.

Let me ask a few questions so I can match you with the right electrician:

1. How old is your home?
2. Do you know what amp service you have? (100-amp, 150-amp, or 200-amp — it's usually printed on the main breaker)
3. What's been happening? Tripping breakers, flickering lights, or are you planning to add something new?
4. Are you planning any of these in the next year or two: EV charger, hot tub, home office, kitchen remodel, or solar?

[Based on answers:]

'Based on what you're telling me, a panel evaluation is the smart first step. Here's how it works:

Our electrician will come out and do a full inspection of your current panel — he'll test the load on each circuit, check the condition of the panel and wiring, and assess your current and future capacity needs.

Then he'll walk you through exactly what you need:
- Whether a full upgrade is necessary, or if there's a simpler solution
- What size panel would cover both your current needs and future plans
- A firm price with zero surprises, including permits and inspection

The evaluation is [$XX], and that fee applies toward the upgrade if you decide to move forward. I have availability [date/time]. Would you like me to get you on the schedule?'

[If they hesitate:]
'Totally understand — it's a bigger decision. What I'd recommend is at least getting the evaluation so you know exactly where you stand. That way when you're ready — whether it's next week or next year — you have the information. No pressure.'"`}
            />
        </section>

        <section id="checklist" className="mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-4">Panel Upgrade Intake Checklist</h2>
            <ChecklistBlock
                title="Panel Upgrade Evaluation Checklist"
                items={[
                    "Caller name, phone, and service address",
                    "Home age",
                    "Current panel amp service (100/150/200)",
                    "Panel brand (note if Federal Pacific, Zinsco, or Pushmatic — safety recall)",
                    "Trigger symptom (tripping breakers, flickering, adding load)",
                    "Planned additions (EV charger, hot tub, remodel, solar, addition)",
                    "Evaluation fee communicated and applied toward work",
                    "Appointment scheduled with preferred date/time",
                    "Access instructions (garage panel, exterior panel, gate code)",
                ]}
            />
        </section>

        <section id="faqs">
            <FAQSection faqs={faqs} />
        </section>

        <ResourceCTA variant="demo" trade="electrical" />

        <RelatedResources
            resources={[
                { title: "Electrician Call Answering Script", description: "Complete electrician call scripts and safety triage.", href: "/resources/electrician-call-answering-script/", tag: "Pillar" },
                { title: "Electrical Safety Triage Questions", description: "The 8 safety questions for every electrical call.", href: "/resources/electrical-safety-triage-questions/", tag: "Electrical" },
                { title: "Increase Average Ticket Planner", description: "Plan your average ticket growth with upsell strategies.", href: "/resources/increase-average-ticket/", tag: "Calculator" },
            ]}
        />
    </ResourceLayout>
);

export default PanelUpgradeBookingScript;
