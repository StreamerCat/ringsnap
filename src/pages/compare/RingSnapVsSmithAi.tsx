import { ComparisonPage, ComparisonConfig } from "@/components/compare/ComparisonPage";

const schema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "RingSnap vs Smith.ai: AI Receptionist Comparison for Home Service Contractors",
  description:
    "Comparing RingSnap and Smith.ai for HVAC, plumbing, electrical, and roofing contractors. RingSnap is purpose-built for home services with built-in CRM and contractor-specific emergency routing.",
  url: "https://getringsnap.com/compare/ringsnap-vs-smith-ai",
  mainEntity: {
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Is RingSnap better than Smith.ai for contractors?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "For home service contractors specifically, RingSnap offers contractor-specific call handling, emergency routing built for trades, a built-in CRM with lead records, and Jobber integration — all purpose-built for HVAC, plumbing, electrical, and roofing. Smith.ai is a strong general-purpose virtual receptionist service but is not specialized for contractor workflows.",
        },
      },
    ],
  },
};

const config: ComparisonConfig = {
  seo: {
    title: "RingSnap vs Smith.ai | AI Receptionist for Home Service Contractors",
    description:
      "RingSnap vs Smith.ai: Compare AI receptionist options for HVAC, plumbing, electrical, and roofing contractors. Features, CRM, emergency routing, and pricing compared.",
    canonical: "https://getringsnap.com/compare/ringsnap-vs-smith-ai",
  },
  hero: {
    eyebrow: "RingSnap vs Smith.ai",
    h1: "RingSnap vs Smith.ai: Purpose-built for contractors vs general virtual receptionist",
    intro:
      "Smith.ai offers AI-assisted virtual receptionist services for a broad range of small businesses. RingSnap is built exclusively for home service contractors — with trade-specific emergency routing, built-in CRM, and 24/7 AI answering designed around how plumbers, HVAC techs, electricians, and roofers actually work.",
  },
  competitor: {
    name: "Smith.ai",
    description:
      "Smith.ai is a virtual receptionist service that combines AI with live agents to handle calls, chats, and outreach for a wide range of small to mid-size businesses.",
  },
  comparisonTable: [
    { feature: "Built specifically for home service contractors", ringsnap: true, competitor: false },
    { feature: "24/7 AI call answering", ringsnap: true, competitor: "AI + human hybrid" },
    { feature: "Answers in under 1 second", ringsnap: true, competitor: "Response time varies" },
    { feature: "Contractor emergency routing (life-threatening → immediate transfer)", ringsnap: true, competitor: "General escalation" },
    { feature: "Automatic appointment booking", ringsnap: true, competitor: "Available" },
    { feature: "Built-in CRM with lead records", ringsnap: true, competitor: false },
    { feature: "Jobber integration", ringsnap: true, competitor: false },
    { feature: "AI urgency and job-type classification", ringsnap: true, competitor: "Limited" },
    { feature: "Full call transcript per call", ringsnap: true, competitor: "Summary notes" },
    { feature: "Multi-language support (English + Spanish)", ringsnap: "Core & Pro plans", competitor: "Available" },
    { feature: "Starting price", ringsnap: "$59/month", competitor: "Higher — see their site" },
    { feature: "Setup time", ringsnap: "~10 minutes", competitor: "Onboarding required" },
    { feature: "Trade-specific call scripts (HVAC, plumbing, electrical, roofing)", ringsnap: true, competitor: false },
  ],
  ringSnapStrengths: [
    "You run an HVAC, plumbing, electrical, or roofing business — RingSnap's call logic is built around how your calls actually work",
    "You need life-threatening emergency calls transferred immediately with context, not just escalated to a queue",
    "You want a built-in CRM so every call becomes a lead record without extra tools or manual entry",
    "You need Jobber integration for lead data to flow directly into your field service workflow",
    "You want flat-rate pricing rather than per-call or per-minute billing that's harder to predict",
    "You need instant pickup on every call — no routing delays while AI and humans hand off",
  ],
  competitorStrengths: [
    "You run a business outside home services where generalist virtual reception is a better fit",
    "You want live human agents available as a fallback for sensitive or complex conversations",
    "You need multi-channel coverage (calls + web chat + outreach) from a single vendor",
    "Your callers expect a clearly human interaction on every call",
  ],
  whoShouldChoose: {
    ringsnap:
      "You're a home service contractor who needs 24/7 call coverage with contractor-specific logic, emergency routing, and a built-in CRM. You want clean lead records from every call and Jobber integration without piecing together multiple tools.",
    competitor:
      "You run a general small business that needs live human backup across calls and chat, and you're not specifically in the home service trades.",
  },
  verdict:
    "Smith.ai is a capable general-purpose virtual receptionist service. RingSnap is the purpose-built option for home service contractors — trade-specific call handling, emergency routing, built-in CRM, and Jobber integration in a single platform.",
  faqs: [
    {
      q: "Does Smith.ai have a built-in CRM for contractors?",
      a: "Smith.ai integrates with general CRMs like Salesforce and HubSpot, but is not built specifically for home service contractor workflows. RingSnap's built-in CRM creates lead records with job type, urgency, and transcript data tailored to HVAC, plumbing, electrical, and roofing businesses.",
    },
    {
      q: "How does RingSnap handle emergencies differently than Smith.ai?",
      a: "RingSnap's emergency routing is built around home service emergency patterns — burst pipes, no heat in winter, power outages. Life-threatening emergencies trigger an immediate transfer to you with full context in under 5 seconds. Smith.ai uses general escalation logic not specific to contractor emergency scenarios.",
    },
    {
      q: "What does RingSnap cost vs Smith.ai?",
      a: "RingSnap starts at $59/month for night and weekend coverage, and $129/month for full after-hours plus daytime overflow. Smith.ai's pricing is based on call volume and typically starts higher for comparable coverage. Check Smith.ai's current pricing on their website.",
    },
    {
      q: "Can I use RingSnap alongside Smith.ai?",
      a: "Most contractors use RingSnap as their primary call handling solution — it covers 24/7 with contractor-specific logic. You wouldn't typically need both. Start with RingSnap's 3-day trial to see how it handles your call volume.",
    },
  ],
  schema,
  breadcrumbs: [
    { name: "Home", item: "https://getringsnap.com/" },
    { name: "Compare", item: "https://getringsnap.com/compare" },
    { name: "RingSnap vs Smith.ai", item: "https://getringsnap.com/compare/ringsnap-vs-smith-ai" },
  ],
};

const RingSnapVsSmithAi = () => <ComparisonPage config={config} />;
export default RingSnapVsSmithAi;
