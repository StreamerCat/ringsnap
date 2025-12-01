/**
 * Environment Variable Validation Utility
 *
 * Validates required environment variables at edge function startup
 * Fails fast with clear error messages if critical vars are missing
 */

import { logError } from './logging.ts';

export interface EnvValidationResult {
  valid: boolean;
  missing: string[];
  message?: string;
}

/**
 * Validate required environment variables
 * @param requiredVars - Array of required env var names
 * @param functionName - Name of the function for logging
 * @returns Validation result
 */
export function validateEnv(
  requiredVars: string[],
  functionName: string
): EnvValidationResult {
  const missing: string[] = [];

  for (const varName of requiredVars) {
    const value = Deno.env.get(varName);
    if (!value || value.trim() === '') {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    const message = `Missing required environment variables: ${missing.join(', ')}`;

    logError('Environment validation failed', {
      functionName,
      error: new Error(message),
      context: {
        missing_vars: missing,
        total_required: requiredVars.length,
      },
    });

    return {
      valid: false,
      missing,
      message,
    };
  }

  return {
    valid: true,
    missing: [],
  };
}

/**
 * Assert environment variables are present (throws if missing)
 * @param requiredVars - Array of required env var names
 * @param functionName - Name of the function for logging
 * @throws Error if any required vars are missing
 */
export function assertEnv(
  requiredVars: string[],
  functionName: string
): void {
  const result = validateEnv(requiredVars, functionName);

  if (!result.valid) {
    throw new Error(result.message);
  }
}

/**
 * Common environment variable groups
 */
export const ENV_GROUPS = {
  SUPABASE: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
  STRIPE: ['STRIPE_SECRET_KEY'],
  VAPI: ['VAPI_API_KEY', 'VAPI_BASE_URL'],
  TWILIO: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'],
  RESEND: ['RESEND_PROD_KEY', 'EMAIL_FROM'],
  AUTH: ['SITE_URL'],
};

/**
 * Get required vars for a specific feature
 */
export function getRequiredEnv(features: (keyof typeof ENV_GROUPS)[]): string[] {
  const required = new Set<string>();

  for (const feature of features) {
    const vars = ENV_GROUPS[feature];
    if (vars) {
      vars.forEach(v => required.add(v));
    }
  }

  return Array.from(required);
}
