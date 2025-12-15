/**
 * Sentry Error Tracking for Supabase Edge Functions (Request-Safe)
 *
 * This module provides production-ready Sentry integration for Supabase Edge Functions
 * following Deno runtime best practices for request isolation.
 *
 * Key Features:
 * - Request-scoped error capture (no global state leakage)
 * - Automatic correlation ID linkage with structured logs
 * - Redaction of sensitive data (PII, tokens, secrets)
 * - Proper flush behavior to ensure events are sent before function exit
 * - Rich context tags (region, execution_id, accountId, userId)
 *
 * Usage:
 *   import { withSentryEdge, captureEdgeError } from "../_shared/sentry.ts";
 *   import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 *
 *   serve(withSentryEdge({ functionName: "my-function" }, async (req, ctx) => {
 *     try {
 *       // Your handler logic
 *       return new Response(JSON.stringify({ success: true }));
 *     } catch (error) {
 *       await captureEdgeError(error, ctx);
 *       throw error;
 *     }
 *   }));
 *
 * Environment Variables:
 * - SENTRY_DSN: Sentry project DSN (required)
 * - ENVIRONMENT: Production environment name (defaults to "production")
 * - SB_REGION: Supabase region (auto-injected by platform)
 * - SB_EXECUTION_ID: Unique execution ID (auto-injected by platform)
 */

// Deno globals available at runtime in Supabase Edge Functions
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const SENTRY_DSN = Deno.env.get("SENTRY_DSN") || "";

/**
 * Context object passed through request handlers for Sentry tracking
 */
export interface SentryEdgeContext {
  functionName: string;
  correlationId: string;
  accountId?: string;
  userId?: string;

  // Additional allowed context fields for external service tracking
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  stripe_invoice_id?: string;
  stripe_event_id?: string;
  stripe_event_type?: string;

  vapi_assistant_id?: string;
  vapi_phone_number_id?: string;
  vapi_call_id?: string;

  twilio_sid?: string;

  // Allow additional custom fields
  [key: string]: string | undefined;
}

/**
 * Redact sensitive fields from objects before sending to Sentry
 * Removes keys containing: email, phone, token, secret, authorization, cookie, transcript, raw_audio, card
 */
