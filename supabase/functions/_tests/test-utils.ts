/**
 * Test Utilities for RingSnap Edge Functions
 * Provides helpers for testing Supabase edge functions with Deno
 */

import { assertEquals, assertExists, assert } from "https://deno.land/std@0.192.0/testing/asserts.ts";

export interface TestContext {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  stripeSecretKey: string;
}

/**
 * Load test environment variables
 */
export function loadTestEnv(): TestContext {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey || !stripeSecretKey) {
    throw new Error("Missing required environment variables for testing");
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    stripeSecretKey,
  };
}

/**
 * Generate unique test email
 */
export function generateTestEmail(prefix: string = "test"): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `${prefix}-${timestamp}-${random}@example.com`;
}

/**
 * Generate test phone number
 */
export function generateTestPhone(): string {
  const areaCode = Math.floor(Math.random() * 900) + 100;
  const exchange = Math.floor(Math.random() * 900) + 100;
  const number = Math.floor(Math.random() * 9000) + 1000;
  return `+1${areaCode}${exchange}${number}`;
}

/**
 * Stripe test payment method IDs
 */
export const STRIPE_TEST_CARDS = {
  VALID_VISA: "pm_card_visa",
  VALID_MASTERCARD: "pm_card_mastercard",
  DECLINED: "pm_card_chargeDeclined",
  INSUFFICIENT_FUNDS: "pm_card_insufficient_funds",
  REQUIRES_AUTH: "pm_card_authenticationRequired",
};

/**
 * Create test signup payload
 */
export function createTestSignupPayload(overrides: Partial<any> = {}): any {
  return {
    name: "Test User",
    email: generateTestEmail(),
    phone: generateTestPhone(),
    companyName: "Test Company Inc",
    trade: "HVAC",
    planType: "starter",
    paymentMethodId: STRIPE_TEST_CARDS.VALID_VISA,
    signup_channel: "self_service",
    zipCode: "94102",
    assistantGender: "female",
    wantsAdvancedVoice: false,
    ...overrides,
  };
}

/**
 * Call edge function
 */
export async function callEdgeFunction(
  functionName: string,
  payload: any,
  context: TestContext,
  headers: Record<string, string> = {}
): Promise<Response> {
  const url = `${context.supabaseUrl}/functions/v1/${functionName}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${context.supabaseAnonKey}`,
      "apikey": context.supabaseAnonKey,
      ...headers,
    },
    body: JSON.stringify(payload),
  });

  return response;
}

/**
 * Cleanup test data
 */
export async function cleanupTestAccount(
  email: string,
  context: TestContext
): Promise<void> {
  const { createClient } = await import("supabase");
  const supabase = createClient(context.supabaseUrl, context.supabaseServiceRoleKey);

  try {
    // Find account by email
    const { data: accountData } = await supabase.rpc("get_account_by_email", {
      p_email: email,
    });

    if (accountData && accountData.length > 0) {
      const accountId = accountData[0].account_id;
      const userId = accountData[0].user_id;

      // Delete in order to respect foreign keys
      await supabase.from("provisioning_state_transitions").delete().eq("account_id", accountId);
      await supabase.from("account_members").delete().eq("user_id", userId);
      await supabase.from("profiles").delete().eq("id", userId);
      await supabase.from("accounts").delete().eq("id", accountId);

      // Delete auth user
      await supabase.auth.admin.deleteUser(userId);
    }

    // Also clean up any signup attempts
    await supabase.from("signup_attempts").delete().eq("email", email);
  } catch (error) {
    console.error("Cleanup error:", error);
    // Don't throw - cleanup is best effort
  }
}

/**
 * Cleanup Stripe test resources
 */
export async function cleanupStripeResources(
  email: string,
  context: TestContext
): Promise<void> {
  const Stripe = (await import("https://esm.sh/stripe@14.21.0?target=deno")).default;
  const stripe = new Stripe(context.stripeSecretKey, {
    apiVersion: "2023-10-16",
  });

  try {
    // Find customer by email
    const customers = await stripe.customers.search({
      query: `email:'${email}'`,
      limit: 1,
    });

    if (customers.data.length > 0) {
      const customer = customers.data[0];

      // Cancel subscriptions first
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
      });

      for (const subscription of subscriptions.data) {
        await stripe.subscriptions.cancel(subscription.id);
      }

      // Delete customer
      await stripe.customers.del(customer.id);
    }
  } catch (error) {
    console.error("Stripe cleanup error:", error);
    // Don't throw - cleanup is best effort
  }
}

/**
 * Wait for condition with timeout
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  timeout: number = 10000,
  interval: number = 500
): Promise<boolean> {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  return false;
}

/**
 * Assert response is successful
 */
export function assertSuccess(response: Response, message?: string): void {
  assert(
    response.ok,
    message || `Expected successful response, got ${response.status}`
  );
}

/**
 * Assert response has error
 */
export function assertError(
  response: Response,
  expectedStatus: number,
  message?: string
): void {
  assertEquals(
    response.status,
    expectedStatus,
    message || `Expected status ${expectedStatus}, got ${response.status}`
  );
}

/**
 * Parse JSON response
 */
export async function parseResponse<T = any>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Failed to parse response: ${text}`);
  }
}

/**
 * Test case wrapper with cleanup
 */
export async function testCase(
  name: string,
  fn: (context: TestContext) => Promise<void>
): Promise<void> {
  const context = loadTestEnv();

  try {
    await fn(context);
  } catch (error) {
    console.error(`Test "${name}" failed:`, error);
    throw error;
  }
}

export { assertEquals, assertExists, assert };
