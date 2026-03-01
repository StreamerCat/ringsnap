import { ResourceLayout } from "@/components/resources/ResourceLayout";
import { CopyableScriptBlock } from "@/components/resources/CopyableScriptBlock";
import { ResourceCTA } from "@/components/resources/ResourceCTA";
import { RelatedResources } from "@/components/resources/RelatedResources";
import { FAQSection } from "@/components/resources/FAQSection";
import { ChecklistBlock } from "@/components/resources/ChecklistBlock";

const toc = [
    { id: "why-price-shoppers", label: "Why Price Shoppers Call" },
    { id: "script", label: "Price Shopper Script" },
    { id: "value-framework", label: "Value-First Framework" },
    { id: "checklist", label: "Price Shopper Checklist" },
    { id: "faqs", label: "FAQs" },
];

const faqs = [
    { question: "Should I give prices over the phone?", answer: "Give a range, not a firm number. 'Our tune-ups typically run between $89 and $149, depending on your system type and what we find.' A range is honest, gives room for value discussion, and prevents the caller from using your exact price to shop the next company." },
    { question: "What if the caller insists on a firm price?", answer: "Acknowledge their need and redirect: 'I totally understand wanting to know what you're getting into. The reason I can't give you an exact number is that the cost depends on your specific system and what our tech finds. What I can tell you is that our diagnostic fee is $XX, which goes toward any repair — so you'll know exactly what you need and what it costs before we do any work.'" },
    { question: "How many price shoppers actually book?", answer: "Industry average is 15–20%. Shops with trained dispatchers using value-first scripts convert 35–45% of price shoppers. The difference is entirely in the script — same callers, different outcome." },
    { question: "Should I match competitor pricing?", answer: "No. Matching prices is a race to the bottom. Instead, articulate your value: experience, warranties, speed, reviews, certifications. Callers who only want the cheapest price are your worst customers — low margin, high complaint rate, and no loyalty." },
];

