/**
 * Feature Flags Configuration
 *
 * Simple feature flag system for RingSnap.
 * Flags can be controlled via environment variables or defaults.
 *
 * Environment Tier Detection:
 *   - Set VITE_ENV_TIER=prod|staging|dev in your .env file
 *   - Production defaults OFF for new features
 *   - Dev/staging defaults ON for new features
 *
 * Usage:
 *   import { featureFlags } from '@/lib/featureFlags';
 *   if (featureFlags.twoStepSignup) { ... }
 */

export interface FeatureFlags {
  /**
   * Enable the new two-step signup flow:
   * - Step 1: Minimal lead capture (name + email only)
   * - Step 2: Full chat onboarding with payment
   *
   * When disabled, falls back to the original single-step flow.
   *
   * Set via: VITE_FEATURE_TWO_STEP_SIGNUP=true
   */
  twoStepSignup: boolean;

  /**
   * Enable verbose logging for debugging signup flows.
   * Set via: VITE_DEBUG_SIGNUP=true
   */
  debugSignup: boolean;

  /**
   * Enable the Upgrade modal for plan upgrades in the dashboard.
   * When disabled, upgrade buttons redirect to Stripe billing portal instead.
   *
   * This is a "kill switch" - deploy UI fixes with flag off, then enable
   * upgrades when ready.
   *
   * Set via: VITE_FEATURE_UPGRADE_MODAL=true
   */
  upgradeModalEnabled: boolean;

  /**
   * Enable post-provisioning Activation screen (wow moment).
   * Shows phone number, test call CTA, and forwarding instructions.
   *
   * Default: OFF in production, ON in dev/staging
   * Set via: VITE_FEATURE_ACTIVATION_ONBOARDING=true
   */
  activationOnboardingEnabled: boolean;

  /**
   * Enable enhanced reporting UI (call details drawer, lead scores).
   *
   * Default: OFF in production, ON in dev/staging
   * Set via: VITE_FEATURE_REPORTING_WOW=true
   */
  reportingWowEnabled: boolean;

  // ============================================================================
  // Sprint 2026-01-04: Dashboard & Onboarding Fixes
  // ============================================================================

  /**
   * Enable activation troubleshooting UI.
   * Shows guidance panel after timeout if test call not detected.
   * Set via: VITE_FEATURE_ACTIVATION_TROUBLESHOOTING=true
   */
  activationTroubleshooting: boolean;

  /**
   * Enable tag confidence indicators in call logs.
   * Shows dashed border for inferred tags, solid for structured/transcript.
   * Set via: VITE_FEATURE_TAGGING_CONFIDENCE_UI=true
   */
  taggingConfidenceUi: boolean;

  /**
   * Enable Add Phone Number flow for eligible plans.
   * Shows modal wizard for Professional/Premium users.
   * Set via: VITE_FEATURE_ADD_PHONE_NUMBER_FLOW=true
   */
  addPhoneNumberFlow: boolean;

  /**
   * Enable safe offset positioning for Vapi widget on mobile.
   * Prevents widget from overlapping CTAs.
   * Set via: VITE_FEATURE_WIDGET_SAFE_OFFSET=true
   */
  widgetSafeOffset: boolean;

  /**
   * Enable immediate call recording toggle effect.
   * Triggers Vapi assistant rebuild when recording toggled.
   * Set via: VITE_FEATURE_CALL_RECORDING_IMMEDIATE_APPLY=true
   */
  callRecordingImmediateApply: boolean;

  /**
   * KILL SWITCH: Enable onboarding route guard.
   * When enabled, users with onboarding_completed_at IS NULL redirect to /activation.
   * Set to false to disable guard and allow all users to access /dashboard.
   * 
   * Default: true (guard enabled)
   * Set via: VITE_FEATURE_ONBOARDING_GUARD_ENABLED=false
   */
  onboardingGuardEnabled: boolean;

  /**
   * Allow internal skip of onboarding (dev/internal allowlist only).
   * Enables "Skip for now" button in activation flow.
   * Set via: VITE_FEATURE_INTERNAL_SKIP_ONBOARDING=true
   */
  /**
   * Enable enhanced JSON-LD schema on marketing pages (/pricing, /difference).
   * Kill switch for quick rollback if metadata regressions are detected.
   * Set via: VITE_FEATURE_ENHANCED_MARKETING_SCHEMA=false
   */
  enhancedMarketingSchema: boolean;

  internalSkipOnboarding: boolean;
}

/**
 * Parse boolean from environment variable
 */
function parseBoolEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') {
    return defaultValue;
  }
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Determine if we're in production environment.
 * Uses VITE_ENV_TIER if set, otherwise falls back to Vite's PROD flag.
 */
