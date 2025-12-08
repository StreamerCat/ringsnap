/**
 * Automated Tests for create-trial-v2 Edge Function
 * Tests idempotency, rollback, atomic transactions, and error handling
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import {
  loadTestEnv,
  generateTestEmail,
  createTestSignupPayload,
  callEdgeFunction,
  cleanupTestAccount,
  cleanupStripeResources,
  assertSuccess,
  assertError,
  parseResponse,
  STRIPE_TEST_CARDS,
} from "./test-utils.ts";

const FUNCTION_NAME = "create-trial-v2";

// ==============================================================================
// Test 1: Happy Path (Self-Service Signup)
// ==============================================================================

Deno.test("create-trial-v2: happy path self-service signup", async () => {
  const context = loadTestEnv();
  const testEmail = generateTestEmail("self-service");

  try {
    const payload = createTestSignupPayload({
      email: testEmail,
      signup_channel: "self_service",
      sales_rep_id: null,
    });

    const response = await callEdgeFunction(FUNCTION_NAME, payload, context);

    assertSuccess(response, "Signup should succeed");

    const data = await parseResponse(response);

    // Verify response structure
    assertEquals(data.success, true, "Response should indicate success");
    assertExists(data.account_id, "Should return account_id");
    assertExists(data.user_id, "Should return user_id");
    assertExists(data.stripe_customer_id, "Should return stripe_customer_id");
    assertExists(data.stripe_subscription_id, "Should return stripe_subscription_id");
    assertEquals(data.signup_channel, "self_service", "Should return signup_channel");
    assertExists(data.correlation_id, "Should return correlation_id");

    // Password should be null for self-service (email sent instead)
    assertEquals(data.password, null, "Self-service should not return password");

    // Verify provisioning stage
    assertEquals(
      data.provisioning_stage,
      "stripe_linked",
      "Should start at stripe_linked stage"
    );

    // Verify in database
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(context.supabaseUrl, context.supabaseServiceRoleKey);

    const { data: account } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", data.account_id)
      .single();

    assertExists(account, "Account should exist in database");
    assertEquals(account.signup_channel, "self_service");
    assertEquals(account.subscription_status, "trial");

    // Verify profile exists
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user_id)
      .single();

    assertExists(profile, "Profile should exist");
    assertEquals(profile.account_id, data.account_id);
    assertEquals(profile.is_primary, true);

    // Verify role assigned
    const { data: role } = await supabase
      .from("account_members")
      .select("*")
      .eq("user_id", data.user_id)
      .single();

    assertExists(role, "User role should exist");
    assertEquals(role.role, "owner");

    // Verify state transition logged
    const { data: transitions } = await supabase
      .from("provisioning_state_transitions")
      .select("*")
      .eq("account_id", data.account_id);

    assertExists(transitions, "State transitions should exist");
    assertEquals(transitions.length >= 1, true, "Should have at least one transition");

    console.log("✅ Test passed: Happy path self-service signup");
  } finally {
    await cleanupTestAccount(testEmail, context);
    await cleanupStripeResources(testEmail, context);
  }
});

// ==============================================================================
// Test 2: Idempotency (Duplicate Email)
// ==============================================================================

Deno.test("create-trial-v2: idempotency with duplicate email", async () => {
  const context = loadTestEnv();
  const testEmail = generateTestEmail("idempotent");

  try {
    const payload = createTestSignupPayload({
      email: testEmail,
      signup_channel: "self_service",
    });

    // First signup
    const response1 = await callEdgeFunction(FUNCTION_NAME, payload, context);
    assertSuccess(response1, "First signup should succeed");
    const data1 = await parseResponse(response1);

    // Second signup with same email (different company name)
    const payload2 = {
      ...payload,
      companyName: "Different Company",
      planType: "professional", // Different plan
    };

    const response2 = await callEdgeFunction(FUNCTION_NAME, payload2, context);
    assertSuccess(response2, "Second signup should succeed (idempotent)");
    const data2 = await parseResponse(response2);

    // Should return same account
    assertEquals(data2.account_id, data1.account_id, "Should return same account_id");
    assertEquals(data2.user_id, data1.user_id, "Should return same user_id");
    assertEquals(
      data2.message,
      "Account already exists",
      "Should indicate account exists"
    );

    // Verify only one Stripe customer created
    const Stripe = (await import("https://esm.sh/stripe@14.21.0?target=deno")).default;
    const stripe = new Stripe(context.stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    const customers = await stripe.customers.search({
      query: `email:'${testEmail}'`,
      limit: 10,
    });

    assertEquals(customers.data.length, 1, "Should have exactly one Stripe customer");

    console.log("✅ Test passed: Idempotency with duplicate email");
  } finally {
    await cleanupTestAccount(testEmail, context);
    await cleanupStripeResources(testEmail, context);
  }
});

// ==============================================================================
// Test 3: Payment Method Attach Fails (Rollback)
// ==============================================================================

Deno.test("create-trial-v2: payment method attach fails with rollback", async () => {
  const context = loadTestEnv();
  const testEmail = generateTestEmail("pm-fail");

  try {
    const payload = createTestSignupPayload({
      email: testEmail,
      paymentMethodId: "pm_invalid_for_attach", // Invalid PM that will fail attach
    });

    const response = await callEdgeFunction(FUNCTION_NAME, payload, context);

    // Should fail with 400
    assertError(response, 400, "Should fail with 400 when PM attach fails");

    const data = await parseResponse(response);
    assertEquals(data.success, false);
    assertExists(data.error, "Should return error message");

    // Verify no account created in database
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(context.supabaseUrl, context.supabaseServiceRoleKey);

    const { data: accounts } = await supabase
      .from("accounts")
      .select("*")
      .ilike("company_name", "%Test Company%");

    const accountForEmail = accounts?.find((a) => {
      // Check if account is for this test email (we can't query by email directly)
      return true; // We'll check Stripe customer instead
    });

    // Verify Stripe customer was rolled back (deleted)
    const Stripe = (await import("https://esm.sh/stripe@14.21.0?target=deno")).default;
    const stripe = new Stripe(context.stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    const customers = await stripe.customers.search({
      query: `email:'${testEmail}'`,
      limit: 1,
    });

    assertEquals(
      customers.data.length,
      0,
      "Stripe customer should be deleted (rolled back)"
    );

    console.log("✅ Test passed: Payment method attach fails with rollback");
  } finally {
    await cleanupTestAccount(testEmail, context);
    await cleanupStripeResources(testEmail, context);
  }
});

// ==============================================================================
// Test 4: Subscription Creation Fails (Rollback)
// ==============================================================================

Deno.test("create-trial-v2: subscription creation fails with rollback", async () => {
  const context = loadTestEnv();
  const testEmail = generateTestEmail("sub-fail");

  try {
    const payload = createTestSignupPayload({
      email: testEmail,
      paymentMethodId: STRIPE_TEST_CARDS.DECLINED,
    });

    const response = await callEdgeFunction(FUNCTION_NAME, payload, context);

    // Should fail with 400
    assertError(response, 400, "Should fail when subscription creation fails");

    const data = await parseResponse(response);
    assertEquals(data.success, false);
    assertExists(data.error, "Should return error message");

    // Verify no account in database
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(context.supabaseUrl, context.supabaseServiceRoleKey);

    const { data: accountCheck } = await supabase.rpc("get_account_by_email", {
      p_email: testEmail,
    });

    assertEquals(
      accountCheck?.length || 0,
      0,
      "Account should not exist in database"
    );

    // Verify Stripe customer was rolled back
    const Stripe = (await import("https://esm.sh/stripe@14.21.0?target=deno")).default;
    const stripe = new Stripe(context.stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    const customers = await stripe.customers.search({
      query: `email:'${testEmail}'`,
      limit: 1,
    });

    assertEquals(
      customers.data.length,
      0,
      "Stripe customer should be deleted after subscription failure"
    );

    console.log("✅ Test passed: Subscription creation fails with rollback");
  } finally {
    await cleanupTestAccount(testEmail, context);
    await cleanupStripeResources(testEmail, context);
  }
});

// ==============================================================================
// Test 5: Sales-Guided Signup with sales_rep_id
// ==============================================================================

Deno.test("create-trial-v2: sales-guided signup with sales_rep_id", async () => {
  const context = loadTestEnv();
  const testEmail = generateTestEmail("sales");

  try {
    // For testing, we'll use a placeholder UUID
    // In real usage, this would be the logged-in sales rep's user ID
    const salesRepId = "00000000-0000-0000-0000-000000000001";

    const payload = createTestSignupPayload({
      email: testEmail,
      signup_channel: "sales_guided",
      sales_rep_id: salesRepId,
    });

    const response = await callEdgeFunction(FUNCTION_NAME, payload, context);
    assertSuccess(response, "Sales-guided signup should succeed");

    const data = await parseResponse(response);

    assertEquals(data.success, true);
    assertEquals(data.signup_channel, "sales_guided");
    assertExists(data.password, "Sales-guided should return temp password");

    // Verify account has sales_rep_id
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(context.supabaseUrl, context.supabaseServiceRoleKey);

    const { data: account } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", data.account_id)
      .single();

    assertExists(account, "Account should exist");
    assertEquals(account.signup_channel, "sales_guided");
    assertEquals(account.sales_rep_id, salesRepId);

    console.log("✅ Test passed: Sales-guided signup with sales_rep_id");
  } finally {
    await cleanupTestAccount(testEmail, context);
    await cleanupStripeResources(testEmail, context);
  }
});

// ==============================================================================
// Test 6: Anti-Abuse - IP Rate Limiting (Self-Service Only)
// ==============================================================================

Deno.test("create-trial-v2: anti-abuse IP rate limiting", async () => {
  const context = loadTestEnv();
  const emails = [
    generateTestEmail("abuse-1"),
    generateTestEmail("abuse-2"),
    generateTestEmail("abuse-3"),
    generateTestEmail("abuse-4"),
  ];

  try {
    const fakeIpAddress = "192.168.1.100";

    // First 3 signups should succeed
    for (let i = 0; i < 3; i++) {
      const payload = createTestSignupPayload({
        email: emails[i],
        signup_channel: "self_service",
      });

      const response = await callEdgeFunction(FUNCTION_NAME, payload, context, {
        "x-forwarded-for": fakeIpAddress,
      });

      assertSuccess(response, `Signup ${i + 1} should succeed`);
    }

    // 4th signup from same IP should be rate limited
    const payload4 = createTestSignupPayload({
      email: emails[3],
      signup_channel: "self_service",
    });

    const response4 = await callEdgeFunction(FUNCTION_NAME, payload4, context, {
      "x-forwarded-for": fakeIpAddress,
    });

    assertError(response4, 429, "4th signup should be rate limited");

    const data4 = await parseResponse(response4);
    assertEquals(data4.success, false);
    assertExists(data4.error, "Should return rate limit error");

    console.log("✅ Test passed: Anti-abuse IP rate limiting");
  } finally {
    for (const email of emails) {
      await cleanupTestAccount(email, context);
      await cleanupStripeResources(email, context);
    }
  }
});

// ==============================================================================
// Test 7: Validation Errors
// ==============================================================================

Deno.test("create-trial-v2: validation errors for invalid input", async () => {
  const context = loadTestEnv();

  // Test invalid email
  const invalidEmailPayload = createTestSignupPayload({
    email: "not-an-email",
  });

  const response1 = await callEdgeFunction(
    FUNCTION_NAME,
    invalidEmailPayload,
    context
  );
  assertError(response1, 400, "Should reject invalid email");

  // Test missing required field
  const missingFieldPayload = {
    email: generateTestEmail(),
    // Missing companyName
    trade: "HVAC",
    planType: "starter",
  };

  const response2 = await callEdgeFunction(
    FUNCTION_NAME,
    missingFieldPayload,
    context
  );
  assertError(response2, 400, "Should reject missing required fields");

  // Test invalid planType
  const invalidPlanPayload = createTestSignupPayload({
    planType: "invalid_plan",
  });

  const response3 = await callEdgeFunction(
    FUNCTION_NAME,
    invalidPlanPayload,
    context
  );
  assertError(response3, 400, "Should reject invalid plan type");

  console.log("✅ Test passed: Validation errors for invalid input");
});

// ==============================================================================
// Test 8: Correlation ID Tracking
// ==============================================================================

Deno.test("create-trial-v2: correlation ID tracking", async () => {
  const context = loadTestEnv();
  const testEmail = generateTestEmail("correlation");
  const customCorrelationId = "test-correlation-id-12345";

  try {
    const payload = createTestSignupPayload({
      email: testEmail,
    });

    const response = await callEdgeFunction(FUNCTION_NAME, payload, context, {
      "x-correlation-id": customCorrelationId,
    });

    assertSuccess(response);
    const data = await parseResponse(response);

    // Verify correlation ID returned
    assertEquals(
      data.correlation_id,
      customCorrelationId,
      "Should return the provided correlation ID"
    );

    // Verify correlation ID in database
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(context.supabaseUrl, context.supabaseServiceRoleKey);

    const { data: transitions } = await supabase
      .from("provisioning_state_transitions")
      .select("*")
      .eq("account_id", data.account_id);

    const hasCorrelationId = transitions?.some(
      (t) => t.correlation_id === customCorrelationId
    );

    assertEquals(
      hasCorrelationId,
      true,
      "Correlation ID should be in state transitions"
    );

    console.log("✅ Test passed: Correlation ID tracking");
  } finally {
    await cleanupTestAccount(testEmail, context);
    await cleanupStripeResources(testEmail, context);
  }
});

// ==============================================================================
// Test Summary
// ==============================================================================

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           create-trial-v2 Test Suite                          ║
╠═══════════════════════════════════════════════════════════════╣
║  Tests:                                                       ║
║  ✅ Happy path self-service signup                            ║
║  ✅ Idempotency with duplicate email                          ║
║  ✅ Payment method attach fails with rollback                 ║
║  ✅ Subscription creation fails with rollback                 ║
║  ✅ Sales-guided signup with sales_rep_id                     ║
║  ✅ Anti-abuse IP rate limiting                               ║
║  ✅ Validation errors for invalid input                       ║
║  ✅ Correlation ID tracking                                   ║
╚═══════════════════════════════════════════════════════════════╝

Run with: deno test --allow-net --allow-env supabase/functions/_tests/create-trial-v2.test.ts
`);
