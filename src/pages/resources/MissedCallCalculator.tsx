import { useState } from "react";
import { ResourceLayout } from "@/components/resources/ResourceLayout";
import { ResourceCTA } from "@/components/resources/ResourceCTA";
import { FAQSection } from "@/components/resources/FAQSection";
import { RelatedResources } from "@/components/resources/RelatedResources";
import { Link } from "react-router-dom";

const toc = [
    { id: "calculator", label: "Revenue Calculator" },
    { id: "how-it-works", label: "How It Works" },
    { id: "recommendations", label: "Recommendations" },
    { id: "faqs", label: "FAQs" },
];

const faqs = [
    { question: "How do I know my answer rate?", answer: "Check your phone system's call log for the past 30 days. Count total inbound calls, then count how many were actually answered by a person (not voicemail). Divide answered by total — that's your answer rate. Most shops are surprised to find theirs is in the 55–70% range." },
    { question: "What's a good booking rate?", answer: "Industry average is 28–32%. Top performers hit 55–65%. If you're below 30%, improving your call scripts and training will have the biggest impact. Above 50% is excellent." },
    { question: "How is lost revenue calculated?", answer: "Lost revenue = missed calls × booking rate × average job value. If you miss 100 calls, book 30% of answered calls, and your average job is $400, you're losing ~30 × $400 = $12,000/month from missed calls alone." },
    { question: "Does this account for callers who call back?", answer: "No — this is a gross estimate. Some missed callers will call back, but industry data shows that 78% of callers who reach voicemail do NOT leave a message or call back. They call your competitor instead." },
];

