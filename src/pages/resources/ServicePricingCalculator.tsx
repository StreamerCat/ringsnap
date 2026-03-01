import { useState } from "react";
import { ResourceLayout } from "@/components/resources/ResourceLayout";
import { ResourceCTA } from "@/components/resources/ResourceCTA";
import { FAQSection } from "@/components/resources/FAQSection";
import { RelatedResources } from "@/components/resources/RelatedResources";

const faqs = [
    { question: "What's a good gross margin for service contractors?", answer: "Target 50–65% gross margin on service calls. Below 40% and you're working for free after overhead. Top-performing shops maintain 55–65% margins through disciplined pricing, efficient operations, and strategic upselling." },
    { question: "Should I include overhead in the labor rate?", answer: "Yes — always use your 'burdened' labor rate, which includes wages plus employer taxes, insurance, workers' comp, benefits, training, and vehicle costs. If you pay a tech $30/hour, the burdened rate is typically $45–$65/hour." },
    { question: "How do I calculate my burdened labor rate?", answer: "Add up all costs associated with having a tech on the road: hourly wage + employer taxes (7.65% for SS/Medicare) + workers' comp + health insurance + vehicle costs + tool allowances + training. Divide the total annual cost by productive hours (typically 1,500–1,800 hours/year)." },
    { question: "Should trip charges be separate or built into pricing?", answer: "Either works, but be transparent. Separate trip charges are clearer for the customer and allow you to reduce or waive them for nearby jobs. Built-in trip charges simplify quoting but can make you look more expensive when customers compare flat rates." },
];

