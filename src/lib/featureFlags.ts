/**
 * Feature Flags Configuration
 *
 * Simple feature flag system for RingSnap.
 * Flags can be controlled via environment variables or defaults.
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
 * Feature flags instance
 *
 * Note: In Vite, environment variables are replaced at build time.
 * To enable/disable flags:
 * 1. Add to .env file: VITE_FEATURE_TWO_STEP_SIGNUP=true
 * 2. Restart the dev server
 *
 * Default values are set to enable the new flow by default.
 */
export const featureFlags: FeatureFlags = {
  // Enable two-step signup by default (new canonical flow)
  twoStepSignup: parseBoolEnv(import.meta.env.VITE_FEATURE_TWO_STEP_SIGNUP, true),

  // Debug logging disabled by default
  debugSignup: parseBoolEnv(import.meta.env.VITE_DEBUG_SIGNUP, false),

  // Upgrade modal ENABLED by default (plan selection must happen in RingSnap UI)
  upgradeModalEnabled: parseBoolEnv(import.meta.env.VITE_FEATURE_UPGRADE_MODAL, true),
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
  console.log('[FeatureFlags] Two-step signup:', featureFlags.twoStepSignup ? 'ENABLED' : 'DISABLED');
  console.log('[FeatureFlags] Upgrade modal:', featureFlags.upgradeModalEnabled ? 'ENABLED' : 'DISABLED');
}

