import { Home, Thermometer, Wrench, Zap, ClipboardList, GitCompareArrows } from "lucide-react";

export const tradeNavItems = [
  {
    title: "Plumbers",
    href: "/plumbers",
    description: "24/7 answering for emergency leaks and dispatch.",
    icon: Wrench,
  },
  {
    title: "HVAC",
    href: "/hvac",
    description: "Book tune-ups and capture emergency failures.",
    icon: Thermometer,
  },
  {
    title: "Electricians",
    href: "/electricians",
    description: "Safety-focused intake for sparkies and residential.",
    icon: Zap,
  },
  {
    title: "Roofing",
    href: "/roofing",
    description: "Capture storm leads and qualify insurance jobs.",
    icon: Home,
  },
] as const;

export const compareNavItems = [
  {
    title: "RingSnap vs Ruby",
    href: "/compare/ringsnap-vs-ruby",
    description: "AI vs human virtual receptionists for contractors.",
    icon: GitCompareArrows,
  },
  {
    title: "RingSnap vs Smith.ai",
    href: "/compare/ringsnap-vs-smith-ai",
    description: "Purpose-built vs general virtual receptionist.",
    icon: GitCompareArrows,
  },
  {
    title: "RingSnap vs Goodcall",
    href: "/compare/ringsnap-vs-goodcall",
    description: "Contractor-specific AI vs general AI phone agent.",
    icon: GitCompareArrows,
  },
  {
    title: "AI vs Live Answering",
    href: "/compare/ai-receptionist-vs-live-answering",
    description: "Which is better for home service contractors?",
    icon: GitCompareArrows,
  },
  {
    title: "Best AI Receptionist for Home Services",
    href: "/compare/best-ai-receptionist-home-services",
    description: "Buyer's guide: 6 criteria that matter for contractors.",
    icon: ClipboardList,
  },
] as const;

export const topLevelNavItems = [
  { label: "Why RingSnap", href: "/difference" },
  { label: "Built-In CRM", href: "/crm" },
  { label: "Field Guides", href: "/resources" },
  { label: "Pricing", href: "/pricing" },
] as const;
