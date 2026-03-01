import { Helmet } from "react-helmet-async";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

interface FAQItem {
    question: string;
    answer: string;
}

interface FAQSectionProps {
    faqs: FAQItem[];
    title?: string;
}

export const FAQSection = ({ faqs, title = "Frequently Asked Questions" }: FAQSectionProps) => {
    const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: {
                "@type": "Answer",
                text: faq.answer,
            },
        })),
    };

    return (
        <section className="my-12">
            <Helmet>
                <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
            </Helmet>
            <h2 className="text-2xl font-bold text-foreground mb-6">{title}</h2>
            <Accordion type="single" collapsible className="space-y-2">
                {faqs.map((faq, index) => (
                    <AccordionItem
                        key={index}
                        value={`faq-${index}`}
                        className="rounded-xl border border-border bg-card px-4"
                    >
                        <AccordionTrigger className="text-left font-semibold text-sm py-4 hover:no-underline">
                            {faq.question}
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">
                            {faq.answer}
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </section>
    );
};
