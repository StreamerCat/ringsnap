/**
 * Shared Constants for Trial Onboarding Flows
 */

import type { PlanConfig, VoiceOption } from "./types";

/**
 * Available service trades
 * Shared between self-serve and sales flows
 */
export const TRADES = [
  "HVAC",
  "Plumbing",
  "Electrical",
  "Roofing",
  "General Contractor",
  "Landscaping",
  "Painting",
  "Carpentry",
  "Flooring",
  "Concrete",
  "Masonry",
  "Siding",
  "Windows & Doors",
  "Gutters",
  "Fencing",
  "Pest Control",
  "Pool Service",
  "Cleaning Services",
  "Appliance Repair",
  "Locksmith",
  "Garage Doors",
  "Home Inspection",
  "Handyman",
  "Drywall",
  "Insulation",
  "Solar Installation",
  "Security Systems",
  "Other",
] as const;

/**
 * Plan configurations with pricing and features
 */
export const PLANS: PlanConfig[] = [
  {
    value: "starter",
    name: "Night & Weekend",
    price: 59,
    calls: "150 min included/mo",
    features: [
      "Virtual receptionist",
      "Call forwarding",
      "After-hours + weekend coverage",
      "Email support",
    ],
  },
  {
    value: "professional",
    name: "Lite",
    price: 129,
    calls: "300 min included/mo",
    features: [
      "Everything in Night & Weekend, plus",
      "24/7 call answering",
      "Appointment booking with your calendar",
      "Priority support",
      "Google Calendar + Zapier",
    ],
    popular: true,
  },
  {
    value: "premium",
    name: "Core",
    price: 229,
    calls: "600 min included/mo",
    features: [
      "Everything in Lite, plus",
      "Priority support",
      "Branded voice options",
      "Custom escalation rules",
      "Multi-language (English + Spanish)",
    ],
  },
];

/**
 * Voice options for your Agent
 */
export const VOICE_OPTIONS: VoiceOption[] = [
  {
    value: "female",
    label: "Female Voice",
    description: "Professional and friendly",
    sampleUrl: "/audio/voice-sample-female.mp3", // TODO: Add actual samples
  },
  {
    value: "male",
    label: "Male Voice",
    description: "Confident and clear",
    sampleUrl: "/audio/voice-sample-male.mp3", // TODO: Add actual samples
  },
];

/**
 * Primary business goals
 */
export const PRIMARY_GOALS = [
  {
    value: "book_appointments",
    label: "Book Appointments",
    description: "Schedule service calls and manage calendar",
    icon: "📅",
  },
  {
    value: "capture_leads",
    label: "Capture Leads",
    description: "Collect contact information for follow-up",
    icon: "📝",
  },
  {
    value: "answer_questions",
    label: "Answer Questions",
    description: "Provide information about services and pricing",
    icon: "💬",
  },
  {
    value: "take_orders",
    label: "Take Orders",
    description: "Process sales and service requests",
    icon: "🛒",
  },
] as const;

/**
 * Provisioning polling intervals
 */
export const POLLING_INTERVALS = {
  SELF_SERVE: 3000, // 3 seconds (more patient users)
  SALES: 2000, // 2 seconds (faster for in-person demos)
} as const;

/**
 * Trial configuration
 */
export const TRIAL_CONFIG = {
  DURATION_DAYS: 3,
  NO_CHARGE_MESSAGE: "Your card will not be charged during the trial period",
} as const;

/**
 * Validation constraints
 */
export const VALIDATION = {
  NAME_MAX_LENGTH: 100,
  EMAIL_MAX_LENGTH: 255,
  COMPANY_NAME_MAX_LENGTH: 200,
  TRADE_MAX_LENGTH: 100,
  SERVICE_AREA_MAX_LENGTH: 200,
  BUSINESS_HOURS_MAX_LENGTH: 500,
  EMERGENCY_POLICY_MAX_LENGTH: 1000,
  CUSTOM_INSTRUCTIONS_MAX_LENGTH: 2000,
  SALES_REP_NAME_MAX_LENGTH: 100,
  ZIP_CODE_PATTERN: /^\d{5}$/,
  PHONE_MIN_LENGTH: 10,
} as const;

/**
 * Step labels for self-serve flow
 */
export const SELF_SERVE_STEPS = [
  { number: 1, label: "Your Information", description: "Basic contact details" },
  { number: 2, label: "Business Basics", description: "Company and trade" },
  { number: 3, label: "Business Details", description: "Optional configuration" },
  { number: 4, label: "Choose Voice", description: "Agent voice" },
  { number: 5, label: "Select Plan", description: "Choose your plan" },
  { number: 6, label: "Payment", description: "Secure payment setup" },
  { number: 7, label: "Setting Up", description: "Configuring Agent" },
  { number: 8, label: "Ready!", description: "Your phone is ready" },
] as const;

/**
 * Step labels for sales-guided flow
 */
export const SALES_STEPS = [
  { number: 1, label: "Customer Setup", description: "All information" },
  { number: 2, label: "Select Plan", description: "Choose plan" },
  { number: 3, label: "Payment", description: "Card information" },
  { number: 4, label: "Provisioning", description: "Setting up Agent" },
  { number: 5, label: "Demo Ready!", description: "Test your Agent" },
] as const;

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
  PAYMENT_SYSTEM_NOT_READY: "Payment system not ready. Please try again.",
  CARD_ELEMENT_NOT_FOUND: "Card element not found. Please refresh the page.",
  PAYMENT_FAILED: "Payment failed. Please check your card details.",
  TRIAL_CREATION_FAILED: "Trial creation failed. Please try again.",
  PROVISIONING_FAILED: "Failed to set up your RingSnap Agent. Please contact support.",
  NETWORK_ERROR: "Network error. Please check your connection.",
  VALIDATION_ERROR: "Please complete all required fields correctly.",
  TERMS_NOT_ACCEPTED: "Please accept the terms of service to continue.",
  CARD_INCOMPLETE: "Please complete card information.",
} as const;

/**
 * Success messages
 */
export const SUCCESS_MESSAGES = {
  ACCOUNT_ACTIVATED: "Account activated! Setting up RingSnap Agent...",
  PROVISIONING_COMPLETE: "Your RingSnap Agent is ready!",
  PAYMENT_VERIFIED: "Payment method verified successfully.",
} as const;