const ServicePricingCalculator = () => {
    const [laborRate, setLaborRate] = useState(55);
    const [desiredMargin, setDesiredMargin] = useState(55);
    const [avgJobHours, setAvgJobHours] = useState(2);
    const [materialCost, setMaterialCost] = useState(75);
    const [tripCharge, setTripCharge] = useState(49);

    const laborCost = laborRate * avgJobHours;
    const totalCost = laborCost + materialCost + tripCharge;
    const recommendedPrice = Math.round(totalCost / (1 - desiredMargin / 100));
    const grossProfit = recommendedPrice - totalCost;
    const effectiveMargin = ((grossProfit / recommendedPrice) * 100).toFixed(1);

    const lowEnd = Math.round(recommendedPrice * 0.9);
    const highEnd = Math.round(recommendedPrice * 1.15);

    return (
        <ResourceLayout
            title="Service Pricing & Profit Calculator for Contractors | RingSnap"
            metaDescription="Free service pricing calculator for contractors. Calculate profitable pricing using your labor rate, margin target, materials, and trip charges. HVAC, plumbing, electrical."
            canonical="/resources/service-pricing-calculator/"
            keywords="service pricing calculator contractor, plumber pricing calculator, hvac pricing calculator, contractor profit calculator, service call pricing"
            breadcrumbs={[
                { label: "Home", href: "/" },
                { label: "Resources", href: "/resources/" },
                { label: "Service Pricing Calculator" },
            ]}
            toc={[
                { id: "calculator", label: "Pricing Calculator" },
                { id: "margin-breakdown", label: "Margin Breakdown" },
                { id: "pricing-tips", label: "Pricing Tips" },
                { id: "faqs", label: "FAQs" },
            ]}
        >
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">
                Service Pricing & Profit Calculator
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                Too many contractors price by gut feel or by matching competitors. Use this calculator to build pricing based on your actual costs and desired margins — so every job is profitable by design, not by accident.
            </p>

            <section id="calculator" className="mb-10">
                <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
                    <h2 className="text-xl font-bold text-foreground mb-6">Your Cost Inputs</h2>

                    <div className="space-y-6">
                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-sm font-medium">Burdened labor rate ($/hour)</label>
                                <span className="text-sm font-bold text-primary">${laborRate}</span>
                            </div>
                            <input type="range" min={25} max={120} step={1} value={laborRate} onChange={(e) => setLaborRate(Number(e.target.value))} className="w-full accent-primary" />
                            <p className="text-xs text-muted-foreground mt-1">Include wages, taxes, insurance, vehicle, and benefits</p>
                        </div>

                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-sm font-medium">Desired gross margin</label>
                                <span className="text-sm font-bold text-primary">{desiredMargin}%</span>
                            </div>
                            <input type="range" min={30} max={75} step={1} value={desiredMargin} onChange={(e) => setDesiredMargin(Number(e.target.value))} className="w-full accent-primary" />
                        </div>

                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-sm font-medium">Average job duration (hours)</label>
                                <span className="text-sm font-bold text-primary">{avgJobHours}h</span>
                            </div>
                            <input type="range" min={0.5} max={8} step={0.25} value={avgJobHours} onChange={(e) => setAvgJobHours(Number(e.target.value))} className="w-full accent-primary" />
                        </div>

                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-sm font-medium">Average material cost per job</label>
                                <span className="text-sm font-bold text-primary">${materialCost}</span>
                            </div>
                            <input type="range" min={0} max={500} step={5} value={materialCost} onChange={(e) => setMaterialCost(Number(e.target.value))} className="w-full accent-primary" />
                        </div>

                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-sm font-medium">Trip charge / dispatch fee</label>
                                <span className="text-sm font-bold text-primary">${tripCharge}</span>
                            </div>
                            <input type="range" min={0} max={199} step={1} value={tripCharge} onChange={(e) => setTripCharge(Number(e.target.value))} className="w-full accent-primary" />
                        </div>
                    </div>

                    {/* Results */}
                    <div className="mt-8 pt-6 border-t border-border">
                        <h3 className="text-lg font-bold text-foreground mb-4">Recommended Pricing</h3>
                        <div className="grid md:grid-cols-3 gap-4 mb-4">
                            <div className="rounded-xl bg-primary/10 border border-primary/20 p-4 text-center">
                                <div className="text-sm text-muted-foreground mb-1">Recommended Price</div>
                                <div className="text-2xl font-bold text-primary">${recommendedPrice}</div>
                            </div>
                            <div className="rounded-xl bg-muted/50 border border-border p-4 text-center">
                                <div className="text-sm text-muted-foreground mb-1">Price Range</div>
                                <div className="text-2xl font-bold text-foreground">${lowEnd}–${highEnd}</div>
                            </div>
                            <div className="rounded-xl bg-muted/50 border border-border p-4 text-center">
                                <div className="text-sm text-muted-foreground mb-1">Gross Profit</div>
                                <div className="text-2xl font-bold text-foreground">${grossProfit}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section id="margin-breakdown" className="mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">Margin Breakdown</h2>
                <div className="rounded-xl border border-border bg-card p-6">
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">Labor cost ({avgJobHours}h × ${laborRate}/hr)</span><span className="font-medium">${laborCost}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Materials</span><span className="font-medium">${materialCost}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Trip charge</span><span className="font-medium">${tripCharge}</span></div>
                        <div className="flex justify-between border-t pt-2"><span className="font-medium">Total cost</span><span className="font-bold">${totalCost}</span></div>
                        <div className="flex justify-between"><span className="font-medium">Recommended price</span><span className="font-bold text-primary">${recommendedPrice}</span></div>
                        <div className="flex justify-between border-t pt-2"><span className="font-semibold text-primary">Gross profit</span><span className="font-bold text-primary">${grossProfit} ({effectiveMargin}%)</span></div>
                    </div>
                </div>
            </section>

            <section id="pricing-tips" className="mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">Pricing Tips for Contractors</h2>
                <ul className="list-disc pl-6 space-y-3 text-muted-foreground">
                    <li><strong className="text-foreground">Never price from the bottom up and hope for profit.</strong> Start with your desired margin and work backward to the price. That's what this calculator does.</li>
                    <li><strong className="text-foreground">Review your pricing quarterly.</strong> Labor costs, insurance, fuel, and materials change. Your pricing should change with them.</li>
                    <li><strong className="text-foreground">After-hours pricing should be 1.5–2x your standard rate.</strong> This compensates for disruption, overtime pay, and the premium value of immediate response.</li>
                    <li><strong className="text-foreground">Charge for diagnostics.</strong> A diagnostic fee ($49–$149) applied toward repairs filters out tire-kickers and gets you paid even if the customer declines the repair.</li>
                    <li><strong className="text-foreground">Build material markup into your pricing.</strong> Standard industry practice is 25–50% markup on materials. This covers procurement time, inventory costs, and warranty coverage.</li>
                </ul>
            </section>

            <section id="faqs">
                <FAQSection faqs={faqs} />
            </section>

            <ResourceCTA variant="demo" />

            <RelatedResources
                resources={[
                    { title: "Missed Call Revenue Calculator", description: "See how much revenue you lose from unanswered calls.", href: "/resources/missed-call-revenue-calculator/", tag: "Calculator" },
                    { title: "Increase Average Ticket Planner", description: "Grow your average job value with upsell strategies.", href: "/resources/increase-average-ticket/", tag: "Calculator" },
                    { title: "HVAC Price Shopper Script", description: "Handle price shoppers without leading with price.", href: "/resources/hvac-price-shopper-phone-script/", tag: "HVAC" },
                ]}
            />
        </ResourceLayout>
    );
};

export default ServicePricingCalculator;
