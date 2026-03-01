import { useState } from "react";
import { ResourceLayout } from "@/components/resources/ResourceLayout";
import { ResourceCTA } from "@/components/resources/ResourceCTA";
import { FAQSection } from "@/components/resources/FAQSection";
import { RelatedResources } from "@/components/resources/RelatedResources";
import { CopyableScriptBlock } from "@/components/resources/CopyableScriptBlock";

const faqs = [
    { question: "What's the average ticket for residential HVAC, plumbing, and electrical?", answer: "HVAC: $350–$500 for service calls, $5,000–$12,000 for replacements. Plumbing: $250–$400 for service, $500–$3,000 for larger jobs. Electrical: $200–$400 for service, $2,000–$5,000 for panel upgrades. These are industry averages — top shops routinely exceed them through systematic upselling." },
    { question: "How much can I increase my average ticket?", answer: "Most shops can increase their average ticket by 20–40% within 90 days by implementing structured upsell menus and training techs on presentation. A $350 average moving to $490 on 50 jobs/month adds $7,000/month in revenue with zero additional marketing spend." },
    { question: "Is upselling ethical?", answer: "When done right, absolutely. Upselling is recommending services the customer actually needs — maintenance plans, safety inspections, efficiency upgrades, camera inspections. The unethical approach is NOT telling the customer about a problem you found because it's 'easier' to just finish the basic job." },
    { question: "What's the best upsell for each trade?", answer: "HVAC: maintenance agreements (recurring revenue + guaranteed callbacks). Plumbing: camera inspections on every drain cleaning (60% acceptance rate). Electrical: panel evaluations for any home 20+ years old showing symptoms. Each of these leads to legitimate, high-value follow-up work." },
];

const upsellMenus = {
    hvac: [
        { item: "Maintenance agreement", addedValue: "$189–$299/year", description: "Recurring revenue + guaranteed callback. Offer at every service call." },
        { item: "Indoor air quality add-on", addedValue: "$150–$400", description: "UV light, air purifier, or filtration upgrade during service." },
        { item: "Duct cleaning bundle", addedValue: "$350–$600", description: "Offer with tune-ups: 'While we're cleaning your system, should we clean the ducts too?'" },
        { item: "Smart thermostat install", addedValue: "$200–$350", description: "Offer during any thermostat discussion or new system install." },
        { item: "System efficiency audit", addedValue: "$99–$199", description: "Full home efficiency check — often leads to insulation or ductwork upgrades." },
    ],
    plumbing: [
        { item: "Camera inspection", addedValue: "$150–$300", description: "Offer on every drain cleaning. 60% acceptance rate. Reveals bigger jobs." },
        { item: "Water heater flush", addedValue: "$99–$199", description: "Add to any service call: 'While I'm here, when's the last time your water heater was flushed?'" },
        { item: "Whole-home leak detection", addedValue: "$150–$250", description: "Offer during any leak repair: 'Want me to check the rest of the house?'" },
        { item: "Fixture upgrade bundle", addedValue: "$200–$500", description: "Offer when replacing one fixture: 'We can do the others at a discounted labor rate.'" },
        { item: "Maintenance agreement", addedValue: "$149–$249/year", description: "Annual drain treatment + water heater flush + inspection." },
    ],
    electrical: [
        { item: "Panel evaluation", addedValue: "$99–$199", description: "Offer on any call where home is 20+ years old. Leads to $2–5K upgrades." },
        { item: "Whole-home surge protection", addedValue: "$200–$400", description: "Offer during any panel work: 'Protect your electronics for $X.'" },
        { item: "Outlet/switch upgrade package", addedValue: "$150–$400", description: "GFCI upgrades, USB outlets, smart switches during any room work." },
        { item: "EV charger pre-wire", addedValue: "$300–$600", description: "During any panel upgrade: 'Planning to get an EV? We can pre-wire while the panel is open.'" },
        { item: "Lighting upgrade", addedValue: "$200–$800", description: "LED retrofits, dimmer installs, under-cabinet lighting during any service." },
    ],
};

