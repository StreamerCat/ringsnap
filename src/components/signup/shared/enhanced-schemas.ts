import { z } from "zod";

/**
 * Enhanced Validation Schemas
 *
 * Improved error messages that are:
 * - Specific and actionable
 * - User-friendly and non-technical
 * - Include examples where helpful
 * - Meet accessibility standards (WCAG)
 */

// Name validation with helpful messages
export const nameSchema = z.string()
  .trim()
  .min(2, "Please enter your full name (at least 2 characters)")
  .max(100, "Name is too long (maximum 100 characters)")
  .regex(
    /^[a-zA-Z\s'\-\u00C0-\u024F]+$/,
    "Name can only contain letters, spaces, hyphens, and apostrophes"
  );

// Email validation with specific guidance
export const emailSchema = z.string()
  .trim()
  .min(1, "Email address is required")
  .email("Please enter a valid email address (e.g., name@company.com)")
  .max(255, "Email address is too long (maximum 255 characters)")
  .toLowerCase();

// Phone validation with format example
export const phoneSchema = z.string()
  .trim()
  .min(1, "Phone number is required")
  .regex(
    /^(\+1[\s\-]?)?(\(?\d{3}\)?[\s\-]?)\d{3}[\s\-]?\d{4}$/,
    "Please enter a valid phone number (e.g., (555) 123-4567)"
  );

// Company name validation
export const companyNameSchema = z.string()
  .trim()
  .min(2, "Please enter your company or business name (at least 2 characters)")
  .max(200, "Company name is too long (maximum 200 characters)");

// ZIP code validation with clear format
export const zipCodeSchema = z.string()
  .trim()
  .regex(/^\d{5}$/, "Please enter a valid 5-digit ZIP code (e.g., 90210)");

// Website validation with auto-formatting
export const websiteSchema = z.string()
  .trim()
  .min(1, "Website is required")
  .transform((val) => {
    const value = val.trim();

    // Handle email format (extract domain)
    if (value.includes("@") && !value.startsWith("http")) {
      const domain = value.split("@")[1];
      return `https://www.${domain}`;
    }

    // Add https:// if not present
    if (!/^https?:\/\//i.test(value)) {
      return `https://${value}`;
    }

    return value;
  })
  .pipe(
    z.string().url("Please enter a valid website URL or domain name")
  )
  .optional()
  .or(z.literal(''));

// Trade/Industry selection
export const tradeSchema = z.string()
  .min(1, "Please select your trade or industry")
  .max(100, "Trade name is too long");

// Service area validation
export const serviceAreaSchema = z.string()
  .trim()
  .min(1, "Please describe your service area (e.g., 'Dallas/Fort Worth Metro')")
  .max(200, "Service area description is too long (maximum 200 characters)");

// Emergency policy validation
export const emergencyPolicySchema = z.string()
  .trim()
  .min(10, "Please provide details about your emergency call policy (at least 10 characters)")
  .max(1000, "Emergency policy is too long (maximum 1000 characters)");

// Business hours validation
const dayScheduleSchema = z.object({
  open: z.boolean(),
  openTime: z.string().optional(),
  closeTime: z.string().optional(),
});

export const businessHoursSchema = z.object({
  monday: dayScheduleSchema,
  tuesday: dayScheduleSchema,
  wednesday: dayScheduleSchema,
  thursday: dayScheduleSchema,
  friday: dayScheduleSchema,
  saturday: dayScheduleSchema,
  sunday: dayScheduleSchema,
});

// Assistant gender selection
export const assistantGenderSchema = z.enum(['male', 'female'], {
  required_error: "Please select a voice for your assistant",
  invalid_type_error: "Assistant voice must be either 'male' or 'female'"
}).default('female');

// Plan type selection
export const planTypeSchema = z.enum(['starter', 'professional', 'premium'], {
  required_error: "Please select a plan to continue",
  invalid_type_error: "Please choose a valid plan option"
});

// Sales rep name validation
export const salesRepNameSchema = z.string()
  .trim()
  .min(1, "Sales representative name is required")
  .max(100, "Sales rep name is too long (maximum 100 characters)");

// Referral code validation (exactly 8 characters or empty)
export const referralCodeSchema = z
  .string()
  .trim()
  .transform((val) => val ? val.toUpperCase() : "")
  .pipe(
    z.union([
      z.literal(""),
      z.string().length(8, "Referral code must be exactly 8 characters")
    ])
  )
  .optional();

// Area code validation (extracted from phone or ZIP)
export const areaCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\D/g, ""))
  .pipe(
    z.string().regex(/^\d{3}$/, "Area code must be exactly 3 digits")
  )
  .optional();

