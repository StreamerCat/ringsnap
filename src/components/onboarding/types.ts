/**
 * Shared Types for Trial Onboarding Flows
 * Used by both self-serve and sales-guided flows
 */

export type TrialSource = "website" | "sales" | "referral" | "partner";

export type PlanType = "starter" | "professional" | "premium";

export type AssistantGender = "male" | "female";

export type PrimaryGoal =
  | "book_appointments"
  | "capture_leads"
  | "answer_questions"
  | "take_orders";

export type ProvisioningStatus =
  | "pending"
  | "provisioning"
  | "active"
  | "failed";

/**
 * Common user information fields
 */
export interface UserInfo {
  name: string;
  email: string;
  phone: string;
}

/**
 * Basic business information (required for both flows)
 */
export interface BusinessBasics {
  companyName: string;
  trade: string;
}

/**
 * Extended business information (optional, varies by flow)
 */
export interface BusinessExtended {
  website?: string;
  serviceArea?: string;
  zipCode?: string;
  businessHours?: string;
  emergencyPolicy?: string;
  customInstructions?: string;
}

/**
 * AI assistant configuration
 */
export interface AssistantConfig {
  assistantGender: AssistantGender;
  primaryGoal?: PrimaryGoal;
}

/**
 * Plan and payment information
 */
export interface PlanPayment {
  planType: PlanType;
  paymentMethodId?: string;
}

/**
 * Sales tracking (sales flow only)
 */
export interface SalesTracking {
  salesRepName?: string;
}

/**
 * Complete trial signup payload
 * Sent to unified create-trial endpoint
 */
export interface TrialSignupPayload
  extends UserInfo,
    BusinessBasics,
    BusinessExtended,
    AssistantConfig,
    PlanPayment,
    SalesTracking {
  source: TrialSource;
}

/**
 * Response from create-trial endpoint
 */
export interface TrialCreationResponse {
  ok: boolean;
  account_id?: string;
  profile_id?: string;
  customer_id?: string;
  subscription_id?: string;
  error?: string;
}

/**
 * Account provisioning status
 */
export interface AccountProvisioningInfo {
  id: string;
  provisioning_status: ProvisioningStatus;
  vapi_phone_number: string | null;
  provisioning_error: string | null;
}

/**
 * Plan configuration
 */
export interface PlanConfig {
  value: PlanType;
  name: string;
  price: number;
  calls: string;
  features: string[];
  popular?: boolean;
}

/**
 * Voice option
 */
export interface VoiceOption {
  value: AssistantGender;
  label: string;
  description: string;
  sampleUrl?: string;
}

/**
 * Onboarding flow callbacks
 */
export interface OnboardingFlowCallbacks {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}
