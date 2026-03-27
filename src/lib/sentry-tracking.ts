/**
 * Sentry Tracking Utilities for RingSnap
 * 
 * Provides modern tracking for:
 * 1. Performance timings (page load, API response times)
 * 2. User interactions (button clicks, feature usage)
 * 3. Business metrics (conversions, funnel events)
 * 
 * Uses Sentry's current API (spans, breadcrumbs, custom events)
 */

import * as Sentry from "@sentry/react";

// ============================================================================
// 1. PERFORMANCE TIMING
// ============================================================================

/**
 * Track a timed operation (API calls, page renders, etc.)
 * 
 * @example
 * const result = await trackTiming("api.fetch_users", async () => {
 *   return await fetchUsers();
 * });
 */
export async function trackTiming<T>(
    operationName: string,
    operation: () => Promise<T>,
    attributes?: Record<string, string | number | boolean>
): Promise<T> {
    return Sentry.startSpan(
        {
            name: operationName,
            op: "function",
            attributes
        },
        async (span) => {
            try {
                const result = await operation();
                span.setStatus({ code: 1, message: "ok" }); // SpanStatusCode.OK
                return result;
            } catch (error) {
                span.setStatus({ code: 2, message: "error" }); // SpanStatusCode.ERROR
                throw error;
            }
        }
    );
}

/**
 * Track page load timing with web vitals
 * Call this in your page components or router
 * 
 * @example
 * useEffect(() => {
 *   trackPageLoad("Dashboard");
 * }, []);
 */
export function trackPageLoad(pageName: string): void {
    const navigationEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;

    if (navigationEntry) {
        const loadTime = navigationEntry.loadEventEnd - navigationEntry.startTime;
        const domContentLoaded = navigationEntry.domContentLoadedEventEnd - navigationEntry.startTime;
        const firstByte = navigationEntry.responseStart - navigationEntry.requestStart;

        Sentry.startSpan({ name: `page.${pageName}`, op: "pageload" }, (span) => {
            span.setAttribute("page_load_time_ms", loadTime);
            span.setAttribute("dom_content_loaded_ms", domContentLoaded);
            span.setAttribute("time_to_first_byte_ms", firstByte);
            span.setAttribute("page.name", pageName);
        });
    }

    // Also add breadcrumb for navigation tracking
    Sentry.addBreadcrumb({
        category: "navigation",
        message: `Loaded page: ${pageName}`,
        level: "info",
        data: { page: pageName, timestamp: Date.now() },
    });
}

/**
 * Track API response time
 * 
 * @example
 * const start = performance.now();
 * const response = await fetch('/api/data');
 * trackApiTiming('/api/data', performance.now() - start, response.ok);
 */
export function trackApiTiming(
    endpoint: string,
    durationMs: number,
    success: boolean,
    statusCode?: number
): void {
    Sentry.startSpan(
        {
            name: `api.${endpoint}`,
            op: "http.client",
            attributes: {
                "http.url": endpoint,
                "http.status_code": statusCode ?? (success ? 200 : 500),
            }
        },
        (span) => {
            span.setAttribute("response_time_ms", durationMs);
            span.setStatus({ code: success ? 1 : 2, message: success ? "ok" : "error" });
        }
    );
}


// ============================================================================
// 2. USER INTERACTIONS
// ============================================================================

/**
 * Track a button click or user action
 * 
 * @example
 * trackClick("upgrade_button", { plan: "professional", source: "billing_tab" });
 */
export function trackClick(
    elementName: string,
    data?: Record<string, string | number | boolean>
): void {
    Sentry.addBreadcrumb({
        category: "ui.click",
        message: `Clicked: ${elementName}`,
        level: "info",
        data: { element: elementName, ...data, timestamp: Date.now() },
    });
}

/**
 * Track feature usage
 * 
 * @example
 * trackFeatureUsage("guided_setup_chat", { step: 3 });
 */
export function trackFeatureUsage(
    featureName: string,
    data?: Record<string, string | number | boolean>
): void {
    Sentry.addBreadcrumb({
        category: "feature",
        message: `Used feature: ${featureName}`,
        level: "info",
        data: { feature: featureName, ...data, timestamp: Date.now() },
    });

    // Also set as user context for session replay correlation
    Sentry.setTag(`feature.${featureName}`, "used");
}

/**
 * Track form interactions
 * 
 * @example
 * trackFormEvent("signup_form", "submit", { success: true });
 * trackFormEvent("settings_form", "validation_error", { field: "email" });
 */
export function trackFormEvent(
    formName: string,
    action: "focus" | "blur" | "change" | "submit" | "validation_error" | "abandon",
    data?: Record<string, string | number | boolean>
): void {
    Sentry.addBreadcrumb({
        category: "ui.form",
        message: `Form ${action}: ${formName}`,
        level: action === "validation_error" ? "warning" : "info",
        data: { form: formName, action, ...data, timestamp: Date.now() },
    });
}

/**
 * Track navigation events
 * 
 * @example
 * trackNavigation("/dashboard", "/settings");
 */
export function trackNavigation(from: string, to: string): void {
    Sentry.addBreadcrumb({
        category: "navigation",
        message: `Navigated: ${from} → ${to}`,
        level: "info",
        data: { from, to, timestamp: Date.now() },
    });
}


// ============================================================================
// 3. BUSINESS METRICS / FUNNEL EVENTS
// ============================================================================

