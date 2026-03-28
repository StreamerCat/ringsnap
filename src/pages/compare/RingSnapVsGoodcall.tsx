import { ComparisonPage, ComparisonConfig } from "@/components/compare/ComparisonPage";

const schema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "RingSnap vs Goodcall: AI Receptionist Comparison for Home Service Contractors",
  description:
    "Comparing RingSnap and Goodcall for HVAC, plumbing, electrical, and roofing contractors. RingSnap is purpose-built for home services with built-in CRM, emergency routing, and Jobber integration.",
  url: "https://getringsnap.com/compare/ringsnap-vs-goodcall",
  mainEntity: {
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Is RingSnap better than Goodcall for home service contractors?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "RingSnap is purpose-built for home service contractors with contractor-specific call logic, emergency routing for trades, a built-in CRM, and Jobber integration. Goodcall is a general-purpose AI phone agent that works across many business types but is not specialized for contractor workflows.",
        },
      },
    ],
  },
};

const config: ComparisonConfig = {
  seo: {
    title: "RingSnap vs Goodcall | AI Phone Agent Comparison for Contractors",
    description:
      "RingSnap vs Goodcall for HVAC, plumbing, electrical, and roofing contractors. Compare AI phone answering features, CRM capabilities, emergency routing, and pricing.",
    canonical: "https://getringsnap.com/compare/ringsnap-vs-goodcall",
  },
  hero: {
    eyebrow: "RingSnap vs Goodcall",
    h1: "RingSnap vs Goodcall: Built for contractors vs a general AI phone agent",
    intro:
      "Goodcall is an AI phone agent that handles calls for businesses across many industries. RingSnap is an AI receptionist built exclusively for home service contractors — with emergency routing designed for plumbers, HVAC techs, electricians, and roofers, plus a built-in CRM that captures every lead.",
  },
  competitor: {
    name: "Goodcall",
    description:
      "Goodcall is an AI phone agent designed for small and mid-size businesses across industries — restaurants, retail, medical offices, and others — that want automated call handling without a human receptionist.",
  },
  comparisonTable: [
    { feature: "Built specifically for home service contractors", ringsnap: true, competitor: false },
    { feature: "24/7 AI call answering", ringsnap: true, competitor: true },
    { feature: "Answers in under 1 second", ringsnap: true, competitor: "Varies" },
    { feature: "Contractor emergency routing (immediate transfer with context)", ringsnap: true, competitor: "Basic escalation" },
    { feature: "Automatic appointment booking", ringsnap: true, competitor: "Available" },
    { feature: "Built-in CRM with lead records", ringsnap: true, competitor: false },
    { feature: "Jobber integration", ringsnap: true, competitor: false },
    { feature: "AI urgency and job-type classification for trades", ringsnap: true, competitor: false },
    { feature: "Full call transcript per call", ringsnap: true, competitor: "Available" },
    { feature: "Trade-specific knowledge (HVAC, plumbing, electrical, roofing)", ringsnap: true, competitor: false },
    { feature: "Multi-language support (English + Spanish)", ringsnap: "Core & Pro plans", competitor: "Limited" },
    { feature: "Setup time", ringsnap: "~10 minutes", competitor: "Varies" },
  ],
  ringSnapStrengths: [
    "You're a home service contractor — RingSnap knows what 'no heat in December' means and routes it accordingly",
    "You need life-threatening emergencies escalated immediately with full context, not just a callback scheduled",
    "You want a built-in CRM so every call becomes a prioritized lead record your team can act on",
    "You need Jobber integration so call data flows into your field service workflow without re-entry",
    "You want AI that improves on your specific call patterns over time — not a static script",
    "You need contractor-specific job-type and urgency classification (routine, urgent, emergency)",
  ],
  competitorStrengths: [
    "You run a general small business (restaurant, retail, medical) where non-contractor AI templates are sufficient",
    "You need a lower-cost entry point for basic call deflection",
    "Your call handling requirements are simpler and don't involve emergency routing or lead scoring",
  ],
  whoShouldChoose: {
    ringsnap:
      "You're a home service contractor who needs AI that understands your trades, routes emergencies correctly, and turns every call into a lead record. You want something built for your industry — not adapted from a restaurant template.",
    competitor:
      "You run a general small business where basic AI call handling is sufficient and contractor-specific features aren't needed.",
  },
  verdict:
    "Goodcall is a capable general-purpose AI phone agent. RingSnap is the specialist — built for home service contractors with trade-specific logic, emergency routing, and a built-in CRM that general AI agents don't offer.",
  faqs: [
    {
      q: "Does Goodcall understand contractor emergency scenarios?",
      a: "Goodcall uses general AI call handling that can be configured for various business types. RingSnap's emergency logic is built specifically for home service trades — it knows that a burst pipe or no-heat call needs immediate escalation, not a callback scheduled.",
    },
    {
      q: "Does Goodcall have a built-in CRM?",
      a: "Goodcall captures call data but does not include a built-in CRM with lead records, urgency classification, and job-type tagging designed for contractor workflows. RingSnap creates a lead record for every call with the context your team needs to follow up.",
    },
    {
      q: "How do RingSnap and Goodcall compare on pricing?",
      a: "Both offer affordable entry points. RingSnap starts at $59/month for night and weekend coverage. Check Goodcall's current pricing on their website for a direct comparison.",
    },
    {
      q: "Can RingSnap replace Goodcall if I'm already using it?",
      a: "Yes. RingSnap setup takes about 10 minutes — forward your existing number to RingSnap. The 3-day free trial lets you test it with real calls before committing.",
    },
    {
      q: "Does RingSnap work for multiple trades?",
      a: "Yes. RingSnap is built for HVAC, plumbing, electrical, and roofing contractors. The call logic, urgency classification, and job-type tagging are all tuned for these four trades.",
    },
  ],
  schema,
  breadcrumbs: [
    { name: "Home", item: "https://getringsnap.com/" },
    { name: "Compare", item: "https://getringsnap.com/compare" },
    { name: "RingSnap vs Goodcall", item: "https://getringsnap.com/compare/ringsnap-vs-goodcall" },
  ],
};

const RingSnapVsGoodcall = () => <ComparisonPage config={config} />;
export default RingSnapVsGoodcall;