// Terms acceptance validation
export const termsAcceptanceSchema = z.boolean().refine(
  (val) => val === true,
  {
    message: "You must accept the terms and conditions to continue"
  }
);

// Primary goal selection for trial flow
export const primaryGoalSchema = z.enum([
  "book_appointments",
  "capture_leads",
  "answer_questions",
  "take_orders"
], {
  required_error: "Please select your primary business goal",
}).optional();

/**
 * Enhanced Lead Capture Schema
 * Used in both trial and sales flows
 */
export const enhancedLeadCaptureSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  areaCode: areaCodeSchema,
  companyName: companyNameSchema.optional(),
  website: websiteSchema,
  trade: tradeSchema.optional(),
});

/**
 * Enhanced Trial Signup Schema
 * Complete schema for self-serve trial flow
 */
export const enhancedTrialSignupSchema = z.object({
  // Step 1: User Info
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,

  // Step 2: Business Basics
  companyName: companyNameSchema,
  trade: tradeSchema,
  website: websiteSchema,
  zipCode: zipCodeSchema,

  // Step 3: Business Advanced
  primaryGoal: primaryGoalSchema,
  businessHours: z.string().optional(),

  // Step 4: Voice
  assistantGender: assistantGenderSchema,

  // Step 5: Plan
  planType: planTypeSchema,
});

/**
 * Enhanced Sales Signup Schema
 * Complete schema for sales-assisted flow
 */
export const enhancedSalesSignupSchema = z.object({
  // Customer Info
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  companyName: companyNameSchema,
  website: websiteSchema,
  trade: tradeSchema,

  // Business Details
  serviceArea: serviceAreaSchema,
  businessHours: businessHoursSchema,
  emergencyPolicy: emergencyPolicySchema,
  zipCode: zipCodeSchema,
  assistantGender: assistantGenderSchema,
  referralCode: referralCodeSchema,

  // Sales Config
  planType: planTypeSchema,
  salesRepName: salesRepNameSchema,
});

/**
 * Payment Schema (shared across flows)
 */
export const enhancedPaymentSchema = z.object({
  acceptTerms: termsAcceptanceSchema,
});

/**
 * Helper function to get user-friendly field labels
 * Useful for error messages and form labels
 */
export const fieldLabels: Record<string, string> = {
  name: "Full Name",
  email: "Email Address",
  phone: "Phone Number",
  companyName: "Company or Business Name",
  website: "Company Website",
  trade: "Trade or Industry",
  zipCode: "ZIP Code",
  serviceArea: "Service Area",
  businessHours: "Business Hours",
  emergencyPolicy: "Emergency Call Policy",
  assistantGender: "Assistant Voice",
  referralCode: "Referral Code",
  planType: "Plan Selection",
  salesRepName: "Sales Representative",
  areaCode: "Area Code",
  acceptTerms: "Terms & Conditions",
  primaryGoal: "Primary Business Goal",
};

/**
 * Helper function to get placeholder text for fields
 */
export const fieldPlaceholders: Record<string, string> = {
  name: "John Smith",
  email: "john@yourcompany.com",
  phone: "(555) 123-4567",
  companyName: "ABC Plumbing",
  website: "yourcompany.com or email@domain.com",
  trade: "Select your trade",
  zipCode: "90210",
  serviceArea: "Dallas/Fort Worth Metro",
  emergencyPolicy: "Describe how emergency calls should be handled...",
  referralCode: "Enter code (optional)",
  salesRepName: "Your name",
  areaCode: "555",
};

/**
 * Helper function to get help text for fields
 */
export const fieldHelpText: Record<string, string> = {
  email: "We'll use this for account access and important notifications",
  phone: "Used for account verification and login codes",
  website: "You can enter a URL or email address - we'll extract the domain",
  referralCode: "Have a referral code? Enter it here for special benefits",
  assistantGender: "Choose the voice your customers will hear",
  businessHours: "When should your AI assistant handle calls?",
  emergencyPolicy: "How should urgent or emergency calls be handled?",
};
