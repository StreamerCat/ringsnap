/**
 * PostHog Analytics Wrapper — RingSnap
 *
 * Single source of truth for all PostHog calls. No inline posthog imports anywhere else.
 *
 * Architecture contract:
 *   - PostHog is the measurement and signal layer
 *   - Sentry (sentry-tracking.ts) is the error and performance layer — kept separately, untouched
 *   - Every capture/identify/group call goes through this file
 *
 * Cost guardrails enforced here:
 *   - autocapture: false (targeted events only)
 *   - capture_pageview: false (manual page_viewed via RouteTracker in App.tsx)
 *   - Session replay: 10% sampling, only on /start, /onboarding-chat, /activation
 *   - No network capture, no console log capture
 *   - All calls are no-ops if VITE_POSTHOG_KEY is not set (safe in CI and local dev)
 *
 * Feature flag stubs (inactive in Phase 1 — requires PostHog UI to activate):
 *   - hero-headline-test
 *   - pricing-layout-test
 *   - onboarding-flow-test
 *
 * Naming convention for flags: kebab-case, [surface]-[element]-[test/rollout]
 */

import posthog from 'posthog-js';
import { useEffect, useRef } from 'react';

// ============================================================================
// Configuration
// ============================================================================

const IS_DEV = import.meta.env.DEV;
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com';

/**
 * Paths where session replay is enabled (10% sampling).
 * All other paths: replay explicitly disabled.
 */
const REPLAY_PATHS = ['/start', '/onboarding-chat', '/activation'];

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize PostHog. Call once at app startup (src/main.tsx), after Sentry.init().
 * Non-blocking — PostHog loads asynchronously via its `loaded` callback.
 * No-op if VITE_POSTHOG_KEY is not set.
 */
export function initAnalytics(): void {
  if (!POSTHOG_KEY) {
    if (IS_DEV) {
      console.log('[Analytics] PostHog not initialized — VITE_POSTHOG_KEY not set. All calls will be no-ops.');
    }
    return;
  }

  const currentPath = window.location.pathname;
  const isReplayPath = REPLAY_PATHS.some(p => currentPath.startsWith(p));

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,

    loaded: (ph) => {
      if (IS_DEV) {
        ph.debug();
        console.log('[Analytics] PostHog initialized in debug mode');
      }
    },

    // Session replay config — 10% sampling on replay paths only
    session_recording: {
      maskAllInputs: true,      // PII protection — always mask inputs
      maskAllText: false,        // Keep text visible for UX analysis
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    enable_recording_console_log: false as any,  // no console log capture
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    capture_performance: false as any,            // no network capture

    // Replay disabled by default; updateReplayForPath() enables it on matching routes
    disable_session_recording: !isReplayPath,
    session_recording_sample_rate: isReplayPath ? 0.1 : 0,

    // Targeted events only — no autocapture to stay under 40-event budget
    autocapture: false,

    // Manual page_viewed fired by RouteTracker in App.tsx — no automatic pageviews
    capture_pageview: false,

    persistence: 'localStorage+cookie',
  });
}

// ============================================================================
// Standard property envelope
// ============================================================================

/**
 * Properties auto-attached to every event capture.
 * Provides consistent join keys for warehouse queries.
 */
function getStandardProps(): Record<string, string | undefined> {
  const params = new URLSearchParams(window.location.search);
  return {
    page_path: window.location.pathname,
    referrer: document.referrer || undefined,
    utm_source: params.get('utm_source') ?? undefined,
    utm_medium: params.get('utm_medium') ?? undefined,
    utm_campaign: params.get('utm_campaign') ?? undefined,
    environment: IS_DEV ? 'development' : 'production',
    app_surface: window.location.pathname.startsWith('/dashboard') ? 'app' : 'marketing',
  };
}

// ============================================================================
// Deduplication guard
// ============================================================================

const _recentEvents = new Map<string, number>();

/**
 * Returns true if the same dedupKey was seen within windowMs.
 * Used to prevent double-fires on events that could fire on re-renders.
 */
function isDuplicate(dedupKey: string, windowMs = 5000): boolean {
  const last = _recentEvents.get(dedupKey);
  if (last !== undefined && Date.now() - last < windowMs) return true;
  _recentEvents.set(dedupKey, Date.now());
  return false;
}

// ============================================================================
// Core API
// ============================================================================

/**
 * Capture a custom event. All calls go through here.
 *
 * @example
 * capture('cta_clicked', { cta_location: 'hero', cta_text: 'Get Started', destination: '/start' });
 */
