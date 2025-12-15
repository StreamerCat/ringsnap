/**
 * Sentry Test Function
 *
 * Simple test function to verify Sentry integration is working correctly.
 * Deploy and invoke to trigger intentional errors for verification.
 *
 * Usage:
 *   supabase functions deploy sentry-test
 *   curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/sentry-test \
 *     -H "Content-Type: application/json" \
 *     -d '{"testType": "error"}'
 *
 * Test Types:
 *   - error: Trigger an unhandled error
 *   - redaction: Test sensitive data redaction
 *   - context: Test context tags (accountId, userId)
 *   - success: Test successful request (no error)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentryEdge, captureEdgeError, redact } from "../_shared/sentry.ts";
import { logInfo, logError } from "../_shared/logging.ts";

serve(
  withSentryEdge({ functionName: "sentry-test" }, async (req, ctx) => {
    const baseLog = { functionName: ctx.functionName, correlationId: ctx.correlationId };

    logInfo("Sentry test function started", baseLog);

    try {
      const body = await req.json();
      const testType = body.testType || "error";

      logInfo("Test type selected", { ...baseLog, testType });

      switch (testType) {
        case "error":
          // Test 1: Unhandled error
          ctx.accountId = "test-account-123";
          ctx.userId = "test-user-456";

          logError("Triggering intentional test error", { ...baseLog, testType });
          throw new Error("Intentional test error for Sentry verification");

        case "redaction":
          // Test 2: Redaction of sensitive data
          ctx.accountId = "test-account-redaction";

          await captureEdgeError(
            new Error("Test error with sensitive data"),
            ctx,
            {
              // These should all be redacted
              customer_email: "sensitive@example.com",
              phone_number: "+1234567890",
              stripe_secret_key: "sk_live_abc123xyz",
              authorization_header: "Bearer token123",
              credit_card: "4242-4242-4242-4242",

              // These should NOT be redacted
              account_type: "premium",
              plan_id: "price_123",
              request_count: 5,
            }
          );

          logInfo("Redaction test completed", baseLog);

          return new Response(
            JSON.stringify({
              success: true,
              message: "Redaction test error sent to Sentry. Check Sentry UI - sensitive fields should be [REDACTED]",
              correlationId: ctx.correlationId,
            }),
            {
              headers: { "Content-Type": "application/json" },
              status: 200,
            }
          );

        case "context":
          // Test 3: Context tags and external service IDs
          ctx.accountId = "test-account-context";
          ctx.userId = "test-user-context";
          ctx.stripe_customer_id = "cus_test123";
          ctx.stripe_subscription_id = "sub_test456";
          ctx.vapi_assistant_id = "asst_test789";

          await captureEdgeError(
            new Error("Test error with full context"),
            ctx,
            {
              step: "context_verification",
              additional_info: "Testing context tags",
            }
          );

          logInfo("Context test completed", baseLog);

          return new Response(
            JSON.stringify({
              success: true,
              message: "Context test error sent to Sentry. Check tags: account_id, user_id, etc.",
              correlationId: ctx.correlationId,
              contextAdded: {
                accountId: ctx.accountId,
                userId: ctx.userId,
                stripeCustomerId: ctx.stripe_customer_id,
                stripeSubscriptionId: ctx.stripe_subscription_id,
                vapiAssistantId: ctx.vapi_assistant_id,
              },
            }),
            {
              headers: { "Content-Type": "application/json" },
              status: 200,
            }
          );

        case "success":
          // Test 4: Successful request (no error)
          logInfo("Success test - no error triggered", baseLog);

          return new Response(
            JSON.stringify({
              success: true,
              message: "Test completed successfully - no error sent to Sentry",
              correlationId: ctx.correlationId,
            }),
            {
              headers: { "Content-Type": "application/json" },
              status: 200,
            }
          );

        case "redact-external-api":
          // Test 5: Redacting external API responses
          const mockStripeResponse = {
            id: "cus_123",
            email: "customer@example.com",
            phone: "+1234567890",
            payment_method: {
              card: {
                last4: "4242",
                brand: "visa",
              },
            },
            metadata: {
              account_id: "acc_789",
            },
          };

          const redactedResponse = redact(mockStripeResponse);

          await captureEdgeError(
            new Error("Test error with external API response"),
            ctx,
            {
              stripe_response: redactedResponse,
              test_type: "external_api_redaction",
            }
          );

          logInfo("External API redaction test completed", baseLog);

          return new Response(
            JSON.stringify({
              success: true,
              message: "External API redaction test completed",
              correlationId: ctx.correlationId,
              original: mockStripeResponse,
              redacted: redactedResponse,
            }),
            {
              headers: { "Content-Type": "application/json" },
              status: 200,
            }
          );

        default:
          return new Response(
            JSON.stringify({
              error: "Invalid testType",
              validTypes: ["error", "redaction", "context", "success", "redact-external-api"],
            }),
            {
              headers: { "Content-Type": "application/json" },
              status: 400,
            }
          );
      }
    } catch (error) {
      logError("Test function error", { ...baseLog, error });

      // Error is already captured by withSentryEdge wrapper
      // Return success response since this is a test function
      return new Response(
        JSON.stringify({
          success: true,
          message: "Test error captured successfully",
          error: error instanceof Error ? error.message : String(error),
          correlationId: ctx.correlationId,
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }
      );
    }
  })
);
