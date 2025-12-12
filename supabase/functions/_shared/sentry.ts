/**
 * Sentry Error Tracking for Edge Functions
 * 
 * Provides error-only tracking (no tracing) for Supabase Edge Functions.
 * Initialize once per function, then use captureError to send errors to Sentry.
 * 
 * Usage:
 *   import { initSentry, captureError, setContext } from "../_shared/sentry.ts";
 *   
 *   // At function start:
 *   initSentry("function-name");
 *   
 *   // In catch blocks:
 *   captureError(error, { customTag: "value" });
 * 
 * DSN is loaded from SENTRY_DSN environment variable.
 */

// Deno globals are available at runtime in Supabase Edge Functions
declare const Deno: {
    env: {
        get(key: string): string | undefined;
    };
};

const SENTRY_DSN = Deno.env.get("SENTRY_DSN") || "";

interface SentryContext {
    functionName: string;
    correlationId?: string;
    accountId?: string;
    userId?: string;
    [key: string]: string | undefined;
}

let sentryContext: SentryContext = { functionName: "unknown" };
let initialized = false;

/**
 * Initialize Sentry for this edge function
 * Call once at the start of your function handler
 */
export function initSentry(
    functionName: string,
    options?: { correlationId?: string; accountId?: string; userId?: string }
): void {
    sentryContext = {
        functionName,
        correlationId: options?.correlationId,
        accountId: options?.accountId,
        userId: options?.userId,
    };
    initialized = true;
}

/**
 * Set additional context for error tracking
 */
export function setContext(key: string, value: string): void {
    sentryContext[key] = value;
}

/**
 * Capture and send an error to Sentry
 * This uses Sentry's HTTP API directly since the Sentry SDK doesn't support Deno
 */
export async function captureError(
    error: Error | unknown,
    extraTags?: Record<string, string>
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

        const event = {
            event_id: crypto.randomUUID().replace(/-/g, ""),
            timestamp: new Date().toISOString(),
            platform: "javascript",
            level: "error",
            logger: sentryContext.functionName,
            server_name: "supabase-edge-function",
            environment: Deno.env.get("ENVIRONMENT") || "production",
            exception: {
                values: [
                    {
                        type: err.name,
                        value: err.message,
                        stacktrace: err.stack
                            ? {
                                frames: err.stack
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
                                    }),
                            }
                            : undefined,
                    },
                ],
            },
            tags: {
                function_name: sentryContext.functionName,
                ...extraTags,
            },
            extra: {
                correlation_id: sentryContext.correlationId,
                account_id: sentryContext.accountId,
                user_id: sentryContext.userId,
            },
            user: sentryContext.userId
                ? {
                    id: sentryContext.userId,
                }
                : undefined,
        };

        const response = await fetch(sentryUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(event),
        });

        if (!response.ok) {
            console.error(`[Sentry] Failed to send event: ${response.status}`);
        }
    } catch (sendError) {
        // Don't fail the main flow if Sentry fails
        console.error("[Sentry] Error sending to Sentry:", sendError);
    }
}

/**
 * Wrap an async handler with Sentry error capture
 * Automatically captures any uncaught errors
 */
export function withSentry<T>(
    functionName: string,
    handler: (req: Request) => Promise<T>
): (req: Request) => Promise<T> {
    return async (req: Request): Promise<T> => {
        // Extract correlation ID from header if present
        const correlationId =
            req.headers.get("x-correlation-id") ||
            req.headers.get("x-request-id") ||
            crypto.randomUUID();

        initSentry(functionName, { correlationId });

        try {
            return await handler(req);
        } catch (error) {
            await captureError(error);
            throw error; // Re-throw to let the function handle the error response
        }
    };
}
