import { ComparisonPage, ComparisonConfig } from "@/components/compare/ComparisonPage";

const schema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "RingSnap vs Ruby Receptionists: AI vs Human Answering for Contractors",
  description:
    "Comparing RingSnap and Ruby Receptionists for home service contractors. RingSnap is purpose-built for HVAC, plumbing, electrical, and roofing — with 24/7 AI answering and a built-in CRM.",
  url: "https://getringsnap.com/compare/ringsnap-vs-ruby",
  mainEntity: {
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Is RingSnap better than Ruby for contractors?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "RingSnap is purpose-built for home service contractors — HVAC, plumbing, electrical, roofing. It includes contractor-specific emergency routing, job-type classification, built-in CRM, and 24/7 AI coverage starting at $59/month. Ruby provides human receptionists that work well for general small businesses but are not specialized for contractor workflows.",
        },
      },
    ],
  },
};

const config: ComparisonConfig = {
  seo: {
    title: "RingSnap vs Ruby Receptionists | AI Answering for Home Service Contractors",
    description:
      "RingSnap vs Ruby: Which is better for HVAC, plumbing, electrical, and roofing contractors? Compare AI answering vs human virtual receptionists — features, pricing, and fit.",
    canonical: "https://getringsnap.com/compare/ringsnap-vs-ruby",
  },
  hero: {
    eyebrow: "RingSnap vs Ruby",
    h1: "RingSnap vs Ruby Receptionists: Built for contractors vs built for everyone",
    intro:
      "Ruby provides human virtual receptionists for small businesses. RingSnap is an AI receptionist built exclusively for home service contractors — with emergency routing, built-in CRM, and 24/7 availability that doesn't cost more after midnight.",
  },
  competitor: {
    name: "Ruby",
    description:
      "Ruby is a live virtual receptionist service that provides human agents to answer calls for small businesses across many industries, known for warm, professional service.",
  },
  comparisonTable: [
    { feature: "Built for home service contractors", ringsnap: true, competitor: false },
    { feature: "24/7 availability (including nights, weekends, holidays)", ringsnap: true, competitor: "Business hours + limited after-hours" },
    { feature: "Answers in under 1 second", ringsnap: true, competitor: "Human pickup time varies" },
    { feature: "Emergency call routing with context", ringsnap: true, competitor: "Message relay" },
    { feature: "Automatic appointment booking", ringsnap: true, competitor: "Limited / depends on plan" },
    { feature: "Built-in CRM with lead records", ringsnap: true, competitor: false },
    { feature: "Jobber integration", ringsnap: true, competitor: false },
    { feature: "Full call transcript + logs", ringsnap: true, competitor: "Summary notes" },
    { feature: "AI intent and urgency classification", ringsnap: true, competitor: false },
    { feature: "Multi-language support (English + Spanish)", ringsnap: "Core & Pro plans", competitor: "Depends on agent availability" },
    { feature: "Starting price", ringsnap: "$59/month", competitor: "Higher — see their site" },
    { feature: "Overage pricing model", ringsnap: "Flat monthly + clear per-call overage", competitor: "Per-minute / receptionist time" },
    { feature: "Setup time", ringsnap: "~10 minutes", competitor: "Onboarding required" },
    { feature: "Human warmth on every call", ringsnap: "AI voice — professional, not human", competitor: true },
  ],
  ringSnapStrengths: [
    "You run an HVAC, plumbing, electrical, or roofing business and need contractor-specific workflows",
    "You need true 24/7 coverage — including 2am burst pipes and weekend emergencies",
    "You want every call to create a lead record automatically without manual data entry",
    "You need emergency calls routed immediately with full context — not just a message",
    "You want lower cost at scale — flat monthly pricing vs per-minute human receptionist time",
    "You use Jobber or want CRM data from your calls without a separate tool",
    "You want consistent, instant pickup on every call — no wait time, no hold music",
  ],
  competitorStrengths: [
    "You want a real human voice on every call, not AI",
    "Your business handles complex, nuanced conversations that benefit from human judgment",
    "You serve industries beyond home services where contractor-specific AI isn't needed",
    "Your callers expect a highly personal, relationship-driven first interaction",
  ],
  whoShouldChoose: {
    ringsnap:
      "You're a home service contractor — plumber, HVAC tech, electrician, or roofer — who needs 24/7 call coverage, emergency routing, and a built-in CRM. You want every missed call captured as a lead, not a voicemail, at a price that makes sense for your volume.",
    competitor:
      "You run a general small business where human warmth is the primary priority, complex conversations are the norm, and you're comfortable with per-minute pricing for receptionist time.",
  },
  verdict:
    "Ruby is excellent for small businesses that value human connection above all else. RingSnap is built for home service contractors who need 24/7 coverage, contractor-specific emergency logic, and a built-in CRM — at a price that scales with the business, not per-minute with a human.",
  faqs: [
    {
      q: "Does RingSnap use real human receptionists?",
      a: "No. RingSnap uses AI voice that sounds professional and handles real contractor conversations — qualification, booking, emergency routing, and follow-up. It's not a human, but it answers every call in under 1 second, 24/7, including holidays. Ruby uses real human receptionists.",
    },
    {
      q: "Can Ruby handle contractor emergency calls at 2am?",
      a: "Ruby's live receptionist coverage has hours limitations. After-hours coverage depends on your plan and may involve message relay rather than live answering. RingSnap answers every call instantly, 24/7, and routes life-threatening emergencies to you immediately with full context.",
    },
    {
      q: "What does RingSnap cost compared to Ruby?",
      a: "RingSnap starts at $59/month for night and weekend coverage, and $129/month for full unlimited after-hours plus daytime overflow. Ruby's pricing is based on receptionist minutes and typically starts higher. Check Ruby's current pricing on their website.",
    },
    {
      q: "Does RingSnap have a built-in CRM like Ruby does?",
      a: "RingSnap has a built-in CRM that creates a lead record for every call — with job type, urgency, full transcript, and what was booked. Ruby provides call summaries and notes. RingSnap also integrates with Jobber.",
    },
    {
      q: "Can I switch from Ruby to RingSnap?",
      a: "Yes. RingSnap setup takes about 10 minutes. You forward your existing number to RingSnap. Credit card required to start the 3-day trial. You won't be charged until the trial ends. Your existing number stays the same.",
    },
  ],
  schema,
  breadcrumbs: [
    { name: "Home", item: "https://getringsnap.com/" },
    { name: "Compare", item: "https://getringsnap.com/compare" },
    { name: "RingSnap vs Ruby", item: "https://getringsnap.com/compare/ringsnap-vs-ruby" },
  ],
};

const RingSnapVsRuby = () => <ComparisonPage config={config} />;
export default RingSnapVsRuby;
