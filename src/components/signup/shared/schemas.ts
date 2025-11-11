import { z } from "zod";
import { businessDetailsSchema } from "@/components/wizard/types";

const areaCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\D/g, ""))
  .refine((value) => /^\d{3}$/.test(value), {
    message: "Area code must be exactly 3 digits",
  });

// Step 1: Lead Capture (both flows)
export const leadCaptureSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name too long"),
  email: z.string().trim().email("Invalid email address").max(255, "Email too long"),
  phone: z.string().trim().min(10, "Valid phone number required").max(20, "Phone too long"),
  areaCode: areaCodeSchema,
  companyName: z.string().trim().max(200, "Company name too long").optional(),
  companyWebsite: z.string()
    .trim()
    .url("Please enter a valid website URL (e.g., https://example.com)")
    .max(255, "Website URL too long")
    .optional()
    .or(z.literal('')),
  trade: z.string().max(100).optional(),
});

// Step 3: Plan Selection (both flows)
export const planSelectionSchema = z.object({
  planType: z.enum(['starter', 'professional', 'premium'], {
    required_error: "Please select a plan",
  }),
});

// Step 4: Payment (both flows)
export const paymentSchema = z.object({
  acceptTerms: z.boolean().refine(val => val === true, {
    message: "You must accept the terms to continue",
  }),
});

// Sales-only fields
export const salesDetailsSchema = z.object({
  trade: z.string().max(100).optional(),
  zipCode: z.string().optional(),
  serviceArea: z.string().max(200).optional(),
  businessHours: z.record(z.string()).optional(),
  emergencyPolicy: z.string().max(1000).optional(),
  assistantGender: z.enum(['female', 'male']).optional(),
  salesRepName: z.string().trim().min(1, "Sales rep name is required").max(100),
  referralCode: z.string().length(8).optional().or(z.literal('')),
});

// Combined schemas
export const trialSignupSchema = leadCaptureSchema
  .merge(businessDetailsSchema)
  .merge(planSelectionSchema)
  .merge(paymentSchema);

export const salesSignupSchema = leadCaptureSchema
  .merge(businessDetailsSchema)
  .merge(salesDetailsSchema)
  .merge(planSelectionSchema)
  .merge(paymentSchema);
