import { ResourceLayout } from "@/components/resources/ResourceLayout";
import { CopyableScriptBlock } from "@/components/resources/CopyableScriptBlock";
import { ResourceCTA } from "@/components/resources/ResourceCTA";
import { RelatedResources } from "@/components/resources/RelatedResources";
import { FAQSection } from "@/components/resources/FAQSection";
import { ChecklistBlock } from "@/components/resources/ChecklistBlock";

const faqs = [
    { question: "Is a sewer backup a health emergency?", answer: "Yes. Raw sewage contains bacteria including E. coli, Salmonella, and Hepatitis A. Any contact with sewage water requires thorough disinfection. Your dispatcher should treat every sewer backup as a health emergency and advise callers to keep people and pets away from affected areas." },
    { question: "How soon should I dispatch for a sewer backup?", answer: "Immediately. Sewer backups are health hazards and typically rank among your highest-value calls ($800–$5,000+). Same-day dispatch is the minimum; within 2 hours is the target for active backups." },
    { question: "What causes most residential sewer backups?", answer: "Tree root intrusion is the #1 cause, followed by grease buildup, collapsed pipes, and municipal sewer line issues. Knowing this helps your dispatcher ask informed questions and set expectations for the scope of work." },
    { question: "Should my dispatcher advise cleanup while waiting?", answer: "No. Tell them NOT to clean up sewage themselves — it's a biohazard. They should avoid the area, keep pets and children away, and avoid using any drains or toilets until your plumber arrives and clears the line." },
];

const SewerBackupCallScript = () => (
    <ResourceLayout
        title="Sewer Backup Call Script for Plumbers (Free Template) | RingSnap"
        metaDescription="Free sewer backup phone script for plumbing dispatchers. Safety-first triage, health hazard guidance, and fast dispatch. Copy, paste, and start using today."
        canonical="/resources/sewer-backup-call-script/"
        keywords="sewer backup call script, sewer backup phone script, plumbing sewer emergency script, sewer backup dispatch"
        breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Resources", href: "/resources/" },
            { label: "Plumbing Scripts", href: "/resources/plumbing-dispatcher-script-template/" },
            { label: "Sewer Backup Call Script" },
        ]}
        toc={[
            { id: "health-stakes", label: "Health & Safety Stakes" },
            { id: "script", label: "Sewer Backup Script" },
            { id: "checklist", label: "Sewer Backup Checklist" },
            { id: "faqs", label: "FAQs" },
        ]}
    >
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">
            Sewer Backup Call Script for Plumbers
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed mb-8">
            Sewer backup calls are your highest-urgency, highest-value plumbing calls. They're also the calls where health and safety guidance is critical. This script helps your dispatcher handle the call with urgency, keep people safe, and dispatch fast.
        </p>

        <section id="health-stakes" className="mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-4">Health & Safety Stakes of Sewer Backups</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
                Sewer backups aren't just messy — they're genuine health hazards. Raw sewage contains bacteria, viruses, and parasites that can cause serious illness. When sewage backs up into a living space, the contamination risk extends to flooring, walls, furniture, and anything the water contacts.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
                Your dispatcher's role is to protect the caller and their family while getting a plumber dispatched. The safety guidance you give in the first 60 seconds of the call can prevent illness and contain the contamination before it spreads to additional rooms.
            </p>
            <p className="text-muted-foreground leading-relaxed">
                These calls typically range from $800 to $5,000+, depending on the cause (simple clog vs. tree root intrusion vs. collapsed line). They represent significant revenue — and significant trust-building opportunities. Handle the call well and you've earned a customer for life.
            </p>
        </section>

        <section id="script" className="mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-4">Copy/Paste Sewer Backup Script</h2>
            <CopyableScriptBlock
                title="Sewer Backup Emergency Script"
                scenario="Sewage coming up through drains, toilets, or floor drains"
                script={`"Thanks for calling [Company Name]. Sewer backups are something we handle urgently — let me help you right away.

FIRST — SAFETY:
- Is sewage actively coming up into your home right now?
- Which drains are affected?
- Is sewage in any living areas (kitchen, bathroom, basement floor)?
- Do you have children or pets in the house?

[IF SEWAGE IN LIVING AREAS:]
'OK, here's what I need you to do right now:
1. Keep everyone — especially kids and pets — completely away from the affected area.
2. Do NOT try to clean up the sewage yourself. It contains bacteria that can make you sick.
3. Stop using ALL drains, toilets, and running water in the house until our plumber arrives. Every drain you use can push more sewage into your home.
4. If you have rubber gloves, put them on before touching anything near the affected area.
5. Open windows in the affected area if you can do so safely — ventilation helps.'

Now let me get your information for dispatch:
- Your name?
- Your address?
- Best callback number?
- Is this a single-story or multi-story home?
- Do you have a basement or crawl space?
- How many drains are backing up?
- Has this happened before?
- Do you have large trees near your sewer line?

I'm marking this as a priority dispatch. Our plumber will be there within [X hours]. Our emergency service fee is [$XX], applied toward the repair.

Important: please don't try to clean up the sewage before our team arrives. We have the proper equipment to handle the biohazard safely.

Our plumber will call you about 15 minutes before arrival. Is there anything else I can help with right now?"`}
            />
        </section>

        <section id="checklist" className="mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-4">Sewer Backup Intake Checklist</h2>
            <ChecklistBlock
                title="Sewer Backup Emergency Checklist"
                items={[
                    "SAFETY: Sewage in living areas? → Advise: keep away, no contact, open windows",
                    "SAFETY: Children/pets? → Advise: keep them away from affected area",
                    "SAFETY: Advised: STOP using all drains and toilets",
                    "SAFETY: Advised: Do NOT clean up sewage (biohazard)",
                    "Caller name and callback number",
                    "Service address",
                    "Home type (slab, basement, crawl space, multi-story)",
                    "Which drains affected (toilet, shower, floor drain, kitchen)",
                    "How many drains backing up",
                    "Is sewage actively rising or has it stopped?",
                    "Previous sewer issues at this address?",
                    "Large trees near sewer line?",
                    "Emergency dispatch fee communicated",
                    "Plumber dispatched with ETA",
                ]}
            />
        </section>

        <section id="faqs">
            <FAQSection faqs={faqs} />
        </section>

        <ResourceCTA variant="demo" trade="plumbing" />

        <RelatedResources
            resources={[
                { title: "Plumbing Dispatcher Script Template", description: "All plumbing scripts, benchmarks, and intake checklists.", href: "/resources/plumbing-dispatcher-script-template/", tag: "Pillar" },
                { title: "Burst Pipe Call Script", description: "Emergency script for burst pipes with shutoff guidance.", href: "/resources/burst-pipe-call-script/", tag: "Plumbing" },
                { title: "Drain Cleaning Upsell Script", description: "Turn drain cleanings into full-value visits.", href: "/resources/drain-cleaning-upsell-script/", tag: "Plumbing" },
            ]}
        />
    </ResourceLayout>
);

export default SewerBackupCallScript;
