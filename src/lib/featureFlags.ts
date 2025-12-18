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

  // Activation onboarding: OFF in prod, ON in dev/staging
  activationOnboardingEnabled: parseBoolEnv(
    import.meta.env.VITE_FEATURE_ACTIVATION_ONBOARDING,
    !isProd
  ),

  // Reporting wow: OFF in prod, ON in dev/staging
  reportingWowEnabled: parseBoolEnv(
    import.meta.env.VITE_FEATURE_REPORTING_WOW,
    !isProd
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
}