export function capture(
  event: string,
  props?: Record<string, unknown>,
  options?: { dedupKey?: string; dedupWindowMs?: number }
): void {
  if (!POSTHOG_KEY) return;

  if (options?.dedupKey && isDuplicate(options.dedupKey, options.dedupWindowMs)) {
    if (IS_DEV) console.log(`[Analytics] Deduped event: ${event} (key: ${options.dedupKey})`);
    return;
  }

  posthog.capture(event, { ...getStandardProps(), ...props });
}

/**
 * Identify a user. Call this at two points in the identity lifecycle:
 *
 * 1. First identify: on Start.tsx form submit with lead_id (pending_signup_id)
 *    identify(leadId, { email }, { first_seen_at, signup_source, first_utm_source, ... })
 *
 * 2. Re-identify: after Supabase auth (MagicCallback/AuthCallback) with supabase_user_id
 *    identify(userId, { plan_key, billing_status, account_id, last_active_at })
 *
 * $set_once properties (never overwritten after first set):
 *   first_seen_at, signup_source, first_utm_source, first_utm_campaign, first_page_path
 *
 * $set properties (updated on re-identify):
 *   plan_key, billing_status, account_id, last_active_at
 */
export function identify(
  userId: string,
  setProps?: Record<string, unknown>,
  setOnceProps?: Record<string, unknown>
): void {
  if (!POSTHOG_KEY) return;
  posthog.identify(userId, setProps, setOnceProps);
}

/**
 * Associate a user with a group (account).
 * Call on login if multi-user accounts are active.
 *
 * @example
 * group('account', accountId, { plan_key: 'core' });
 */
export function group(
  groupType: string,
  groupKey: string,
  groupProps?: Record<string, unknown>
): void {
  if (!POSTHOG_KEY) return;
  posthog.group(groupType, groupKey, groupProps);
}

/**
 * Reset PostHog identity. Call ONLY on user signout — never on navigation.
 */
export function resetAnalytics(): void {
  if (!POSTHOG_KEY) return;
  posthog.reset();
}

// ============================================================================
// Session replay path management
// ============================================================================

/**
 * Enable or disable session replay based on the current route.
 * Called by RouteTracker in App.tsx on every route change.
 *
 * Replay enabled (10% sampling): /start, /onboarding-chat, /activation
 * Replay disabled: all other paths
 */
export function updateReplayForPath(path: string): void {
  if (!POSTHOG_KEY) return;
  const shouldEnable = REPLAY_PATHS.some(p => path.startsWith(p));
  if (shouldEnable) {
    posthog.startSessionRecording();
  } else {
    posthog.stopSessionRecording();
  }
}

// ============================================================================
// Feature flags
// ============================================================================

/**
 * Get a PostHog feature flag value (server-evaluated).
 * Returns undefined if PostHog is not initialized.
 *
 * Inactive Phase 1 flag stubs (require PostHog UI to activate):
 *   - 'hero-headline-test'
 *   - 'pricing-layout-test'
 *   - 'onboarding-flow-test'
 *
 * Naming convention: kebab-case, [surface]-[element]-[test/rollout]
 *
 * @example
 * const variant = getFeatureFlag('hero-headline-test');
 */
export function getFeatureFlag(flagKey: string): string | boolean | undefined {
  if (!POSTHOG_KEY) return undefined;
  return posthog.getFeatureFlag(flagKey);
}

/**
 * React hook for PostHog feature flags.
 * Returns the flag value (re-evaluates when flags are refreshed).
 *
 * @example
 * const variant = useFeatureFlag('pricing-layout-test');
 * if (variant === 'compact') return <CompactPricing />;
 */
export function useFeatureFlag(flagKey: string): string | boolean | undefined {
  if (!POSTHOG_KEY) return undefined;

  // posthog.getFeatureFlag is synchronous after flags load; no state needed
  // for more complex cases (flag loading state), wrap in usePostHog from posthog-js/react
  return posthog.getFeatureFlag(flagKey);
}

// ============================================================================
// RouteTracker hook (used in App.tsx)
// ============================================================================

/**
 * Hook for tracking route changes. Used by the RouteTracker component in App.tsx.
 * Fires page_viewed on each unique route change and updates replay config.
 *
 * Deduplicated: same path fires only once (prevents double-fire on React StrictMode remounts).
 */
export function useRouteTracking(pathname: string): void {
  const prevPath = useRef<string | null>(null);

  useEffect(() => {
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;

    // Update session replay first (so it's accurate for the new page)
    updateReplayForPath(pathname);

    // Fire page_viewed — central pageview tracking
    capture('page_viewed', {
      page_title: document.title,
      page_path: pathname,
    });
  }, [pathname]);
}

// ============================================================================
// Raw posthog instance (for advanced use cases only)
// ============================================================================

/**
 * Direct access to the posthog instance.
 * Prefer the wrapper functions above. Use this only for advanced cases
 * (e.g., $set_once properties in identify, or posthog.onFeatureFlags callback).
 */
export { posthog };
