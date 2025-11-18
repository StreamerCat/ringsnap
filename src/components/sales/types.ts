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
    name: 'Starter',
    price: 297,
    calls: '≤80',
    features: [
      'AI phone answering 24/7',
      'Lead capture & qualification',
      'Email support',
      'Basic call analytics'
    ]
  },
  {
    value: 'professional',
    name: 'Professional',
    price: 797,
    calls: '≤160',
    features: [
      'Everything in Starter',
      'Priority call routing',
      'Advanced analytics',
      'Phone support',
      'CRM integrations'
    ],
    recommended: true
  },
  {
    value: 'premium',
    name: 'Premium',
    price: 1497,
    calls: '>160',
    features: [
      'Everything in Professional',
      'Custom voice cloning',
      'Dedicated account manager',
      'Custom integrations',
      'White-glove onboarding'
    ]
  }
];

// Section component props (for reusability)
export interface FormSectionProps<T = SalesFormData> {
  form: any; // UseFormReturn<T> - using any to avoid circular dependency
  isSubmitting?: boolean;
}