function isProductionEnv(): boolean {
  const tier = import.meta.env.VITE_ENV_TIER;
  if (tier) {
    return tier === 'prod';
  }
  // Fallback: use Vite's build-time flag
  return import.meta.env.PROD;
}

const isProd = isProductionEnv();

/**
 * Feature flags instance
 *
 * Note: In Vite, environment variables are replaced at build time.
 * To enable/disable flags:
 * 1. Add to .env file: VITE_FEATURE_TWO_STEP_SIGNUP=true
 * 2. Restart the dev server
 *
 * Production defaults OFF for new features, dev/staging defaults ON.
 */
export const featureFlags: FeatureFlags = {
  // Enable two-step signup by default (new canonical flow)
  twoStepSignup: parseBoolEnv(import.meta.env.VITE_FEATURE_TWO_STEP_SIGNUP, true),

  // Debug logging disabled by default
  debugSignup: parseBoolEnv(import.meta.env.VITE_DEBUG_SIGNUP, false),

  // Upgrade modal ENABLED by default (plan selection must happen in RingSnap UI)
  upgradeModalEnabled: parseBoolEnv(import.meta.env.VITE_FEATURE_UPGRADE_MODAL, true),

  // Activation onboarding: ENABLED in all environments
  activationOnboardingEnabled: parseBoolEnv(
    import.meta.env.VITE_FEATURE_ACTIVATION_ONBOARDING,
    true
  ),

  // Reporting wow: ENABLED in all environments
  reportingWowEnabled: parseBoolEnv(
    import.meta.env.VITE_FEATURE_REPORTING_WOW,
    true
  ),

  // ============================================================================
  // Sprint 2026-01-04: Dashboard & Onboarding Fixes
  // ============================================================================

  // Activation troubleshooting: ENABLED by default
  activationTroubleshooting: parseBoolEnv(
    import.meta.env.VITE_FEATURE_ACTIVATION_TROUBLESHOOTING,
    true
  ),

  // Tagging confidence UI: ENABLED by default
  taggingConfidenceUi: parseBoolEnv(
    import.meta.env.VITE_FEATURE_TAGGING_CONFIDENCE_UI,
    true
  ),

  // Add phone number flow: ENABLED by default
  addPhoneNumberFlow: parseBoolEnv(
    import.meta.env.VITE_FEATURE_ADD_PHONE_NUMBER_FLOW,
    true
  ),

  // Widget safe offset: ENABLED by default
  widgetSafeOffset: parseBoolEnv(
    import.meta.env.VITE_FEATURE_WIDGET_SAFE_OFFSET,
    true
  ),

  // Call recording immediate apply: ENABLED by default
  callRecordingImmediateApply: parseBoolEnv(
    import.meta.env.VITE_FEATURE_CALL_RECORDING_IMMEDIATE_APPLY,
    true
  ),

  // Onboarding guard: ENABLED by default (kill switch)
  onboardingGuardEnabled: parseBoolEnv(
    import.meta.env.VITE_FEATURE_ONBOARDING_GUARD_ENABLED,
    true
  ),

  // Internal skip onboarding: dev only by default
  internalSkipOnboarding: parseBoolEnv(
    import.meta.env.VITE_FEATURE_INTERNAL_SKIP_ONBOARDING,
    import.meta.env.DEV
  ),

  // Enhanced marketing schema: ENABLED by default, kill switch available
  enhancedMarketingSchema: parseBoolEnv(
    import.meta.env.VITE_FEATURE_ENHANCED_MARKETING_SCHEMA,
    true
  ),
};

/**
 * Log feature flag status (for debugging)
 */
export function logFeatureFlags(): void {
  if (featureFlags.debugSignup) {
    console.log('[FeatureFlags]', JSON.stringify(featureFlags, null, 2));
  }
}

// Log on module load in development
if (import.meta.env.DEV) {
  console.log('[FeatureFlags] Environment tier:', import.meta.env.VITE_ENV_TIER || 'not set (using PROD flag)');
  console.log('[FeatureFlags] Two-step signup:', featureFlags.twoStepSignup ? 'ENABLED' : 'DISABLED');
  console.log('[FeatureFlags] Upgrade modal:', featureFlags.upgradeModalEnabled ? 'ENABLED' : 'DISABLED');
  console.log('[FeatureFlags] Activation onboarding:', featureFlags.activationOnboardingEnabled ? 'ENABLED' : 'DISABLED');
  console.log('[FeatureFlags] Reporting wow:', featureFlags.reportingWowEnabled ? 'ENABLED' : 'DISABLED');
  console.log('[FeatureFlags] Enhanced marketing schema:', featureFlags.enhancedMarketingSchema ? 'ENABLED' : 'DISABLED');
}
