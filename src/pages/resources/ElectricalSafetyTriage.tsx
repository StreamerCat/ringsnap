import { ResourceLayout } from "@/components/resources/ResourceLayout";
import { ResourceCTA } from "@/components/resources/ResourceCTA";
import { RelatedResources } from "@/components/resources/RelatedResources";
import { FAQSection } from "@/components/resources/FAQSection";
import { ChecklistBlock } from "@/components/resources/ChecklistBlock";

const faqs = [
    { question: "What are the most critical safety questions?", answer: "The top 3 that should be asked on EVERY electrical call: (1) Do you smell burning? (2) Do you see sparks, smoke, or flames? (3) Is anyone in contact with an electrical source? These three questions identify life-threatening emergencies within seconds." },
    { question: "When should a dispatcher tell someone to call 911?", answer: "Three situations: (1) Active fire or flames from an electrical source, (2) Person in contact with a live electrical source and unable to let go, (3) Downed power line on their property or near people. In all three cases, 911 comes before the electrician." },
    { question: "Can non-electricians answer these triage questions?", answer: "Yes. That's the whole point of a structured triage checklist — it gives office staff, answering services, and AI receptionists the ability to assess electrical calls safely without electrical expertise. The questions are designed to be asked by anyone and answered by the caller." },
    { question: "How do I train my team on electrical safety triage?", answer: "Run through 10 scenario calls as role plays. Cover: sparking outlet, burning smell, tripped breaker, complete outage, downed wire, hot panel, flickering lights, and buzzing sounds. Your team should be able to classify each one correctly within 30 seconds." },
];

