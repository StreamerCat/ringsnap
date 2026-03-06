import { z } from "zod";
import { enhancedSalesSignupSchema } from "@/components/signup/shared/enhanced-schemas";

/**
 * Sales Signup Form Types
 */

// Infer the type from the enhanced schema
export type SalesFormData = z.infer<typeof enhancedSalesSignupSchema>;

// API Response type
export type CreateSalesAccountResponse = {
  success?: boolean;
  userId?: string;
  accountId?: string | null;
  stripeCustomerId?: string | null;
  subscriptionId?: string | null;
  tempPassword: string;
  subscriptionStatus?: string | null;
  ringSnapNumber?: string | null;
  provisioned?: boolean;
  provisioningMessage?: string;
};

// Plan configuration
export interface PlanConfig {
  value: 'starter' | 'professional' | 'premium';
  name: string;
  price: number;
  calls: string;
  features: string[];
  recommended?: boolean;
}

// Available plans
export const PLANS: PlanConfig[] = [
  {
    value: 'starter',
    name: 'Night & Weekend',
    price: 59,
    calls: '150 min included',
    features: [
      'After-hours + weekend call answering',
      'Urgent transfer with full context',
      'Call recordings + transcripts',
      'CRM included'
    ]
  },
  {
    value: 'professional',
    name: 'Lite',
    price: 129,
    calls: '300 min included',
    features: [
      'Everything in Night & Weekend, plus',
      '24/7 call answering',
      'Appointment booking with your calendar',
      'Google Calendar + Zapier',
      'CRM included — full caller history'
    ],
    recommended: true
  },
  {
    value: 'premium',
    name: 'Core',
    price: 229,
    calls: '600 min included',
    features: [
      'Everything in Lite, plus',
      'Branded voice options',
      'Priority support',
      'Custom escalation rules',
      'Multi-language (English + Spanish)'
    ]
  }
];

// Section component props (for reusability)
export interface FormSectionProps<T = SalesFormData> {
  form: any; // UseFormReturn<T> - using any to avoid circular dependency
  isSubmitting?: boolean;
}