const AverageTicketPlanner = () => {
    const [currentTicket, setCurrentTicket] = useState(375);
    const [monthlyJobs, setMonthlyJobs] = useState(80);
    const [targetIncrease, setTargetIncrease] = useState(25);
    const [activeTrade, setActiveTrade] = useState<"hvac" | "plumbing" | "electrical">("hvac");

    const targetTicket = Math.round(currentTicket * (1 + targetIncrease / 100));
    const currentMonthly = currentTicket * monthlyJobs;
    const targetMonthly = targetTicket * monthlyJobs;
    const monthlyGain = targetMonthly - currentMonthly;
    const annualGain = monthlyGain * 12;

    return (
        <ResourceLayout
            title="Average Revenue Per Job Growth Planner for Contractors | RingSnap"
            metaDescription="Plan your average ticket increase with trade-specific upsell menus, scripts, and revenue projections. Free tool for HVAC, plumbing, and electrical contractors."
            canonical="/resources/increase-average-ticket/"
            keywords="increase average ticket contractor, average revenue per job, contractor upsell strategy, hvac upsell, plumber average ticket, increase job value"
            breadcrumbs={[
                { label: "Home", href: "/" },
                { label: "Resources", href: "/resources/" },
                { label: "Average Ticket Growth Planner" },
            ]}
            toc={[
                { id: "calculator", label: "Revenue Planner" },
                { id: "upsell-menu", label: "Upsell Menu by Trade" },
                { id: "upsell-scripts", label: "Upsell Scripts" },
                { id: "faqs", label: "FAQs" },
            ]}
        >
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">
                Average Revenue Per Job Growth Planner
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                Increasing your average ticket by just 20% can add $50,000–$200,000 in annual revenue without acquiring a single new customer. Use this planner to set targets, choose upsells, and see the revenue impact.
            </p>

            <section id="calculator" className="mb-10">
                <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
                    <h2 className="text-xl font-bold text-foreground mb-6">Revenue Growth Calculator</h2>

                    <div className="space-y-6">
                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-sm font-medium">Current average ticket</label>
                                <span className="text-sm font-bold text-primary">${currentTicket}</span>
                            </div>
                            <input type="range" min={100} max={1500} step={25} value={currentTicket} onChange={(e) => setCurrentTicket(Number(e.target.value))} className="w-full accent-primary" />
                        </div>

                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-sm font-medium">Jobs per month</label>
                                <span className="text-sm font-bold text-primary">{monthlyJobs}</span>
                            </div>
                            <input type="range" min={10} max={300} step={5} value={monthlyJobs} onChange={(e) => setMonthlyJobs(Number(e.target.value))} className="w-full accent-primary" />
                        </div>

                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-sm font-medium">Target ticket increase</label>
                                <span className="text-sm font-bold text-primary">{targetIncrease}%</span>
                            </div>
                            <input type="range" min={5} max={60} step={1} value={targetIncrease} onChange={(e) => setTargetIncrease(Number(e.target.value))} className="w-full accent-primary" />
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-border">
                        <div className="grid md:grid-cols-2 gap-4 mb-4">
                            <div className="rounded-xl bg-muted/50 p-4 text-center">
                                <div className="text-xs text-muted-foreground mb-1">Current Monthly Revenue</div>
                                <div className="text-xl font-bold">${currentMonthly.toLocaleString()}</div>
                                <div className="text-xs text-muted-foreground">${currentTicket} × {monthlyJobs} jobs</div>
                            </div>
                            <div className="rounded-xl bg-primary/10 border border-primary/20 p-4 text-center">
                                <div className="text-xs text-muted-foreground mb-1">Target Monthly Revenue</div>
                                <div className="text-xl font-bold text-primary">${targetMonthly.toLocaleString()}</div>
                                <div className="text-xs text-muted-foreground">${targetTicket} × {monthlyJobs} jobs</div>
                            </div>
                        </div>
                        <div className="rounded-xl bg-primary/10 border border-primary/20 p-5 text-center">
                            <div className="text-sm text-muted-foreground mb-1">Additional revenue from ticket increase</div>
                            <div className="text-3xl font-bold text-primary mb-1">+${monthlyGain.toLocaleString()}/month</div>
                            <div className="text-sm text-muted-foreground">+${annualGain.toLocaleString()} per year</div>
                        </div>
                    </div>
                </div>
            </section>

            <section id="upsell-menu" className="mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">Upsell Menu by Trade</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                    Select your trade to see the most effective upsells — each with realistic added value and a natural way to present it.
                </p>

                <div className="flex gap-2 mb-6">
                    {(["hvac", "plumbing", "electrical"] as const).map((trade) => (
                        <button
                            key={trade}
                            onClick={() => setActiveTrade(trade)}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeTrade === trade ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                                }`}
                        >
                            {trade.charAt(0).toUpperCase() + trade.slice(1)}
                        </button>
                    ))}
                </div>

                <div className="space-y-3">
                    {upsellMenus[activeTrade].map((item, i) => (
                        <div key={i} className="rounded-xl border border-border bg-card p-4">
                            <div className="flex items-start justify-between mb-2">
                                <h4 className="font-semibold text-foreground text-sm">{item.item}</h4>
                                <span className="text-xs font-bold text-primary bg-primary/10 rounded-full px-2.5 py-0.5">{item.addedValue}</span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section id="upsell-scripts" className="mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">Universal Upsell Scripts</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                    These scripts work across all trades. They frame upsells as professional recommendations, not sales pitches.
                </p>

                <CopyableScriptBlock
                    title="Maintenance Agreement Presentation"
                    scenario="After completing any service call"
                    script={`"Before I wrap up, I want to mention something that saves our regular customers a lot of money. We offer a maintenance agreement that includes [annual tune-up / inspection / drain treatment] plus priority scheduling and [10-15%] off all repairs.

Most of our customers end up saving [$X-$Y per year] compared to paying for those services individually. Plus you get bumped to the front of the line when you call — no waiting behind non-members.

It's $[X]/year or $[X]/month. Want me to set that up for you?"`}
                />

                <CopyableScriptBlock
                    title="'While I'm Here' Upsell"
                    scenario="During any service visit where additional work is visible"
                    script={`"While I'm here, I noticed [observation]. It's not an emergency, but it's something you'll want to address in the next [timeframe] to avoid [consequence].

If you'd like, I can take care of it right now — since I'm already set up, there's no additional trip charge, so it would just be [$X for the work]. Up to you — no pressure either way."`}
                />
            </section>

            <section id="faqs">
                <FAQSection faqs={faqs} />
            </section>

            <ResourceCTA variant="demo" trade="contractor" service="service" />

            <RelatedResources
                resources={[
                    { title: "Drain Cleaning Upsell Script", description: "Turn basic drain cleanings into full-value visits.", href: "/resources/drain-cleaning-upsell-script/", tag: "Plumbing" },
                    { title: "Service Pricing Calculator", description: "Build profitable pricing for all your services.", href: "/resources/service-pricing-calculator/", tag: "Calculator" },
                    { title: "Missed Call Revenue Calculator", description: "See revenue lost from unanswered calls.", href: "/resources/missed-call-revenue-calculator/", tag: "Calculator" },
                ]}
            />
        </ResourceLayout>
    );
};

export default AverageTicketPlanner;