const ElectricalSafetyTriage = () => (
    <ResourceLayout
        title="Electrical Safety Triage Questions for Dispatchers (2026) | RingSnap"
        metaDescription="The 8 electrical safety triage questions every dispatcher must ask. Identify emergencies, guide caller safety, and classify calls in under 60 seconds."
        canonical="/resources/electrical-safety-triage-questions/"
        keywords="electrical safety triage questions, electrician safety screening, electrical call triage, electrical dispatch safety checklist"
        breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Resources", href: "/resources/" },
            { label: "Electrician Scripts", href: "/resources/electrician-call-answering-script/" },
            { label: "Safety Triage Questions" },
        ]}
        toc={[
            { id: "why-triage", label: "Why Safety Triage First" },
            { id: "eight-questions", label: "The 8 Triage Questions" },
            { id: "decision-matrix", label: "Decision Matrix" },
            { id: "full-checklist", label: "Full Triage Checklist" },
            { id: "faqs", label: "FAQs" },
        ]}
    >
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">
            Electrical Safety Triage Questions for Dispatchers
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed mb-8">
            Electrical calls carry higher safety stakes than any other trade. Your dispatcher doesn't need to be an electrician — they need to ask the right 8 questions to determine whether the caller is in danger, needs emergency dispatch, or can wait for a scheduled appointment.
        </p>

        <section id="why-triage" className="mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-4">Why Safety Triage Comes Before Everything</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
                In HVAC, an uncomfortable caller can wait a few hours. In plumbing, you can shut off the water. In electrical, a wrong decision can lead to electrocution, house fires, or death. That's not an exaggeration — the NFPA reports that electrical issues cause approximately 44,000 home fires and 440 deaths per year in the United States.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
                Your dispatcher's first job on every electrical call is to determine whether the caller is safe. This takes 30–60 seconds with the right questions. Only after safety is confirmed do you move to intake and scheduling.
            </p>
            <p className="text-muted-foreground leading-relaxed">
                The 8 questions below are designed to identify dangers quickly, guide appropriate action, and classify the call correctly. Print them, post them next to every phone, and train your team to ask them on autopilot.
            </p>
        </section>

        <section id="eight-questions" className="mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-4">The 8 Triage Questions</h2>
            <div className="space-y-4">
                {[
                    { num: "1", q: "Do you see sparks, smoke, or flames from any electrical outlet, switch, or panel?", action: "If yes → Turn off breaker if safe to do so. If flames → call 911 and leave home." },
                    { num: "2", q: "Do you smell anything burning near outlets, switches, or your electrical panel?", action: "If yes → Turn off breaker to affected circuit. If unsure which breaker → turn off main breaker." },
                    { num: "3", q: "Is anyone in contact with an electrical source and unable to let go?", action: "If yes → Call 911 immediately. Do NOT touch the person. Try to disconnect power at the breaker panel." },
                    { num: "4", q: "Is there a downed power line on or near your property?", action: "If yes → Call 911 and the utility company. Stay at least 35 feet away. Do not touch anything the wire contacts." },
                    { num: "5", q: "Are any outlets, switches, or your panel hot to the touch?", action: "If yes → Stop using that circuit. Turn off the breaker. This indicates wiring issues that can cause fire." },
                    { num: "6", q: "Do you hear buzzing or crackling sounds from outlets, switches, or walls?", action: "If yes → This can indicate arcing (a fire hazard). Turn off the breaker. Schedule urgent dispatch." },
                    { num: "7", q: "Is the power out in your entire home, or just part of it?", action: "Entire home → Check with neighbors (utility outage?) and main breaker. Partial → likely a panel or circuit issue." },
                    { num: "8", q: "Have you recently experienced flickering lights, tripping breakers, or power surges?", action: "If yes → Ask about home age and panel type. Schedule evaluation — these are signs of an overloaded or aging panel." },
                ].map((item) => (
                    <div key={item.num} className="rounded-xl border border-border bg-card p-4">
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                                {item.num}
                            </div>
                            <div>
                                <p className="font-semibold text-foreground text-sm mb-1">"{item.q}"</p>
                                <p className="text-xs text-muted-foreground">→ {item.action}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>

        <section id="decision-matrix" className="mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-4">Decision Matrix: How to Classify the Call</h2>
            <div className="grid md:grid-cols-3 gap-4">
                <div className="rounded-xl border-2 border-destructive/30 bg-destructive/5 p-5">
                    <h3 className="font-bold text-foreground mb-2">🚨 Call 911 + Dispatch</h3>
                    <p className="text-xs text-muted-foreground mb-2">Questions 1 (flames), 3, or 4 are yes</p>
                    <ul className="list-disc pl-4 space-y-1 text-xs text-muted-foreground">
                        <li>Active fire from electrical source</li>
                        <li>Person in contact with electricity</li>
                        <li>Downed power line</li>
                    </ul>
                </div>
                <div className="rounded-xl border-2 border-yellow-500/30 bg-yellow-500/5 p-5">
                    <h3 className="font-bold text-foreground mb-2">⚡ Emergency — Dispatch Now</h3>
                    <p className="text-xs text-muted-foreground mb-2">Questions 1 (sparks/smoke), 2, 5, or 6 are yes</p>
                    <ul className="list-disc pl-4 space-y-1 text-xs text-muted-foreground">
                        <li>Sparking or smoking outlet/panel</li>
                        <li>Burning smell from electrical</li>
                        <li>Hot outlets/switches/panel</li>
                        <li>Buzzing or crackling in walls</li>
                    </ul>
                </div>
                <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-5">
                    <h3 className="font-bold text-foreground mb-2">📅 Schedule Service</h3>
                    <p className="text-xs text-muted-foreground mb-2">Questions 7 or 8 only, or all questions are no</p>
                    <ul className="list-disc pl-4 space-y-1 text-xs text-muted-foreground">
                        <li>Power outage (utility or panel)</li>
                        <li>Flickering lights</li>
                        <li>Tripping breakers</li>
                        <li>New installations</li>
                    </ul>
                </div>
            </div>
        </section>

        <section id="full-checklist" className="mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-4">Full Electrical Triage Checklist</h2>
            <ChecklistBlock
                title="Electrical Safety Triage Checklist"
                items={[
                    "Q1: Sparks, smoke, or flames? → If flames: 911 + evacuate. If sparks/smoke: breaker off + dispatch",
                    "Q2: Burning smell? → Breaker off + priority dispatch",
                    "Q3: Person in contact with electricity? → 911 immediately",
                    "Q4: Downed power line? → 911 + utility, stay 35ft away",
                    "Q5: Hot outlets/switches/panel? → Breaker off + urgent dispatch",
                    "Q6: Buzzing/crackling in walls? → Breaker off + urgent dispatch",
                    "Q7: Power out in entire home or partial? → Check neighbors + main breaker",
                    "Q8: Flickering/tripping/surges? → Schedule panel evaluation",
                    "Classification assigned: 911 / Emergency / Scheduled",
                    "Caller name and callback number captured",
                    "Service address confirmed",
                    "Home/building age noted",
                    "Safety instructions given",
                ]}
            />
        </section>

        <section id="faqs">
            <FAQSection faqs={faqs} />
        </section>

        <ResourceCTA variant="demo" trade="electrical" />

        <RelatedResources
            resources={[
                { title: "Electrician Call Answering Script", description: "Complete call scripts and safety procedures.", href: "/resources/electrician-call-answering-script/", tag: "Pillar" },
                { title: "Panel Upgrade Booking Script", description: "Book panel upgrade consultations from capacity concerns.", href: "/resources/panel-upgrade-booking-script/", tag: "Electrical" },
                { title: "Power Outage Call Script", description: "Triage power outages: utility vs. panel issues.", href: "/resources/power-outage-call-script/", tag: "Electrical" },
            ]}
        />
    </ResourceLayout>
);

export default ElectricalSafetyTriage;