type FunnelStep =
    | "landing_page_view"
    | "pricing_view"
    | "signup_started"
    | "onboarding_started"
    | "signup_completed"
    | "trial_started"
    | "first_call_received"
    | "setup_completed"
    | "upgrade_initiated"
    | "upgrade_completed"
    | "cancellation_initiated"
    | "cancellation_completed";

/**
 * Track conversion funnel events
 * 
 * @example
 * trackFunnelEvent("signup_started", { source: "homepage_cta" });
 * trackFunnelEvent("trial_started", { plan: "professional" });
 */
export function trackFunnelEvent(
    step: FunnelStep,
    data?: Record<string, string | number | boolean>
): void {
    Sentry.addBreadcrumb({
        category: "funnel",
        message: `Funnel step: ${step}`,
        level: "info",
        data: { step, ...data, timestamp: Date.now() },
    });

    // Set as tag for filtering in Sentry session replays and errors
    Sentry.setTag("funnel.latest_step", step);
    // NOTE: captureMessage intentionally omitted — funnel steps are tracked in PostHog,
    // not as Sentry events (prevents quota exhaustion at scale).
}

/**
 * Track a conversion with optional value
 * 
 * @example
 * trackConversion("trial_signup", 0, { plan: "starter" });
 * trackConversion("upgrade", 99, { from_plan: "starter", to_plan: "professional" });
 */
export function trackConversion(
    conversionType: string,
    value: number = 0,
    data?: Record<string, string | number | boolean>
): void {
    Sentry.captureMessage(`Conversion: ${conversionType}`, {
        level: "info",
        tags: {
            conversion_type: conversionType,
            has_value: value > 0 ? "yes" : "no",
        },
        extra: { ...data, value, timestamp: Date.now() },
    });

    Sentry.addBreadcrumb({
        category: "conversion",
        message: `Conversion: ${conversionType}`,
        level: "info",
        data: { type: conversionType, value, ...data },
    });
}

/**
 * Track user journey checkpoint (for debugging and replay)
 * 
 * @example
 * trackCheckpoint("onboarding_step_3", { assistantConfigured: true });
 */
export function trackCheckpoint(
    checkpoint: string,
    data?: Record<string, string | number | boolean>
): void {
    Sentry.addBreadcrumb({
        category: "checkpoint",
        message: checkpoint,
        level: "info",
        data: { ...data, timestamp: Date.now() },
    });
}


// ============================================================================
// USER CONTEXT
// ============================================================================

/**
 * Set user context for all subsequent events
 * Call this after login
 * 
 * @example
 * setUserContext({ 
 *   userId: "abc123", 
 *   accountId: "acc456", 
 *   plan: "professional" 
 * });
 */
export function setUserContext(context: {
    userId: string;
    accountId?: string;
    plan?: string;
    role?: string;
}): void {
    Sentry.setUser({ id: context.userId });

    if (context.accountId) Sentry.setTag("account_id", context.accountId);
    if (context.plan) Sentry.setTag("plan", context.plan);
    if (context.role) Sentry.setTag("role", context.role);
}

/**
 * Clear user context on logout
 */
export function clearUserContext(): void {
    Sentry.setUser(null);
}


// ============================================================================
// 4. ONBOARDING & ACTIVATION EVENTS
// ============================================================================

type OnboardingEventName =
    | 'activation.test_call_initiated'
    | 'activation.test_call_detected'
    | 'activation.troubleshooting_shown'
    | 'activation.completed'
    | 'activation.forwarding_confirmed'
    | 'activation.verification_started'
    | 'phone_number.add_clicked'
    | 'phone_number.add_success'
    | 'phone_number.add_failed'
    | 'settings.call_recording_toggled'
    | 'settings.assistant_updated';

/**
 * Track onboarding and activation events with Sentry breadcrumbs
 *
 * @example
 * trackOnboardingEvent('activation.test_call_initiated', { phoneNumberId: 'xxx' });
 */
export function trackOnboardingEvent(
    eventName: OnboardingEventName,
    data?: Record<string, string | number | boolean | null>
): void {
    Sentry.addBreadcrumb({
        category: 'onboarding',
        message: eventName,
        level: 'info',
        data: { event: eventName, ...data, timestamp: Date.now() },
    });

    // For critical events, also capture as custom event
    const criticalEvents: OnboardingEventName[] = [
        'activation.completed',
        'phone_number.add_success',
        'phone_number.add_failed',
    ];

    if (criticalEvents.includes(eventName)) {
        Sentry.captureMessage(`Onboarding: ${eventName}`, {
            level: 'info',
            tags: { onboarding_event: eventName },
            extra: data,
        });
    }
}

/**
 * Track onboarding error with full context
 *
 * @example
 * trackOnboardingError('phone_number.add_failed', new Error('Twilio error'), { step: 'provision' });
 */
export function trackOnboardingError(
    eventName: OnboardingEventName,
    error: Error | unknown,
    data?: Record<string, string | number | boolean | null>
): void {
    const errorMessage = error instanceof Error ? error.message : String(error);

    Sentry.addBreadcrumb({
        category: 'onboarding',
        message: `${eventName}: ${errorMessage}`,
        level: 'error',
        data: { event: eventName, error: errorMessage, ...data, timestamp: Date.now() },
    });

    Sentry.captureException(error, {
        tags: { onboarding_event: eventName },
        extra: { ...data, eventName },
    });
}
