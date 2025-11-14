/**
 * Trial Onboarding Entry Point
 * Exports both self-serve and sales-guided flows
 */

// Flow Orchestrators
export { SelfServeTrialFlow } from "./SelfServeTrialFlow";
export { SalesGuidedTrialFlow } from "./SalesGuidedTrialFlow";

// Shared Components (for custom compositions if needed)
export { UserInfoForm } from "./shared/UserInfoForm";
export { BusinessBasicsForm } from "./shared/BusinessBasicsForm";
export { BusinessAdvancedForm } from "./shared/BusinessAdvancedForm";
export { VoiceSelector } from "./shared/VoiceSelector";
export { PlanSelector } from "./shared/PlanSelector";
export { PaymentForm } from "./shared/PaymentForm";
export { ProvisioningStatus } from "./shared/ProvisioningStatus";
export { PhoneReadyPanel } from "./shared/PhoneReadyPanel";

// Types
export type {
  TrialSource,
  PlanType,
  AssistantGender,
  PrimaryGoal,
  ProvisioningStatus,
  UserInfo,
  BusinessBasics,
  BusinessExtended,
  AssistantConfig,
  PlanPayment,
  SalesTracking,
  TrialSignupPayload,
  TrialCreationResponse,
  AccountProvisioningInfo,
  PlanConfig,
  VoiceOption,
  OnboardingFlowCallbacks,
} from "./types";

// Utilities
export {
  formatPhoneE164,
  formatPhoneDisplay,
  getForwardingDigits,
  isValidEmail,
  isValidZipCode,
  getPlanPrice,
  getPlanName,
  getStripePriceId,
  getVoiceLabel,
  getTrialEndDate,
  formatDate,
  sleep,
  sanitizeBusinessName,
  generateAssistantName,
  isProvisioningComplete,
  isProvisioningFailed,
  isProvisioningInProgress,
  getSignupErrorMessage,
  debounce,
} from "./utils";