const HvacPriceShopperScript = () => (
    <ResourceLayout
        title="HVAC Price Shopper Phone Script (Free Template) | RingSnap"
        metaDescription="Free phone script for handling HVAC price shoppers. Convert more price calls into booked jobs using a value-first approach. Copy, paste, and use today."
        canonical="/resources/hvac-price-shopper-phone-script/"
        keywords="hvac price shopper script, hvac price shopping phone, handle hvac price shoppers, hvac tune up price script"
        breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Resources", href: "/resources/" },
            { label: "HVAC Dispatcher Scripts", href: "/resources/hvac-dispatcher-script-template/" },
            { label: "Price Shopper Script" },
        ]}
        toc={toc}
    >
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">
            HVAC Price Shopper Phone Script
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed mb-8">
            "How much do you charge for a tune-up?" Every HVAC shop hears this 10+ times a week. Most dispatchers give the price, lose the caller, and move on. Top shops convert 35–45% of price shoppers into booked jobs. The difference? This script.
        </p>

        <section id="why-price-shoppers" className="mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-4">Why Price Shoppers Call (And Why They're Not Bad Leads)</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
                Price shoppers aren't cheap – they're uninformed. They don't know how to evaluate HVAC companies, so they default to the one metric anyone understands: cost. Your job isn't to avoid the price question — it's to add context around the price that makes your value obvious.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
                Think about it from the caller's perspective. They've never hired an HVAC company before, or their usual guy retired. They Google "AC tune-up near me," see 5 companies, and start calling. They ask about price because they literally don't know what else to ask. The company that educates them wins the job.
            </p>
            <p className="text-muted-foreground leading-relaxed">
                The worst thing you can do is give a flat price and wait for their response. "$89." Silence. "OK, thanks." Click. That caller just called 4 more companies and booked with whoever seemed most professional — which was probably the one who actually talked to them about their system.
            </p>
        </section>

        <section id="script" className="mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-4">Copy/Paste Price Shopper Phone Script</h2>

            <CopyableScriptBlock
                title="HVAC Price Shopper Script — Tune-Up Inquiry"
                scenario="Caller asks about pricing for tune-ups, diagnostics, or repairs"
                script={`[Caller: "How much do you charge for an AC tune-up?"]

"Great question — and I want to make sure I give you the most accurate answer. Our tune-ups range from [$X to $Y] depending on your system type and what we find during the inspection.

But here's what makes our tune-up different from a lot of companies: we don't just check a few boxes and leave. Our techs do a full [XX]-point inspection — we test your system's efficiency, check refrigerant levels, clean the coils, inspect the electrical connections, and walk you through everything we find. With photos.

If we catch something early — and we usually do — you're saving yourself a breakdown in the middle of [summer/winter] and a $500+ emergency repair.

We've been doing this for [X years], we're rated [X stars] on Google, and all our work comes with a [warranty details].

I actually have availability [today/tomorrow/this week]. Would you like me to get you on the schedule?"

[If they hesitate:]

"No pressure at all. I can send you our details along with some reviews from other homeowners. Can I get your email? And if you have any other questions, feel free to call me back — I'm [Your Name]."

[This keeps the door open and captures their email for follow-up]`}
            />

            <CopyableScriptBlock
                title="Price Shopper Script — Repair Inquiry"
                scenario="Caller asks how much a specific repair costs"
                script={`[Caller: "How much does it cost to fix a [specific issue]?"]

"That's a smart question. I wish I could give you an exact number, but [specific issue] can have a few different causes, and the cost depends on which one it is.

Here's what I can tell you: our diagnostic fee is [$XX]. Our tech will come out, identify exactly what's wrong, and give you a firm quote before doing any work. That diagnostic fee applies toward the repair — so you're not paying twice.

Most [specific issue] repairs run between [$range], but I don't want to guess and risk giving you the wrong number. The diagnostic gives you the real answer.

I have a spot open [today/tomorrow]. Can I get your name and address?"

[This is honest, professional, and avoids the trap of quoting blind]`}
            />
        </section>

        <section id="value-framework" className="mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-4">The Value-First Framework</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
                Every price shopper conversation follows the same structure. Memorize this framework and you'll never fumble a pricing question again:
            </p>
            <ol className="list-decimal pl-6 space-y-3 text-muted-foreground">
                <li><strong className="text-foreground">Acknowledge the question.</strong> Don't dodge it. "Great question" or "That's a smart thing to ask" shows respect.</li>
                <li><strong className="text-foreground">Give a range, not a number.</strong> "$89 to $149" is honest and gives you room. A single number gets shopped.</li>
                <li><strong className="text-foreground">Explain what they get.</strong> 30-point inspection, photos, efficiency test. Paint the picture of a thorough, professional visit.</li>
                <li><strong className="text-foreground">Differentiate from competitors.</strong> Years in business, Google rating, warranty, same-day availability. Pick 2–3 that matter most to your market.</li>
                <li><strong className="text-foreground">Close with availability.</strong> "I have a spot open today" creates urgency and makes booking easy.</li>
                <li><strong className="text-foreground">If they hesitate, capture the email.</strong> A follow-up email with reviews converts 10–15% of shoppers who don't book on the first call.</li>
            </ol>
        </section>

        <section id="checklist" className="mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-4">Price Shopper Response Checklist</h2>
            <ChecklistBlock
                title="Price Shopper Call Checklist"
                items={[
                    "Acknowledged the pricing question (don't dodge)",
                    "Gave a price RANGE (not a single number)",
                    "Explained what's included (inspection points, photos, etc.)",
                    "Mentioned 2-3 differentiators (warranty, reviews, speed)",
                    "Offered same-day or next-day availability",
                    "If no book: captured email for follow-up",
                    "Remained friendly and non-pushy throughout",
                ]}
            />
        </section>

        <section id="faqs">
            <FAQSection faqs={faqs} />
        </section>

        <ResourceCTA variant="demo" trade="HVAC" />

        <RelatedResources
            resources={[
                { title: "HVAC Dispatcher Script Template", description: "Complete dispatcher scripts, benchmarks, and intake checklists.", href: "/resources/hvac-dispatcher-script-template/", tag: "Pillar" },
                { title: "HVAC After-Hours Answering Script", description: "After-hours script with emergency triage and overnight booking.", href: "/resources/hvac-after-hours-answering-script/", tag: "HVAC" },
                { title: "Service Pricing Calculator", description: "Build profitable pricing using your real labor and margin numbers.", href: "/resources/service-pricing-calculator/", tag: "Calculator" },
            ]}
        />
    </ResourceLayout>
);

export default HvacPriceShopperScript;
