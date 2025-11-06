import { z } from "zod";

// Wizard step enum
export enum WizardStep {
  BusinessEssentials = 0,
  PlanSelection = 1,
  BusinessDetails = 2,
  Payment = 3,
  PhoneNumberSelection = 4,
  SetupComplete = 5,
}

// Form validation schemas
export const businessEssentialsSchema = z.object({
  companyName: z.string().trim().min(1, "Company name required").max(200),
  trade: z.string().min(1, "Trade required"),
  serviceArea: z.string().trim().min(1, "Service area required").max(200),
  zipCode: z.string().trim().regex(/^\d{5}$/, "Valid 5-digit ZIP required"),
});

export const planSelectionSchema = z.object({
  planType: z.enum(['starter', 'professional', 'premium'], {
    required_error: "Select a plan to continue"
  }),
});

export const businessDetailsSchema = z.object({
  customerName: z.string().trim().min(1, "Name required").max(100),
  customerEmail: z.string().trim().email("Invalid email").max(255),
  customerPhone: z.string().trim().min(10, "Phone required").max(20),
  businessHours: z.string().trim().min(1, "Business hours required"),
  emergencyPolicy: z.string().trim().min(10, "Emergency policy required (min 10 characters)").max(1000),
  assistantGender: z.enum(['male', 'female']).default('female'),
  salesRepName: z.string().trim().min(1, "Sales rep name required").max(100),
});

export const phoneSelectionSchema = z.object({
  selectedAreaCode: z.string().trim().regex(/^\d{3}$/, "Valid 3-digit area code required"),
  selectedPhoneNumber: z.string().min(1, "Select a phone number"),
  selectedPhoneId: z.string().min(1, "Phone ID required"),
});

// Combined wizard form data
export interface WizardFormData {
  // Step 1: Business Essentials
  companyName: string;
  trade: string;
  serviceArea: string;
  zipCode: string;
  
  // Step 2: Plan Selection
  planType: 'starter' | 'professional' | 'premium';
  
  // Step 3: Business Details
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  businessHours: string;
  emergencyPolicy: string;
  assistantGender: 'male' | 'female';
  salesRepName: string;
  
  // Step 4: Payment (Stripe)
  paymentMethodId?: string;
  
  // Step 5: Phone Number Selection
  selectedAreaCode: string;
  selectedPhoneNumber?: string;
  selectedPhoneId?: string;
  
  // Backend responses
  accountId?: string;
  userId?: string;
  stripeCustomerId?: string;
  subscriptionId?: string;
  tempPassword?: string;
  vapiPhoneNumber?: string;
  vapiAssistantId?: string;
}

// Plan data
export const PLANS = [
  {
    value: 'starter' as const,
    name: 'Starter',
    price: 297,
    calls: '≤80',
    features: ['Basic AI voice', '24/7 coverage', 'Email support', 'Call recording', 'Basic analytics']
  },
  {
    value: 'professional' as const,
    name: 'Professional',
    price: 797,
    calls: '≤160',
    features: ['Advanced AI voice', 'Priority routing', 'Phone support', 'CRM integration', 'Advanced analytics'],
    popular: true
  },
  {
    value: 'premium' as const,
    name: 'Premium',
    price: 1497,
    calls: '>160',
    features: ['Voice cloning', 'Dedicated support', 'Custom integrations', 'Priority provisioning', 'Custom reporting']
  }
];

// Trade options
export const TRADES = [
  { value: 'hvac', label: 'HVAC' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrician', label: 'Electrician' },
  { value: 'landscaping', label: 'Landscaping' },
  { value: 'general_contractor', label: 'General Contractor' },
  { value: 'roofing', label: 'Roofing' },
  { value: 'pest_control', label: 'Pest Control' },
  { value: 'garage_door', label: 'Garage Door Repair' },
  { value: 'carpentry', label: 'Carpentry' },
  { value: 'painting', label: 'Painting' },
  { value: 'other', label: 'Other' },
];

// Parse business hours text to JSONB
export function parseBusinessHours(hoursText: string): object {
  try {
    return JSON.parse(hoursText);
  } catch {
    return { text: hoursText };
  }
}
