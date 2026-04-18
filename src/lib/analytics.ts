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
 *   - (manual page_viewed via RouteTracker in App.tsx)
 *   - Session replay: 10% sampling only on /start, /onboarding-chat, /activation (decided once at init)
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

export const IS_DEV = import.meta.env.DEV;
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com';

/**
 * Paths where session replay is enabled (10% sampling).
 * All other paths: replay explicitly disabled.
 */
const REPLAY_PATHS = ['/start', '/onboarding-chat', '/onboarding', '/activation'];
const REPLAY_SAMPLE_RATE = 0.1;


function safePostHogCall(action: string, fn: () => void): void {
  try {
    fn();
  } catch (error) {
    if (IS_DEV) {
      console.warn(`[Analytics] PostHog ${action} skipped due to runtime error`, error);
    }
  }
}

function safePostHogGet<T>(action: string, fn: () => T): T | undefined {
  try {
    return fn();
  } catch (error) {
    if (IS_DEV) {
      console.warn(`[Analytics] PostHog ${action} skipped due to runtime error`, error);
    }
    return undefined;
  }
}


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

  safePostHogCall('init', () => posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,

    loaded: (ph) => {
      if (IS_DEV) {
        ph.debug();
        console.log('[Analytics] PostHog initialized in debug mode');
      }
    },

    // Session replay config — keep cost throttle intact: 10% sampling on replay paths only
    session_recording: {
      maskAllInputs: true,      // PII protection — always mask inputs
      maskAllText: false,        // Keep text visible for UX analysis
    },
    enable_recording_console_log: false as any,  // no console log capture
    capture_performance: false as any,            // no network capture

    // Replay is decided once at initialization and is not toggled on route changes.
    // This avoids recorder teardown/startup during browser back/forward transitions.
    // Cost control is preserved: non-replay pages are hard-disabled and replay pages stay at 10%.
    disable_session_recording: !isReplayPath,
    session_recording_sample_rate: isReplayPath ? REPLAY_SAMPLE_RATE : 0,

    // Targeted events only — no autocapture to stay under 40-event budget
    autocapture: false,
    capture_pageleave: true,

    // Manual $pageview fired by RouteTracker in App.tsx; automatic $pageleave enabled
    persistence: 'localStorage+cookie',
  }));

  if (typeof window !== 'undefined') {
    (window as Window & { posthog?: typeof posthog }).posthog = posthog;
  }
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

  safePostHogCall('capture', () => posthog.capture(event, { ...getStandardProps(), ...props }));
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
  safePostHogCall('identify', () => posthog.identify(userId, setProps, setOnceProps));
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
  safePostHogCall('group', () => posthog.group(groupType, groupKey, groupProps));
}

/**
 * Reset PostHog identity. Call ONLY on user signout — never on navigation.
 */
export function resetAnalytics(): void {
  if (!POSTHOG_KEY) return;
  safePostHogCall('reset', () => posthog.reset());
}

// ============================================================================
// Session replay path management
// ============================================================================

/**
 * Legacy no-op kept for backward compatibility.
 *
 * Recorder controls are intentionally not called on navigation because route-based
 * stop/start has caused browser security errors during teardown on history changes.
 */
export function updateReplayForPath(path: string): void {
  // intentionally empty
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
  return safePostHogGet('getFeatureFlag', () => posthog.getFeatureFlag(flagKey));
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
  return safePostHogGet('useFeatureFlag', () => posthog.getFeatureFlag(flagKey));
}

// ============================================================================
// RouteTracker hook (used in App.tsx)
// ============================================================================

/**
 * Hook for tracking route changes. Used by the RouteTracker component in App.tsx.
 * Fires page_viewed on each unique route change.
 *
 * Deduplicated: same path fires only once (prevents double-fire on React StrictMode remounts).
 */
export function useRouteTracking(pathname: string): void {
  const prevPath = useRef<string | null>(null);

  useEffect(() => {
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;

    // Fire $pageview — central pageview tracking
    capture('$pageview', { $current_url: window.location.href, pathname: location.pathname, search: location.search });


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