export function redact(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redact(item));
  }

  const redacted: Record<string, unknown> = {};
  const sensitivePatterns = [
    "email",
    "phone",
    "token",
    "secret",
    "authorization",
    "cookie",
    "transcript",
    "raw_audio",
    "card",
    "password",
    "ssn",
    "api_key",
    "apikey",
  ];

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const keyLower = key.toLowerCase();
    const isSensitive = sensitivePatterns.some(pattern => keyLower.includes(pattern));

    if (isSensitive) {
      redacted[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      redacted[key] = redact(value);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Capture an error to Sentry with proper context and tags
 *
 * This function sends errors directly to Sentry via HTTP API since the Sentry SDK
 * doesn't fully support Deno runtime. It includes automatic redaction and proper tagging.
 *
 * @param error - The error to capture (Error object or unknown)
 * @param ctx - Sentry context with correlation ID, accountId, etc.
 * @param extraContext - Additional context fields (will be redacted)
 */
export async function captureEdgeError(
  error: Error | unknown,
  ctx: SentryEdgeContext,
  extraContext?: Record<string, unknown>
): Promise<void> {
  if (!SENTRY_DSN) {
    console.warn("[Sentry] DSN not configured, skipping error capture");
    return;
  }

  const err = error instanceof Error ? error : new Error(String(error));

  try {
    // Parse DSN: https://{PUBLIC_KEY}@{HOST}/{PROJECT_ID}
    const dsnMatch = SENTRY_DSN.match(/https:\/\/([^@]+)@([^/]+)\/(\d+)/);
    if (!dsnMatch) {
      console.error("[Sentry] Invalid DSN format");
      return;
    }

    const [, publicKey, host, projectId] = dsnMatch;
    const sentryUrl = `https://${host}/api/${projectId}/store/?sentry_key=${publicKey}&sentry_version=7`;

    // Extract environment variables
    const environment = Deno.env.get("ENVIRONMENT") || "production";
    const region = Deno.env.get("SB_REGION") || "unknown";
    const executionId = Deno.env.get("SB_EXECUTION_ID") || "unknown";

    // Build tags (indexed, searchable)
    const tags: Record<string, string> = {
      function_name: ctx.functionName,
      environment,
      region,
      execution_id: executionId,
    };

    // Add optional tags if present
    if (ctx.accountId) tags.account_id = ctx.accountId;
    if (ctx.userId) tags.user_id = ctx.userId;

    // Build extra context (not indexed, for detailed debugging)
    const extra: Record<string, unknown> = {
      correlation_id: ctx.correlationId,
      ...redact(extraContext || {}),
    };

    // Add allowed external service IDs to extra context
    if (ctx.stripe_customer_id) extra.stripe_customer_id = ctx.stripe_customer_id;
    if (ctx.stripe_subscription_id) extra.stripe_subscription_id = ctx.stripe_subscription_id;
    if (ctx.stripe_invoice_id) extra.stripe_invoice_id = ctx.stripe_invoice_id;
    if (ctx.stripe_event_id) extra.stripe_event_id = ctx.stripe_event_id;
    if (ctx.stripe_event_type) extra.stripe_event_type = ctx.stripe_event_type;

    if (ctx.vapi_assistant_id) extra.vapi_assistant_id = ctx.vapi_assistant_id;
    if (ctx.vapi_phone_number_id) extra.vapi_phone_number_id = ctx.vapi_phone_number_id;
    if (ctx.vapi_call_id) extra.vapi_call_id = ctx.vapi_call_id;

    if (ctx.twilio_sid) extra.twilio_sid = ctx.twilio_sid;

    // Parse stack trace
    const frames = err.stack
      ? err.stack
          .split("\n")
          .slice(1)
          .map((line) => {
            const match = line.match(/at\s+(.+?)\s+\((.+):(\d+):(\d+)\)/);
            if (match) {
              return {
                function: match[1],
                filename: match[2],
                lineno: parseInt(match[3], 10),
                colno: parseInt(match[4], 10),
              };
            }
            return { filename: line.trim() };
          })
      : [];

    // Build Sentry event
    const event = {
      event_id: crypto.randomUUID().replace(/-/g, ""),
      timestamp: new Date().toISOString(),
      platform: "javascript",
      level: "error",
      logger: ctx.functionName,
      server_name: "supabase-edge-function",
      environment,
      exception: {
        values: [
          {
            type: err.name,
            value: err.message,
            stacktrace: frames.length > 0 ? { frames } : undefined,
          },
        ],
      },
      tags,
      extra,
      user: ctx.userId
        ? {
            id: ctx.userId,
          }
        : undefined,
    };

    // Send to Sentry with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    try {
      const response = await fetch(sentryUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`[Sentry] Failed to send event: ${response.status}`);
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if ((fetchError as Error).name === "AbortError") {
        console.error("[Sentry] Request timed out after 5s");
      } else {
        throw fetchError;
      }
    }
  } catch (sendError) {
    // Don't fail the main flow if Sentry fails
    console.error("[Sentry] Error sending to Sentry:", sendError);
  }
}

/**
 * Wrap an Edge Function handler with automatic Sentry error capture
 *
 * This wrapper:
 * - Extracts correlation ID from request headers
 * - Creates request-scoped Sentry context
 * - Automatically captures uncaught errors
 * - Ensures proper flush behavior
 *
 * @param config - Configuration with functionName and optional default context
 * @param handler - Your Edge Function handler
 * @returns Wrapped handler with Sentry integration
 */
export function withSentryEdge<T extends Response>(
  config: { functionName: string },
  handler: (req: Request, ctx: SentryEdgeContext) => Promise<T>
): (req: Request) => Promise<T> {
  return async (req: Request): Promise<T> => {
    // Extract correlation ID from headers (compatible with existing logging)
    const correlationId =
      req.headers.get("x-correlation-id") ||
      req.headers.get("x-request-id") ||
      req.headers.get("requestid") ||
      crypto.randomUUID();

    // Create request-scoped context
    const ctx: SentryEdgeContext = {
      functionName: config.functionName,
      correlationId,
    };

    try {
      return await handler(req, ctx);
    } catch (error) {
      // Capture error and flush before re-throwing
      await captureEdgeError(error, ctx);
      throw error; // Re-throw to let the function handle the error response
    }
  };
}

/**
 * Legacy compatibility wrapper
 * @deprecated Use withSentryEdge instead
 */
export function initSentry(
  functionName: string,
  options?: { correlationId?: string; accountId?: string; userId?: string }
): void {
  console.warn(
    "[Sentry] initSentry is deprecated. Use withSentryEdge wrapper instead for request-safe error tracking."
  );
}

/**
 * Legacy compatibility wrapper
 * @deprecated Use captureEdgeError with context instead
 */
export function captureError(
  error: Error | unknown,
  extraTags?: Record<string, string>
): Promise<void> {
  console.warn(
    "[Sentry] captureError is deprecated. Use captureEdgeError with SentryEdgeContext instead."
  );

  // Provide minimal fallback behavior
  const ctx: SentryEdgeContext = {
    functionName: "unknown",
    correlationId: crypto.randomUUID(),
  };

  return captureEdgeError(error, ctx, extraTags);
}

/**
 * Legacy compatibility wrapper
 * @deprecated Context should be passed via handler, not set globally
 */
export function setContext(key: string, value: string): void {
  console.warn(
    "[Sentry] setContext is deprecated. Pass context fields via captureEdgeError instead."
  );
}

/**
 * Legacy compatibility wrapper - withSentry
 * @deprecated Use withSentryEdge instead
 */
export function withSentry<T>(
  functionName: string,
  handler: (req: Request) => Promise<T>
): (req: Request) => Promise<T> {
  console.warn(
    "[Sentry] withSentry is deprecated. Use withSentryEdge instead for request-safe error tracking."
  );

  return async (req: Request): Promise<T> => {
    const correlationId =
      req.headers.get("x-correlation-id") ||
      req.headers.get("x-request-id") ||
      crypto.randomUUID();

    const ctx: SentryEdgeContext = {
      functionName,
      correlationId,
    };

    try {
      return await handler(req);
    } catch (error) {
      await captureEdgeError(error, ctx);
      throw error;
    }
  };
}