const MissedCallCalculator = () => {
    const [callsPerMonth, setCallsPerMonth] = useState(250);
    const [answerRate, setAnswerRate] = useState(65);
    const [bookingRate, setBookingRate] = useState(30);
    const [avgJobValue, setAvgJobValue] = useState(400);
    const [emergencyPercent, setEmergencyPercent] = useState(25);

    const missedCalls = Math.round(callsPerMonth * (1 - answerRate / 100));
    const potentialBookings = Math.round(missedCalls * (bookingRate / 100));
    const lostRevenueMonthly = potentialBookings * avgJobValue;
    const lostRevenueAnnual = lostRevenueMonthly * 12;
    const emergencyLost = Math.round(missedCalls * (emergencyPercent / 100) * (bookingRate / 100) * avgJobValue * 1.5);

    const recommendations = [];
    if (answerRate < 80) {
        recommendations.push("Improve your answer rate to 90%+ with an AI receptionist or dedicated dispatcher. Every 10% improvement captures $" + Math.round(callsPerMonth * 0.1 * (bookingRate / 100) * avgJobValue).toLocaleString() + "/month in additional revenue.");
    }
    if (bookingRate < 50) {
        recommendations.push("Increase your booking rate with structured call scripts. Moving from " + bookingRate + "% to 50% would capture an additional $" + Math.round(missedCalls * ((50 - bookingRate) / 100) * avgJobValue).toLocaleString() + "/month from currently-missed calls alone.");
    }
    if (emergencyPercent > 15) {
        recommendations.push("Your emergency call volume (" + emergencyPercent + "%) suggests significant after-hours opportunity. After-hours emergency calls convert at 60-80% and carry premium pricing. Consider 24/7 coverage.");
    }

    return (
        <ResourceLayout
            title="Missed Call Revenue Calculator for Contractors | RingSnap"
            metaDescription="Calculate how much revenue your contractor shop loses from missed calls. Free calculator for HVAC, plumbing, and electrical businesses. See your monthly and annual losses."
            canonical="/resources/missed-call-revenue-calculator/"
            keywords="missed call revenue calculator, contractor missed call cost, plumber missed calls, hvac missed calls, electrician missed calls"
            breadcrumbs={[
                { label: "Home", href: "/" },
                { label: "Resources", href: "/resources/" },
                { label: "Missed Call Revenue Calculator" },
            ]}
            toc={toc}
            article={{ datePublished: "2026-01-15", dateModified: "2026-03-15" }}
        >
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">
                Missed Call Revenue Calculator
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                Every missed call is a potential job walking to your competitor. Use this calculator to see exactly how much revenue your shop loses from unanswered calls — then decide if it's a problem worth fixing.
            </p>

            {/* Calculator */}
            <section id="calculator" className="mb-10">
                <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
                    <h2 className="text-xl font-bold text-foreground mb-6">Your Numbers</h2>

                    <div className="space-y-6">
                        {/* Calls per month */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-medium text-foreground">Inbound calls per month</label>
                                <span className="text-sm font-bold text-primary">{callsPerMonth}</span>
                            </div>
                            <input
                                type="range"
                                min={50}
                                max={1000}
                                step={10}
                                value={callsPerMonth}
                                onChange={(e) => setCallsPerMonth(Number(e.target.value))}
                                className="w-full accent-primary"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                <span>50</span><span>1,000</span>
                            </div>
                        </div>

                        {/* Answer rate */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-medium text-foreground">Current answer rate</label>
                                <span className="text-sm font-bold text-primary">{answerRate}%</span>
                            </div>
                            <input
                                type="range"
                                min={20}
                                max={100}
                                step={1}
                                value={answerRate}
                                onChange={(e) => setAnswerRate(Number(e.target.value))}
                                className="w-full accent-primary"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                <span>20%</span><span>100%</span>
                            </div>
                        </div>

                        {/* Booking rate */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-medium text-foreground">Booking rate on answered calls</label>
                                <span className="text-sm font-bold text-primary">{bookingRate}%</span>
                            </div>
                            <input
                                type="range"
                                min={10}
                                max={80}
                                step={1}
                                value={bookingRate}
                                onChange={(e) => setBookingRate(Number(e.target.value))}
                                className="w-full accent-primary"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                <span>10%</span><span>80%</span>
                            </div>
                        </div>

                        {/* Average job value */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-medium text-foreground">Average job value</label>
                                <span className="text-sm font-bold text-primary">${avgJobValue}</span>
                            </div>
                            <input
                                type="range"
                                min={100}
                                max={2000}
                                step={25}
                                value={avgJobValue}
                                onChange={(e) => setAvgJobValue(Number(e.target.value))}
                                className="w-full accent-primary"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                <span>$100</span><span>$2,000</span>
                            </div>
                        </div>

                        {/* Emergency percent */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-medium text-foreground">Emergency call % (optional)</label>
                                <span className="text-sm font-bold text-primary">{emergencyPercent}%</span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={60}
                                step={1}
                                value={emergencyPercent}
                                onChange={(e) => setEmergencyPercent(Number(e.target.value))}
                                className="w-full accent-primary"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                <span>0%</span><span>60%</span>
                            </div>
                        </div>
                    </div>

                    {/* Results */}
                    <div className="mt-8 pt-6 border-t border-border">
                        <h3 className="text-lg font-bold text-foreground mb-4">Your Lost Revenue</h3>
                        <div className="grid md:grid-cols-3 gap-4">
                            <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-center">
                                <div className="text-sm text-muted-foreground mb-1">Missed calls / month</div>
                                <div className="text-2xl font-bold text-destructive">{missedCalls}</div>
                            </div>
                            <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-center">
                                <div className="text-sm text-muted-foreground mb-1">Lost revenue / month</div>
                                <div className="text-2xl font-bold text-destructive">${lostRevenueMonthly.toLocaleString()}</div>
                            </div>
                            <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-center">
                                <div className="text-sm text-muted-foreground mb-1">Lost revenue / year</div>
                                <div className="text-2xl font-bold text-destructive">${lostRevenueAnnual.toLocaleString()}</div>
                            </div>
                        </div>
                        {emergencyPercent > 0 && (
                            <p className="text-sm text-muted-foreground mt-4 text-center">
                                Of this, approximately <strong className="text-foreground">${emergencyLost.toLocaleString()}/month</strong> comes from missed emergency calls (at 1.5x job value).
                            </p>
                        )}
                    </div>
                </div>
            </section>

            {/* How it works */}
            <section id="how-it-works" className="mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">How This Calculator Works</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                    The math is straightforward: take the calls you're missing, apply your booking rate (the percentage you'd convert if you'd actually answered), and multiply by your average job value. That gives you the revenue you're leaving on the table every month.
                </p>
                <p className="text-muted-foreground leading-relaxed mb-4">
                    This is a conservative estimate. It doesn't account for referrals from those missed customers, the lifetime value of repeating clients, or the review-building opportunity each job represents. The actual cost of a missed call is 3–5x what this calculator shows.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                    It also doesn't account for the fact that 78% of callers who reach voicemail won't leave a message or call back — they call the next contractor on Google. So thinking "they'll call back" isn't a strategy.
                </p>
            </section>

            {/* Recommendations */}
            <section id="recommendations" className="mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">Your Top Recommendations</h2>
                {recommendations.length > 0 ? (
                    <div className="space-y-3">
                        {recommendations.map((rec, i) => (
                            <div key={i} className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex gap-3">
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                                    {i + 1}
                                </div>
                                <p className="text-sm text-foreground leading-relaxed">{rec}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-muted-foreground">Your numbers look solid! Your answer rate and booking rate are well above industry averages. Focus on consistency and continuous improvement.</p>
                )}
                <p className="text-muted-foreground leading-relaxed mt-4">
                    Want to see what your after-hours calls specifically are worth? Try the{" "}
                    <Link to="/resources/after-hours-call-calculator/" className="text-primary hover:underline">After-Hours Call Calculator</Link>.
                </p>
            </section>

            <section id="faqs">
                <FAQSection faqs={faqs} />
            </section>

            <ResourceCTA variant="demo" trade="contractor" service="contractor" />

            <RelatedResources
                resources={[
                    { title: "After-Hours Call Calculator", description: "Calculate revenue hiding in your after-hours volume.", href: "/resources/after-hours-call-calculator/", tag: "Calculator" },
                    { title: "HVAC Dispatcher Script Template", description: "Improve booking rate with proven call scripts.", href: "/resources/hvac-dispatcher-script-template/", tag: "HVAC" },
                    { title: "Plumbing Dispatcher Script Template", description: "Emergency scripts that capture more plumbing jobs.", href: "/resources/plumbing-dispatcher-script-template/", tag: "Plumbing" },
                ]}
            />
        </ResourceLayout>
    );
};

export default MissedCallCalculator;
