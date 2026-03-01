import { useState } from "react";
import { ResourceLayout } from "@/components/resources/ResourceLayout";
import { ResourceCTA } from "@/components/resources/ResourceCTA";
import { FAQSection } from "@/components/resources/FAQSection";
import { RelatedResources } from "@/components/resources/RelatedResources";

const faqs = [
    { question: "What counts as an after-hours call?", answer: "Any call outside your regular business hours. For most contractors, that's before 8 AM, after 5 PM on weekdays, and all day on weekends and holidays. Track your phone system logs to see your actual after-hours volume." },
    { question: "What percentage of calls come after hours?", answer: "For most contractors, 25–40% of total call volume comes outside business hours. During peak seasons (winter for HVAC/plumbing, summer for HVAC/electrical), it can spike to 45–50%." },
    { question: "Are after-hours callers more likely to book?", answer: "Yes — significantly. After-hours callers are typically dealing with active emergencies and convert at 60–80% (compared to 28–35% for daytime calls). They're also willing to pay premium rates for immediate service." },
    { question: "Is it worth offering after-hours service?", answer: "In almost every case, yes. The revenue per call is higher (premium pricing), the booking rate is higher (urgency), and you're competing against fewer shops (most don't answer). Even if you only capture 50% of after-hours calls, the ROI is typically 5–10x the cost of coverage." },
];

