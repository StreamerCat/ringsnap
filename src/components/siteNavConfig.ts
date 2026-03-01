import { Home, Thermometer, Wrench, Zap } from "lucide-react";

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

export const topLevelNavItems = [
  { label: "Why RingSnap", href: "/difference" },
  { label: "Field Guides", href: "/resources" },
  { label: "Hear It Live", href: "/#live-demo" },
  { label: "Pricing", href: "/pricing" },
] as const;
