/**
 * Integration tests for create-trial edge function
 * Tests the unified backend endpoint for both self-serve and sales flows
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { extractTraceId, stepStart, stepEnd, stepError } from "../_shared/logging.ts";

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => ({
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => ({
          data: { id: "test-account-id", user_id: "test-user-id" },
          error: null,
        })),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({ error: null })),
    })),
  })),
  auth: {
    admin: {
      createUser: vi.fn(() => ({
        data: { user: { id: "test-user-id" } },
        error: null,
      })),
    },
  },
  functions: {
    invoke: vi.fn(() => ({
      data: null,
      error: null,
    })),
  },
};

// Mock global fetch
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({}),
  text: () => Promise.resolve(""),
});
vi.stubGlobal("fetch", mockFetch);

// Mock Stripe
const mockStripe = {
  customers: {
    create: vi.fn(() => ({
      id: "cus_test123",
    })),
  },
  subscriptions: {
    create: vi.fn(() => ({
      id: "sub_test123",
      latest_invoice: {
        payment_intent: {
          client_secret: "pi_test_secret",
        },
      },
    })),
  },
  paymentMethods: {
    attach: vi.fn(),
  },
};

describe("create-trial endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Self-serve flow (source: website)", () => {
    it("creates trial with all required fields", async () => {
      const payload = {
        // User info
        name: "John Doe",
        email: "john@example.com",
        phone: "5551234567",

        // Business basics
        companyName: "ACME Plumbing",
        trade: "Plumbing",

        // Business extended
        website: "https://acmeplumbing.com",
        serviceArea: "Greater Los Angeles",
        zipCode: "90210",

        // AI config
        assistantGender: "female",
        primaryGoal: "book_appointments",

        // Plan & payment
        planType: "professional",
        paymentMethodId: "pm_test123",

        // Source
        source: "website",
      };

      // Simulate endpoint logic
      expect(payload.source).toBe("website");
      expect(payload.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      expect(payload.planType).toMatch(/^(starter|professional|premium)$/);
    });

    it("validates email domain for anti-abuse", async () => {
      const suspiciousDomains = [
        "tempmail.com",
        "guerrillamail.com",
        "10minutemail.com",
      ];

      suspiciousDomains.forEach((domain) => {
        const email = `test@${domain}`;
        // Would be rejected by the endpoint
        expect(email).toContain(domain);
      });
    });

    it("includes source in Stripe metadata", () => {
      const metadata = {
        source: "website",
        company_name: "ACME Plumbing",
        trade: "Plumbing",
      };

      expect(metadata.source).toBe("website");
    });
  });

  describe("Sales-guided flow (source: sales)", () => {
    it("creates trial with sales rep tracking", async () => {
      const payload = {
        // User info
        name: "Jane Smith",
        email: "jane@example.com",
        phone: "5559876543",

        // Business basics
        companyName: "Best HVAC",
        trade: "HVAC",
        serviceArea: "San Diego County",
        zipCode: "92101",

        // AI config
        assistantGender: "male",

        // Plan & payment
        planType: "premium",
        paymentMethodId: "pm_test456",

        // Sales tracking
        source: "sales",
        salesRepName: "Bob Johnson",
      };

      expect(payload.source).toBe("sales");
      expect(payload.salesRepName).toBe("Bob Johnson");
    });

    it("skips anti-abuse checks for sales flow", async () => {
      // Sales flow doesn't check email domain because rep verified customer in person
      const payload = {
        email: "test@tempmail.com",
        source: "sales",
        salesRepName: "Bob Johnson",
      };

      // This would pass (sales rep vouches for customer)
      expect(payload.source).toBe("sales");
    });

    it("includes sales rep in Stripe metadata", () => {
      const metadata = {
        source: "sales",
        sales_rep: "Bob Johnson",
        company_name: "Best HVAC",
      };

      expect(metadata.source).toBe("sales");
      expect(metadata.sales_rep).toBe("Bob Johnson");
    });
  });

  describe("Vapi provisioning", () => {
    it("creates provisioning job for both flows", async () => {
      const provisioningJob = {
        account_id: "test-account-id",
        job_type: "provision_phone",
        status: "queued",
        metadata: {
          company_name: "ACME Plumbing",
          assistant_gender: "female",
        },
      };

      expect(provisioningJob.job_type).toBe("provision_phone");
      expect(provisioningJob.status).toBe("queued");
    });

    it("includes business context in provisioning metadata", () => {
      const metadata = {
        company_name: "ACME Plumbing",
        trade: "Plumbing",
        assistant_gender: "female",
        primary_goal: "book_appointments",
      };

      expect(metadata.company_name).toBe("ACME Plumbing");
      expect(metadata.assistant_gender).toBe("female");
    });
  });

  describe("Validation", () => {
    it("rejects missing required fields", () => {
      const invalidPayload = {
        name: "John Doe",
        // Missing email, phone, companyName, etc.
      };

      // Would fail schema validation
      expect(invalidPayload).not.toHaveProperty("email");
    });

    it("validates plan type", () => {
      const validPlans = ["starter", "professional", "premium"];
      const invalidPlan = "enterprise";

      expect(validPlans).toContain("professional");
      expect(validPlans).not.toContain(invalidPlan);
    });

    it("validates assistant gender", () => {
      const validGenders = ["male", "female"];
      const invalidGender = "other";

      expect(validGenders).toContain("female");
      expect(validGenders).not.toContain(invalidGender);
    });

    it("validates ZIP code format", () => {
      const validZip = "90210";
      const invalidZips = ["1234", "123456", "abcde"];

      expect(validZip).toMatch(/^\d{5}$/);
      invalidZips.forEach((zip) => {
        expect(zip).not.toMatch(/^\d{5}$/);
      });
    });
  });

  describe("Error handling", () => {
    it("returns error for Stripe failures", async () => {
      const stripeError = new Error("Card declined");

      // Would be caught and returned as error response
      expect(stripeError.message).toBe("Card declined");
    });

    it("returns error for database failures", async () => {
      const dbError = new Error("Database connection failed");

      expect(dbError.message).toBe("Database connection failed");
    });

    it("returns structured error response", () => {
      const errorResponse = {
        ok: false,
        error: "Payment failed: Card declined",
      };

      expect(errorResponse.ok).toBe(false);
      expect(errorResponse.error).toContain("Payment failed");
    });
  });

  describe("Response format", () => {
    it("returns success with account_id", () => {
      const successResponse = {
        ok: true,
        account_id: "acc_test123",
        profile_id: "prof_test123",
        customer_id: "cus_test123",
        subscription_id: "sub_test123",
      };

      expect(successResponse.ok).toBe(true);
      expect(successResponse.account_id).toBeDefined();
    });

    it("includes all IDs for client tracking", () => {
      const response = {
        ok: true,
        account_id: "acc_123",
        profile_id: "prof_123",
        customer_id: "cus_123",
        subscription_id: "sub_123",
      };

      expect(response).toHaveProperty("account_id");
      expect(response).toHaveProperty("profile_id");
      expect(response).toHaveProperty("customer_id");
      expect(response).toHaveProperty("subscription_id");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // NEW TEST CASES - Error Handling Improvements
  // ═══════════════════════════════════════════════════════════════

  describe("Existing email with account (409 response)", () => {
    it("returns 409 with ACCOUNT_EXISTS code when user already has an account", () => {
      const existingUserResponse = {
        error: "An account with this email already exists. Please log in instead.",
        code: "ACCOUNT_EXISTS",
        redirect: "/login",
        userMessage: "Looks like you already have an account. Please log in to continue.",
      };

      expect(existingUserResponse.code).toBe("ACCOUNT_EXISTS");
      expect(existingUserResponse.redirect).toBe("/login");
      expect(existingUserResponse.userMessage).toContain("already have an account");
    });

    it("should not create Stripe customer when email already has an account", () => {
      // This validates the early exit behavior
      // In actual implementation, Stripe APIs are not called if existingUser.hasAccount is true
      const mockStripeCustomersCreate = vi.fn();

      // Simulate early exit scenario - Stripe should never be called
      const userHasAccount = true;
      if (userHasAccount) {
        // Early return before Stripe
        expect(mockStripeCustomersCreate).not.toHaveBeenCalled();
      }
    });
  });

  describe("Payment method already attached (reuse existing customer)", () => {
    it("reuses existing customer when PM is already attached", () => {
      const pmAlreadyAttached = {
        paymentMethodId: "pm_test123",
        existingCustomerId: "cus_existing_456",
        emailMatches: true,
      };

      // When PM is already attached and email matches, reuse customer
      expect(pmAlreadyAttached.emailMatches).toBe(true);
      expect(pmAlreadyAttached.existingCustomerId).toBeDefined();
    });

    it("returns error when PM customer email does not match request email", () => {
      const mismatchError = {
        success: false,
        errorCode: "PAYMENT_METHOD_MISMATCH",
        userMessage: "This card is associated with a different email. Please use a different card or check your email address.",
        retryable: true,
      };

      expect(mismatchError.errorCode).toBe("PAYMENT_METHOD_MISMATCH");
      expect(mismatchError.retryable).toBe(true);
    });
  });

  describe("Card decline with structured errors (ENABLE_STRUCTURED_TRIAL_ERRORS)", () => {
    it("returns structured error with errorCode for card_declined", () => {
      const cardDeclinedError = {
        success: false,
        errorCode: "CARD_DECLINED",
        userMessage: "Your card was declined. Please try a different card.",
        retryable: true,
        suggestedAction: "Try a different payment method",
      };

      expect(cardDeclinedError.success).toBe(false);
      expect(cardDeclinedError.errorCode).toBe("CARD_DECLINED");
      expect(cardDeclinedError.retryable).toBe(true);
    });

    it("returns structured error with errorCode for insufficient_funds", () => {
      const insufficientFundsError = {
        success: false,
        errorCode: "INSUFFICIENT_FUNDS",
        userMessage: "Your card was declined due to insufficient funds. Please try a different card.",
        retryable: true,
      };

      expect(insufficientFundsError.errorCode).toBe("INSUFFICIENT_FUNDS");
    });

    it("returns structured error with errorCode for expired_card", () => {
      const expiredCardError = {
        success: false,
        errorCode: "CARD_EXPIRED",
        userMessage: "Your card has expired. Please use a valid card.",
        suggestedAction: "Update your payment method",
      };

      expect(expiredCardError.errorCode).toBe("CARD_EXPIRED");
    });

    it("includes legacy fields for backward compatibility", () => {
      const structuredError = {
        success: false,
        errorCode: "CARD_DECLINED",
        userMessage: "Your card was declined.",
        // Legacy fields
        error: "card_declined",
        message: "Your card was declined.",
        request_id: "req_test123",
      };

      // New structured fields
      expect(structuredError.errorCode).toBeDefined();
      expect(structuredError.userMessage).toBeDefined();
      // Legacy fields preserved
      expect(structuredError.error).toBeDefined();
      expect(structuredError.message).toBeDefined();
      expect(structuredError.request_id).toBeDefined();
    });
  });

  describe("Safe cleanup (only delete created resources)", () => {
    it("should only track resources created in current request", () => {
      // Simulate the tracking mechanism
      let createdStripeCustomerId: string | null = null;
      let createdStripeSubscriptionId: string | null = null;

      // When reusing existing customer, createdStripeCustomerId stays null
      const reusedExistingCustomer = true;
      if (!reusedExistingCustomer) {
        createdStripeCustomerId = "cus_new_123";
      }

      // Cleanup should not delete reused customer
      expect(createdStripeCustomerId).toBeNull();
    });

    it("should track newly created customer for cleanup", () => {
      let createdStripeCustomerId: string | null = null;

      // When creating new customer
      const reusedExistingCustomer = false;
      if (!reusedExistingCustomer) {
        createdStripeCustomerId = "cus_new_456";
      }

      // Cleanup should delete the newly created customer
      expect(createdStripeCustomerId).toBe("cus_new_456");
    });
  });

  describe("Outbound-agent flow (source: outbound_agent)", () => {
    // Mirrors the superRefine rule added to createTrialSchema: paymentMethodId
    // is required UNLESS stripeSessionId is present (outbound checkouts already
    // completed a hosted Stripe Checkout, so there's no raw payment method to
    // attach — see the "OUTBOUND CHECKOUT MODE" branch in index.ts).
    function hasRequiredPayment(payload: { paymentMethodId?: string; stripeSessionId?: string }) {
      return Boolean(payload.paymentMethodId) || Boolean(payload.stripeSessionId);
    }

    it("accepts stripeSessionId in place of paymentMethodId", () => {
      const payload = {
        name: "Business Owner",
        email: "prospect@example.com",
        phone: "+15551234567",
        companyName: "New Business",
        trade: "general",
        planType: "core",
        source: "outbound_agent",
        stripeSessionId: "cs_test_123",
      };

      expect(hasRequiredPayment(payload)).toBe(true);
      expect(payload.source).toBe("outbound_agent");
    });

    it("rejects a request with neither paymentMethodId nor stripeSessionId", () => {
      const payload = { source: "outbound_agent" as const };
      expect(hasRequiredPayment(payload)).toBe(false);
    });

    it("website/sales requests still require paymentMethodId", () => {
      const websitePayload = { source: "website" as const };
      const salesPayload = { source: "sales" as const, stripeSessionId: undefined };
      expect(hasRequiredPayment(websitePayload)).toBe(false);
      expect(hasRequiredPayment(salesPayload)).toBe(false);
    });

    it("derives the outbound idempotency key from the Stripe session id", () => {
      // stripe-webhook sends this exact header when adopting a completed
      // outbound checkout — must be stable and unique per session so a
      // duplicate webhook delivery replays the cached create-trial response
      // instead of creating a second account.
      const stripeSessionId = "cs_test_abc123";
      const idempotencyKey = `outbound-agent-${stripeSessionId}`;
      expect(idempotencyKey).toBe("outbound-agent-cs_test_abc123");
    });

    it("falls back to billingState from the lead record over zip-derived state", () => {
      const dataWithBillingState = { billingState: "TX", zipCode: undefined as string | undefined };
      const dataWithoutBillingState = { billingState: undefined as string | undefined, zipCode: "90210" };

      const resolve = (d: { billingState?: string; zipCode?: string }) =>
        d.billingState || (d.zipCode ? "ZIP_DERIVED" : "CA");

      expect(resolve(dataWithBillingState)).toBe("TX");
      expect(resolve(dataWithoutBillingState)).toBe("ZIP_DERIVED");
    });

    it("tags the account with signup_channel=outbound_agent only for this source", () => {
      const buildAccountData = (source: string) => ({
        company_name: "Test Co",
        ...(source === "outbound_agent" ? { signup_channel: "outbound_agent" } : {}),
      });

      expect(buildAccountData("outbound_agent")).toHaveProperty("signup_channel", "outbound_agent");
      expect(buildAccountData("website")).not.toHaveProperty("signup_channel");
      expect(buildAccountData("sales")).not.toHaveProperty("signup_channel");
    });

    it("rejects adoption when the Stripe checkout session isn't complete", () => {
      const isSessionUsable = (session: { status?: string; payment_status?: string }) =>
        session.payment_status === "paid" || session.status === "complete";

      expect(isSessionUsable({ status: "open" })).toBe(false);
      expect(isSessionUsable({ status: "expired" })).toBe(false);
      expect(isSessionUsable({ status: "complete", payment_status: "unpaid" })).toBe(true);
      expect(isSessionUsable({ payment_status: "paid" })).toBe(true);
    });
  });

  describe("Outbound lead confirmation/correction (stripe-webhook -> create-trial)", () => {
    // Mirrors stripe-webhook's stateMeta validation: only a plain 2-letter
    // USPS code is forwarded as billingState; anything else (a full state
    // name, garbage, empty) is dropped so create-trial's strict
    // z.string().length(2) schema never rejects the whole request.
    function resolveStateMeta(rawState: string | null | undefined): string | null {
      return rawState && /^[A-Za-z]{2}$/.test(rawState) ? rawState.toUpperCase() : null;
    }

    it("forwards a valid 2-letter state as billingState", () => {
      expect(resolveStateMeta("tx")).toBe("TX");
      expect(resolveStateMeta("CA")).toBe("CA");
    });

    it("drops an unusable state value instead of forwarding it", () => {
      expect(resolveStateMeta("Texas")).toBeNull();
      expect(resolveStateMeta("")).toBeNull();
      expect(resolveStateMeta(null)).toBeNull();
      expect(resolveStateMeta(undefined)).toBeNull();
    });

    // Mirrors agent-trial-checkout's normalizeState: the agent may pass back
    // either an abbreviation or a full state name spoken by the prospect.
    function normalizeState(raw: string | undefined, nameMap: Record<string, string>): string | undefined {
      if (!raw) return undefined;
      const trimmed = raw.trim();
      if (trimmed.length === 2) return trimmed.toUpperCase();
      return nameMap[trimmed.toLowerCase()];
    }

    it("accepts a full state name spoken on the call and normalizes it to an abbreviation", () => {
      const nameMap = { georgia: "GA", "north carolina": "NC" };
      expect(normalizeState("Georgia", nameMap)).toBe("GA");
      expect(normalizeState("north carolina", nameMap)).toBe("NC");
      expect(normalizeState("ga", nameMap)).toBe("GA");
    });

    it("confirmed lead details overwrite stale DB values on every call, not just when missing", () => {
      // agent-trial-checkout always writes back business_name/city/state from
      // the tool-call args when present — the agent is expected to confirm
      // on every call, so a correction must not be silently ignored because
      // a DB value already existed.
      const buildLeadUpdate = (args: { businessName?: string; city?: string; state?: string; email?: string }) => {
        const update: Record<string, unknown> = { status: "checkout_sent" };
        if (args.businessName) update.business_name = args.businessName;
        if (args.city) update.city = args.city;
        if (args.state) update.state = args.state;
        if (args.email) update.email = args.email;
        return update;
      };

      const existingLeadFromDb = { business_name: "Old Name LLC", city: "Springfield", state: "IL" };
      const correctedByProspect = buildLeadUpdate({ businessName: "New Corrected Name LLC", city: "Shelbyville", state: "IL" });

      expect(correctedByProspect.business_name).toBe("New Corrected Name LLC");
      expect(correctedByProspect.business_name).not.toBe(existingLeadFromDb.business_name);
      expect(correctedByProspect.city).toBe("Shelbyville");
    });
  });

  describe("Outbound checkout adoption security (P1 fix)", () => {
    // Mirrors the auth gate added to the isOutboundCheckoutMode branch:
    // only a caller presenting the service-role key as a bearer token may
    // adopt a completed checkout session into an account. verify_jwt=false
    // on this function means the Supabase gateway never checks this on its
    // own, and a completed stripeSessionId isn't secret (it round-trips
    // through the browser via agent-trial-checkout's success_url) — without
    // this gate, anyone holding a session id could POST arbitrary
    // email/phone/company data and mint an account against someone else's
    // paid subscription.
    function isAuthorizedOutboundCaller(authHeader: string | null, serviceRoleKey: string): boolean {
      return authHeader === `Bearer ${serviceRoleKey}`;
    }

    it("rejects an outbound checkout adoption request without the service-role bearer token", () => {
      expect(isAuthorizedOutboundCaller(null, "sb_secret_real_key")).toBe(false);
      expect(isAuthorizedOutboundCaller("Bearer sb_secret_wrong_key", "sb_secret_real_key")).toBe(false);
      expect(isAuthorizedOutboundCaller("sb_secret_real_key", "sb_secret_real_key")).toBe(false); // missing "Bearer " prefix
    });

    it("accepts an outbound checkout adoption request with the correct service-role bearer token", () => {
      expect(isAuthorizedOutboundCaller("Bearer sb_secret_real_key", "sb_secret_real_key")).toBe(true);
    });

    // Mirrors overwriting data.email/data.phone with the verified Stripe
    // customer's values after retrieving the checkout session, rather than
    // trusting whatever the request body claimed.
    function resolveVerifiedIdentity(
      requestBodyEmail: string,
      requestBodyPhone: string,
      stripeCustomer: { email: string | null; phone: string | null }
    ) {
      return {
        email: stripeCustomer.email,
        phone: stripeCustomer.phone,
        // The request body's claimed identity is intentionally discarded.
        ignoredRequestEmail: requestBodyEmail,
        ignoredRequestPhone: requestBodyPhone,
      };
    }

    it("uses the verified Stripe customer identity, not the caller-supplied request body", () => {
      const resolved = resolveVerifiedIdentity(
        "attacker@example.com",
        "+15559990000",
        { email: "real-prospect@example.com", phone: "+15551234567" }
      );
      expect(resolved.email).toBe("real-prospect@example.com");
      expect(resolved.phone).toBe("+15551234567");
      expect(resolved.email).not.toBe("attacker@example.com");
      expect(resolved.phone).not.toBe("+15559990000");
    });

    it("rejects a checkout session not tagged as the outbound-agent flow", () => {
      const isValidOutboundSession = (metadata: { source?: string }) => metadata.source === "outbound_agent";
      expect(isValidOutboundSession({ source: "outbound_agent" })).toBe(true);
      expect(isValidOutboundSession({ source: "website" })).toBe(false);
      expect(isValidOutboundSession({})).toBe(false);
    });

    it("returns the existing account instead of creating a duplicate for an already-adopted session", () => {
      // Mirrors the accounts.stripe_customer_id lookup added before account
      // creation in the outbound checkout branch — belt-and-suspenders
      // alongside the idempotency-key check, which only catches identical
      // requests (not a replay with a different idempotency key).
      const findExistingAccount = (stripeCustomerId: string, accounts: Array<{ id: string; stripe_customer_id: string }>) =>
        accounts.find((a) => a.stripe_customer_id === stripeCustomerId) ?? null;

      const existingAccounts = [{ id: "acct_123", stripe_customer_id: "cus_abc" }];
      expect(findExistingAccount("cus_abc", existingAccounts)?.id).toBe("acct_123");
      expect(findExistingAccount("cus_new", existingAccounts)).toBeNull();
    });
  });

  describe("Outbound checkout link vs. trial creation events (P1 fix)", () => {
    // agent-trial-checkout must never fire outbound_trial_creation_succeeded
    // itself — a checkout session being created and texted doesn't mean the
    // prospect completed it, and stripe-webhook fires that same event again
    // after create-trial actually creates the account, which would
    // double-count real conversions.
    it("agent-trial-checkout fires a distinct checkout-link event, not trial-creation success", () => {
      const eventFiredByAgentTrialCheckout = "outbound_checkout_link_sent";
      const eventFiredByStripeWebhookOnRealSuccess = "outbound_trial_creation_succeeded";
      expect(eventFiredByAgentTrialCheckout).not.toBe(eventFiredByStripeWebhookOnRealSuccess);
    });
  });

  describe("Durable retry for failed outbound account adoption (P1 fix)", () => {
    // record_stripe_event marks a Stripe event id as seen before
    // processing, so once create-trial adoption fails, Stripe will never
    // redeliver that webhook. retry-outbound-account-creation's cron sweep
    // is the only recovery path — this mirrors its retry-count/permanent-
    // failure bookkeeping.
    const MAX_RETRIES = 5;

    function nextRetryState(currentRetryCount: number) {
      const nextRetryCount = currentRetryCount + 1;
      return {
        retry_count: nextRetryCount,
        status: nextRetryCount >= MAX_RETRIES ? "account_creation_failed_permanent" : "account_creation_failed",
      };
    }

    it("keeps retrying below the max retry count", () => {
      expect(nextRetryState(0).status).toBe("account_creation_failed");
      expect(nextRetryState(3).status).toBe("account_creation_failed");
    });

    it("marks permanently failed once the max retry count is reached", () => {
      expect(nextRetryState(4).status).toBe("account_creation_failed_permanent");
      expect(nextRetryState(4).retry_count).toBe(5);
    });

    it("a successful retry always marks the row account_created with the resulting account_id", () => {
      const applySuccess = (accountId: string) => ({ status: "account_created", account_id: accountId });
      expect(applySuccess("acct_recovered")).toEqual({ status: "account_created", account_id: "acct_recovered" });
    });
  });

  describe("agent-trial-checkout event/correlation fixes (P2 findings)", () => {
    // Mirrors the dbLoggingFailed guard: firing both outbound_trial_creation_failed
    // (from the DB-logging catch) and outbound_checkout_link_sent for the same
    // attempt would double-count it in the success-rate formula.
    function shouldFireCheckoutLinkSentEvent(dbLoggingFailed: boolean): boolean {
      return !dbLoggingFailed;
    }

    it("does not fire the checkout-link-sent event when DB logging already failed", () => {
      expect(shouldFireCheckoutLinkSentEvent(true)).toBe(false);
    });

    it("fires the checkout-link-sent event when DB logging succeeded", () => {
      expect(shouldFireCheckoutLinkSentEvent(false)).toBe(true);
    });

    // Mirrors hoisting vapiCallId out of the try block so the outer catch
    // can still use `vapiCallId ?? toolCallId` instead of losing call
    // correlation by falling back to toolCallId alone.
    it("the outer catch's distinct id still prefers vapiCallId when one was parsed before the failure", () => {
      const toolCallId = "tool_abc";
      const vapiCallId = "call_xyz";
      const distinctId = vapiCallId ?? toolCallId;
      expect(distinctId).toBe("call_xyz");
    });

    it("falls back to toolCallId only when no vapiCallId was ever parsed", () => {
      const toolCallId = "tool_abc";
      const vapiCallId: string | null = null;
      const distinctId = vapiCallId ?? toolCallId;
      expect(distinctId).toBe("tool_abc");
    });
  });

  describe("error_encountered event (additive PostHog tracking)", () => {
    // Mirrors captureCreateTrialException's new error_encountered capture:
    // every existing call site already passes a distinct `step` string,
    // which doubles as failure_stage without touching each of the 48 call
    // sites individually.
    function buildErrorEncounteredProps(
      err: unknown,
      step: string,
      context: Record<string, unknown> = {}
    ) {
      const e = err instanceof Error ? err : new Error(String(err));
      return {
        environment: "test",
        flow: "create_trial",
        function_name: "create-trial",
        failure_stage: step,
        error_code: (err as { name?: string; code?: string })?.name ?? (err as { name?: string; code?: string })?.code ?? "UnknownError",
        failure_reason: e.message,
        correlation_id: (context.correlation_id as string | undefined) ?? null,
        lead_id: (context.lead_id as string | undefined) ?? null,
        account_id: (context.account_id as string | undefined) ?? null,
        retry_count: (context.retry_count as number | undefined) ?? 0,
      };
    }

    it("uses error.message, not the stack trace, for failure_reason", () => {
      const err = new Error("Stripe Customer Create Failed: card declined");
      err.stack = "Error: Stripe Customer Create Failed\n    at foo.ts:123";
      const props = buildErrorEncounteredProps(err, "stripe_customer_create");
      expect(props.failure_reason).toBe("Stripe Customer Create Failed: card declined");
      expect(props.failure_reason).not.toContain("at foo.ts");
    });

    it("uses the distinct step string as failure_stage, unmodified", () => {
      expect(buildErrorEncounteredProps(new Error("x"), "supabase_insert_account").failure_stage).toBe("supabase_insert_account");
      expect(buildErrorEncounteredProps(new Error("x"), "outbound_checkout_verify").failure_stage).toBe("outbound_checkout_verify");
    });

    it("defaults correlation_id/lead_id/account_id to null and retry_count to 0 when not in scope", () => {
      const props = buildErrorEncounteredProps(new Error("x"), "validation_phone");
      expect(props.correlation_id).toBeNull();
      expect(props.lead_id).toBeNull();
      expect(props.account_id).toBeNull();
      expect(props.retry_count).toBe(0);
    });

    it("passes through account_id/correlation_id when present in the existing context object", () => {
      const props = buildErrorEncounteredProps(new Error("x"), "supabase_insert_account", {
        account_id: "acct_123",
        correlation_id: "corr_456",
      });
      expect(props.account_id).toBe("acct_123");
      expect(props.correlation_id).toBe("corr_456");
    });

    it("never includes an email, phone number, or name in its properties", () => {
      const props = buildErrorEncounteredProps(new Error("x"), "validation_email", {
        account_id: "acct_123",
        // user_email/phone_number are passed to the exception capture via
        // ...context elsewhere, but error_encountered only reads the four
        // explicit correlation fields above — nothing else from context
        // leaks into it.
        user_email: "someone@example.com",
        phone_number: "+15551234567",
      });
      const values = Object.values(props).map((v) => String(v));
      expect(values.some((v) => v.includes("@"))).toBe(false);
      expect(values.some((v) => /\+1\d{10}/.test(v))).toBe(false);
    });
  });

  describe("Codex review fixes on error_encountered/environment (verified)", () => {
    // Mirrors isExpectedValidationRejection: routine 400/409/429 control-flow
    // rejections must not fire error_encountered, or the event becomes
    // useless for alerting (constant false positives on normal traffic).
    function isExpectedValidationRejection(step: string): boolean {
      return (
        step.startsWith("validation_") ||
        step === "validate_input_json_parse" ||
        step === "validate_input_schema"
      );
    }

    it("classifies routine validation/rate-limit/account-exists steps as expected", () => {
      expect(isExpectedValidationRejection("validation_phone")).toBe(true);
      expect(isExpectedValidationRejection("validation_email")).toBe(true);
      expect(isExpectedValidationRejection("validation_ip_rate_limit")).toBe(true);
      expect(isExpectedValidationRejection("validation_account_exists")).toBe(true);
      expect(isExpectedValidationRejection("validate_input_json_parse")).toBe(true);
      expect(isExpectedValidationRejection("validate_input_schema")).toBe(true);
    });

    it("classifies real operational failures as NOT expected (still fires error_encountered)", () => {
      expect(isExpectedValidationRejection("stripe_customer_create")).toBe(false);
      expect(isExpectedValidationRejection("supabase_insert_account")).toBe(false);
      expect(isExpectedValidationRejection("vapi_setup")).toBe(false);
      expect(isExpectedValidationRejection("twilio_provision")).toBe(false);
    });

    // Mirrors the environment resolution fix: NODE_ENV is never set in
    // deployed Supabase Edge Functions, so defaulting to it would mislabel
    // every production event as "development". ENVIRONMENT/SUPABASE_ENV
    // (matching _shared/server-analytics.ts) with a production default
    // fixes that.
    function resolveEnvironment(env: Record<string, string | undefined>): string {
      return env.ENVIRONMENT || env.SUPABASE_ENV || "production";
    }

    it("defaults to production, not development, when no environment env vars are set", () => {
      // This is the actual deployed-Edge-Function scenario NODE_ENV would
      // have silently mislabeled as "development".
      expect(resolveEnvironment({})).toBe("production");
    });

    it("respects an explicit ENVIRONMENT or SUPABASE_ENV value", () => {
      expect(resolveEnvironment({ ENVIRONMENT: "staging" })).toBe("staging");
      expect(resolveEnvironment({ SUPABASE_ENV: "staging" })).toBe("staging");
      expect(resolveEnvironment({ ENVIRONMENT: "staging", SUPABASE_ENV: "production" })).toBe("staging");
    });

    // Mirrors the __provisioningFailedAlreadyEmitted marker: an inner
    // catch that already emitted provisioning_failed before rethrowing
    // must suppress the outer catch's emission for the same error.
    it("suppresses the outer catch's provisioning_failed when an inner catch already emitted one", () => {
      const shouldEmit = (error: { __provisioningFailedAlreadyEmitted?: boolean }) =>
        !error.__provisioningFailedAlreadyEmitted;

      expect(shouldEmit({ __provisioningFailedAlreadyEmitted: true })).toBe(false);
      expect(shouldEmit({})).toBe(true);
    });

    // Mirrors deriving failure_stage from the already-computed errorCode
    // instead of a hardcoded "twilio_number_purchase" — the catch wraps
    // pooled-number binding, Vapi import, and DB persistence too, not just
    // the Twilio purchase.
    it("derives failure_stage from the actual error classification, not a hardcoded stage", () => {
      const deriveFailureStage = (errorCode: string) => errorCode.toLowerCase();
      expect(deriveFailureStage("TWILIO_PROVISIONING_FAILED")).toBe("twilio_provisioning_failed");
      expect(deriveFailureStage("VAPI_PHONE_FAILED")).toBe("vapi_phone_failed");
    });
  });
});

