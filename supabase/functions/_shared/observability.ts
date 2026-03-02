/**
 * Observability Module for RingSnap Edge Functions
 *
 * Provides structured event logging to the system_events table with:
 * - Trace ID propagation for request correlation
 * - Privacy-aware sanitization (no PII in logs)
 * - Resilient inserts (never breaks core flows)
 * - Kill switch via OBS_EVENTS_ENABLED env var
 *
 * Usage:
 *   import { parseTraceId, logSystemEvent, createObservabilityContext } from "../_shared/observability.ts";
 *
 *   const traceId = parseTraceId(req);
 *   const obs = createObservabilityContext(supabase, traceId, "my-function");
 *   await obs.info("user_signup_started", { userId: "..." });
 */

import { SupabaseClient } from "supabase";

// Environment controls
const OBS_EVENTS_ENABLED = Deno.env.get("OBS_EVENTS_ENABLED") !== "false"; // Default: enabled
const MAX_METADATA_SIZE = 4096; // 4KB max for metadata JSON

export type EventLevel = "debug" | "info" | "warn" | "error";

export interface SystemEventInput {
    trace_id: string;
    event_name: string;
    level: EventLevel;
    email?: string;
    user_id?: string;
    account_id?: string;
    error_code?: string;
    error_message?: string;
    metadata?: Record<string, unknown>;
}

// Sensitive field patterns to redact
const SENSITIVE_PATTERNS = [
    "password",
    "secret",
    "token",
    "authorization",
    "cookie",
    "transcript",
    "raw_audio",
    "card",
    "ssn",
    "api_key",
    "apikey",
    "stripe_key",
    "publishable_key",
];

/**
 * Extract trace ID from request headers or generate a new one
 */
export function parseTraceId(req: Request): string {
    const candidates = [
        "x-trace-id",
        "x-correlation-id",
        "x-request-id",
        "requestid",
        "traceparent",
    ];

    for (const header of candidates) {
        const value = req.headers.get(header);
        if (value) {
            return value;
        }
    }

    return crypto.randomUUID();
}

/**
 * Sanitize an object by redacting sensitive fields
 */
function sanitizeObject(obj: unknown): unknown {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (typeof obj === "string") {
        // Truncate very long strings
        if (obj.length > 500) {
            return obj.substring(0, 500) + "...[truncated]";
        }
        return obj;
    }

    if (typeof obj !== "object") {
        return obj;
    }

    if (Array.isArray(obj)) {
        // Limit array size
        const truncated = obj.slice(0, 10);
        return truncated.map((item) => sanitizeObject(item));
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        const keyLower = key.toLowerCase();
        const isSensitive = SENSITIVE_PATTERNS.some((pattern) =>
            keyLower.includes(pattern)
        );

        if (isSensitive) {
            result[key] = "[REDACTED]";
        } else if (typeof value === "object" && value !== null) {
            result[key] = sanitizeObject(value);
        } else {
            result[key] = value;
        }
    }
    return result;
}

/**
 * Truncate metadata to max size
 */
function truncateMetadata(
    metadata: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
    if (!metadata) return undefined;

    const sanitized = sanitizeObject(metadata) as Record<string, unknown>;
    const jsonStr = JSON.stringify(sanitized);

    if (jsonStr.length <= MAX_METADATA_SIZE) {
        return sanitized;
    }

    // If too large, return a truncation notice
    return {
        _truncated: true,
        _original_size: jsonStr.length,
        _message: "Metadata exceeded size limit and was truncated",
    };
}

/**
 * Log a system event to the system_events table
 *
 * This function is designed to NEVER throw or break core flows.
 * Failures are logged to console but silently ignored.
 */
export async function logSystemEvent(
    supabase: SupabaseClient,
    event: SystemEventInput
): Promise<void> {
    // Kill switch - disable event logging entirely
    if (!OBS_EVENTS_ENABLED) {
        return;
    }

    try {
        // Sanitize and prepare the event
        const sanitizedEvent = {
            trace_id: event.trace_id,
            event_name: event.event_name.substring(0, 100), // Max 100 chars
            level: event.level,
            email: event.email?.substring(0, 255), // Max 255 chars
            user_id: event.user_id || null,
            account_id: event.account_id || null,
            error_code: event.error_code?.substring(0, 50) || null,
            error_message: event.error_message?.substring(0, 500) || null,
            metadata: truncateMetadata(event.metadata),
        };

        // Insert with service role - bypasses RLS
        const { error } = await supabase
            .from("system_events")
            .insert(sanitizedEvent);

        if (error) {
            // Log to console but don't throw
            console.error(
                `[observability] Failed to log system event: ${error.message}`,
                {
                    event_name: event.event_name,
                    trace_id: event.trace_id,
                }
            );
        }
    } catch (err) {
        // Catch any unexpected errors - never break core flows
        console.error("[observability] Unexpected error logging system event:", err);
    }
}

/**
 * Create a scoped observability context for a request
 *
 * This provides convenience methods for logging events with pre-filled context.
 */
export function createObservabilityContext(
    supabase: SupabaseClient,
    traceId: string,
    functionName: string
) {
    let accountId: string | undefined;
    let userId: string | undefined;
    let email: string | undefined;

    return {
        /** Get the trace ID for this context */
        traceId,

        /** Set account context for subsequent events */
        setAccount(id: string) {
            accountId = id;
        },

        /** Set user context for subsequent events */
        setUser(id: string, userEmail?: string) {
            userId = id;
            if (userEmail) {
                email = userEmail;
            }
        },

        /** Log a debug event */
        async debug(
            eventName: string,
            metadata?: Record<string, unknown>
        ): Promise<void> {
            await logSystemEvent(supabase, {
                trace_id: traceId,
                event_name: `${functionName}.${eventName}`,
                level: "debug",
                account_id: accountId,
                user_id: userId,
                email,
                metadata,
            });
        },

        /** Log an info event */
        async info(
            eventName: string,
            metadata?: Record<string, unknown>
        ): Promise<void> {
            await logSystemEvent(supabase, {
                trace_id: traceId,
                event_name: `${functionName}.${eventName}`,
                level: "info",
                account_id: accountId,
                user_id: userId,
                email,
                metadata,
            });
        },

        /** Log a warning event */
        async warn(
            eventName: string,
            metadata?: Record<string, unknown>
        ): Promise<void> {
            await logSystemEvent(supabase, {
                trace_id: traceId,
                event_name: `${functionName}.${eventName}`,
                level: "warn",
                account_id: accountId,
                user_id: userId,
                email,
                metadata,
            });
        },

        /** Log an error event */
        async error(
            eventName: string,
            errorCode?: string,
            errorMessage?: string,
            metadata?: Record<string, unknown>
        ): Promise<void> {
            await logSystemEvent(supabase, {
                trace_id: traceId,
                event_name: `${functionName}.${eventName}`,
                level: "error",
                account_id: accountId,
                user_id: userId,
                email,
                error_code: errorCode,
                error_message: errorMessage,
                metadata,
            });
        },
    };
}