const AfterHoursCalculator = () => {
    const [totalCalls, setTotalCalls] = useState(300);
    const [afterHoursPercent, setAfterHoursPercent] = useState(30);
    const [currentAnswerRate, setCurrentAnswerRate] = useState(15);
    const [bookingRate, setBookingRate] = useState(65);
    const [avgTicket, setAvgTicket] = useState(500);

    const afterHoursCalls = Math.round(totalCalls * (afterHoursPercent / 100));
    const currentAnswered = Math.round(afterHoursCalls * (currentAnswerRate / 100));
    const currentBooked = Math.round(currentAnswered * (bookingRate / 100));
    const currentRevenue = currentBooked * avgTicket;

    const potentialAnswered = Math.round(afterHoursCalls * 0.95);
    const potentialBooked = Math.round(potentialAnswered * (bookingRate / 100));
    const potentialRevenue = potentialBooked * avgTicket;

    const revenueGap = potentialRevenue - currentRevenue;
    const annualGap = revenueGap * 12;

    return (
        <ResourceLayout
            title="After-Hours Call Opportunity Calculator for Contractors | RingSnap"
            metaDescription="Calculate the revenue hiding in your after-hours call volume. Free calculator for HVAC, plumbing, and electrical contractors. See your monthly opportunity."
            canonical="/resources/after-hours-call-calculator/"
            keywords="after hours call calculator, contractor after hours revenue, after hours answering calculator, plumber after hours calls"
            breadcrumbs={[
                { label: "Home", href: "/" },
                { label: "Resources", href: "/resources/" },
                { label: "After-Hours Call Calculator" },
            ]}
            toc={[
                { id: "calculator", label: "Calculator" },
                { id: "the-gap", label: "The After-Hours Gap" },
                { id: "faqs", label: "FAQs" },
            ]}
        >
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">
                After-Hours Call Opportunity Calculator
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                Most contractor shops answer fewer than 15% of after-hours calls. Yet after-hours callers book at 2–3x the rate of daytime callers and pay premium prices. Use this calculator to see the revenue you're leaving on the table every month.
            </p>

            <section id="calculator" className="mb-10">
                <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
                    <h2 className="text-xl font-bold text-foreground mb-6">Your After-Hours Numbers</h2>

                    <div className="space-y-6">
                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-sm font-medium">Total monthly calls</label>
                                <span className="text-sm font-bold text-primary">{totalCalls}</span>
                            </div>
                            <input type="range" min={50} max={1000} step={10} value={totalCalls} onChange={(e) => setTotalCalls(Number(e.target.value))} className="w-full accent-primary" />
                        </div>

                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-sm font-medium">After-hours % of total calls</label>
                                <span className="text-sm font-bold text-primary">{afterHoursPercent}%</span>
                            </div>
                            <input type="range" min={10} max={60} step={1} value={afterHoursPercent} onChange={(e) => setAfterHoursPercent(Number(e.target.value))} className="w-full accent-primary" />
                        </div>

                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-sm font-medium">Current after-hours answer rate</label>
                                <span className="text-sm font-bold text-primary">{currentAnswerRate}%</span>
                            </div>
                            <input type="range" min={0} max={100} step={1} value={currentAnswerRate} onChange={(e) => setCurrentAnswerRate(Number(e.target.value))} className="w-full accent-primary" />
                        </div>

                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-sm font-medium">After-hours booking rate</label>
                                <span className="text-sm font-bold text-primary">{bookingRate}%</span>
                            </div>
                            <input type="range" min={20} max={90} step={1} value={bookingRate} onChange={(e) => setBookingRate(Number(e.target.value))} className="w-full accent-primary" />
                        </div>

                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-sm font-medium">Average after-hours ticket</label>
                                <span className="text-sm font-bold text-primary">${avgTicket}</span>
                            </div>
                            <input type="range" min={150} max={2000} step={25} value={avgTicket} onChange={(e) => setAvgTicket(Number(e.target.value))} className="w-full accent-primary" />
                        </div>
                    </div>

                    {/* Results */}
                    <div className="mt-8 pt-6 border-t border-border">
                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <h3 className="text-sm font-semibold text-muted-foreground mb-3">Current After-Hours Revenue</h3>
                                <div className="rounded-xl bg-muted/50 p-4 space-y-2 text-sm">
                                    <div className="flex justify-between"><span className="text-muted-foreground">After-hours calls</span><span className="font-medium">{afterHoursCalls}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Answered</span><span className="font-medium">{currentAnswered}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Booked</span><span className="font-medium">{currentBooked}</span></div>
                                    <div className="flex justify-between border-t pt-2"><span className="font-medium">Monthly revenue</span><span className="font-bold">${currentRevenue.toLocaleString()}</span></div>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-primary mb-3">With 95% Answer Rate</h3>
                                <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 space-y-2 text-sm">
                                    <div className="flex justify-between"><span className="text-muted-foreground">After-hours calls</span><span className="font-medium">{afterHoursCalls}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Answered</span><span className="font-medium text-primary">{potentialAnswered}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Booked</span><span className="font-medium text-primary">{potentialBooked}</span></div>
                                    <div className="flex justify-between border-t pt-2"><span className="font-medium">Monthly revenue</span><span className="font-bold text-primary">${potentialRevenue.toLocaleString()}</span></div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 rounded-xl bg-primary/10 border border-primary/20 p-5 text-center">
                            <div className="text-sm text-muted-foreground mb-1">Revenue opportunity you're missing</div>
                            <div className="text-3xl font-bold text-primary mb-1">${revenueGap.toLocaleString()}/month</div>
                            <div className="text-sm text-muted-foreground">${annualGap.toLocaleString()} per year</div>
                        </div>
                    </div>
                </div>
            </section>

            <section id="the-gap" className="mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">The After-Hours Gap: Why It Matters</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                    The after-hours gap is the single largest revenue opportunity for most contractor shops. Here's why:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                    <li><strong className="text-foreground">After-hours callers are high-intent.</strong> They're calling because they have an active problem. Booking rates are 2–3x higher than daytime calls.</li>
                    <li><strong className="text-foreground">Competition drops to near zero.</strong> When 88% of your competitors send after-hours calls to voicemail, you win by simply answering.</li>
                    <li><strong className="text-foreground">Premium pricing is expected.</strong> After-hours customers expect to pay 1.5–2x for emergency service. They're not shopping on price — they're shopping on availability.</li>
                    <li><strong className="text-foreground">One solution covers the gap.</strong> An AI receptionist can answer 100% of after-hours calls, triage emergencies, and book non-urgent appointments — all for less than the cost of one missed emergency call per month.</li>
                </ul>
            </section>

            <section id="faqs">
                <FAQSection faqs={faqs} />
            </section>

            <ResourceCTA variant="demo" />

            <RelatedResources
                resources={[
                    { title: "Missed Call Revenue Calculator", description: "Calculate total lost revenue from all missed calls.", href: "/resources/missed-call-revenue-calculator/", tag: "Calculator" },
                    { title: "HVAC After-Hours Script", description: "After-hours answering script with triage guide.", href: "/resources/hvac-after-hours-answering-script/", tag: "HVAC" },
                    { title: "Service Pricing Calculator", description: "Build profitable pricing including after-hours rates.", href: "/resources/service-pricing-calculator/", tag: "Calculator" },
                ]}
            />
        </ResourceLayout>
    );
};

export default AfterHoursCalculator;
