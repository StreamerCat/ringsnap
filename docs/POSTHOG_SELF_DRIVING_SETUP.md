# PostHog Self-Driving Setup Guide

## Overview

This guide walks you through setting up PostHog's self-driving experiments and surveys in RingSnap. Self-driving enables autonomous A/B testing, feature flags, and in-app surveys without manual intervention.

**What was just added:**
- `@posthog/react` v1.3.0 — React hooks for experiments and surveys
- `@posthog/surveys` v2.0.0 — In-app survey capabilities
- Enhanced `analytics.ts` with self-driving methods
- Survey and experiment variant evaluation functions
- Updated `.env.example` with clear PostHog configuration

---

## Installation

All dependencies are already in `package.json`. Just run:

```bash
npm install
```

This installs:
- `posthog-js` (already present)
- `@posthog/react` (new)
- `@posthog/surveys` (new)

---

## Configuration

### 1. Get Your PostHog API Key

1. Go to [PostHog.com](https://posthog.com)
2. Log in or create an account
3. Navigate to **Settings → Project → API Key**
4. Copy your `phc_...` key

### 2. Add to Environment Variables

In your `.env` file (create from `.env.example`):

```dotenv
# Frontend PostHog initialization
VITE_POSTHOG_KEY="phc_your_actual_key_here"
VITE_POSTHOG_HOST="https://us.i.posthog.com"

# Optional: Server-side key for Edge Functions
POSTHOG_API_KEY="phx_your_server_side_key_here"
```

### 3. Verify Initialization

Open your browser console and you should see:

```
[Analytics] PostHog initialized in debug mode
```

If you see this, PostHog is ready to track events, serve flags, and display surveys.

---

## Using Feature Flags (Self-Driving Experiments)

Feature flags are the core mechanism for self-driving experiments. PostHog evaluates them server-side based on user properties and your targeting rules.

### Create a Flag in PostHog

1. Go to **Experiments → Feature Flags**
2. Click **New feature flag**
3. Give it a name: `pricing-layout-test`
4. Add variants:
   - **Control** (50%)
   - **Compact** (25%)
   - **Standard** (25%)
5. Set targeting: Apply to all users (or segment by plan, region, etc.)
6. Save and release

### Use the Flag in Code

```typescript
import { useFeatureFlag } from './lib/analytics';

export function PricingPage() {
  const variant = useFeatureFlag('pricing-layout-test');

  if (variant === 'compact') {
    return <CompactPricingLayout />;
  }
  
  if (variant === 'standard') {
    return <StandardPricingLayout />;
  }

  // Control variant (default)
  return <DefaultPricingLayout />;
}
```

### Naming Convention

Use kebab-case with the pattern: `[surface]-[element]-[test/rollout]`

Examples:
- `hero-headline-test` — A/B test for hero section headline
- `pricing-cta-rollout` — Gradual rollout of new CTA
- `dashboard-sidebar-test` — Dashboard sidebar variant test
- `onboarding-flow-test` — Complete onboarding flow experiment

---

## Tracking Events for Experiment Analysis

PostHog automatically tracks `$pageview` and `$pageleave`. For custom events tied to experiments, use:

```typescript
import { capture } from './lib/analytics';

// Track when user completes a step
capture('onboarding_step_completed', {
  step: 'email_verification',
  variant: 'compact', // Link to experiment variant
  duration_seconds: 45,
});

// Track conversion
capture('trial_signup', {
  plan_key: 'core',
  source_channel: 'organic',
});
```

All events automatically include:
- `page_path` — Current URL path
- `utm_source`, `utm_medium`, `utm_campaign` — UTM tracking
- `environment` — 'development' or 'production'
- `app_surface` — 'app' or 'marketing'

---

## Using Surveys (In-App Messaging)

Surveys are automatically shown based on PostHog's targeting rules. You can also manually trigger them.

### Create a Survey in PostHog

1. Go to **Surveys**
2. Click **New survey**
3. Choose type: **Open text**, **Rating**, **Single choice**, or **Multiple choice**
4. Set targeting and scheduling
5. Save and launch

### Manually Show a Survey

```typescript
import { showSurvey, closeSurveys } from './lib/analytics';

// Show a specific survey by ID (find in PostHog Surveys list)
showSurvey('survey-7c9c2e2d');

// Close all open surveys
closeSurveys();
```

### Auto-Show Surveys

PostHog automatically shows surveys based on:
- Page URL patterns
- User properties (plan, signup date, etc.)
- Events (e.g., after 3rd pageleave)
- Time on page

Configure these in PostHog **Surveys → [Your Survey] → Targeting & Scheduling**.

---

## User Identification & Segmentation

For experiments to work effectively, identify users with properties that enable targeting.

### On Lead Generation (Pre-Signup)

```typescript
import { identify } from './lib/analytics';

// After lead form submission
identify(leadId, 
  { email: user.email },  // $set properties
  {
    first_seen_at: new Date().toISOString(),
    signup_source: 'cta_hero',
    first_utm_source: 'organic',
    first_utm_campaign: 'spring-2025',
  }  // $set_once properties
);
```

### On Login (Post-Auth)

```typescript
import { identify, group } from './lib/analytics';

// After Supabase auth
identify(userId,
  {
    plan_key: 'core',
    billing_status: 'active',
    account_id: accountId,
    last_active_at: new Date().toISOString(),
  }
);

// Associate with account/organization
group('account', accountId, {
  plan_key: 'core',
  billing_cycle: 'monthly',
  mrr: 29,
});
```

### Logout

```typescript
import { resetAnalytics } from './lib/analytics';

resetAnalytics(); // Clears user identity
```

---

## Monitoring Experiment Results

### In PostHog Dashboard

1. Go to **Experiments → Feature Flags → [Your Flag]**
2. View real-time stats:
   - Sample size per variant
   - Conversion rate by variant
   - Statistical significance
3. Use **Trends** to compare custom events by variant

### Key Metrics to Track

For pricing experiments:
- `trial_signup` — conversion to trial
- `payment_added` — payment method added
- `subscription_activated` — subscription created

For onboarding experiments:
- `onboarding_step_completed` — funnel progression
- `first_recording_created` — core feature adoption
- `dashboard_accessed` — app engagement

---

## Cost Management

Your setup follows these cost guardrails:

| Setting | Value | Reason |
|---------|-------|--------|
| **Autocapture** | Off | Saves event budget; targeted events only |
| **Session Replay** | 100% sampling (all users) | Critical for signup/onboarding UX analysis |
| **Network Capture** | Enabled | API error tracking |
| **Console Logs** | Disabled | Avoids logging PII outside dev guards |
| **Performance Capture** | Enabled | Core Web Vitals tracking |

**Estimated monthly cost:** $0–50 depending on traffic volume and custom events.

---

## Common Patterns

### A/B Test a Marketing Headline

```typescript
// components/HeroSection.tsx
import { useFeatureFlag } from '@/lib/analytics';

export function HeroSection() {
  const variant = useFeatureFlag('hero-headline-test');

  const headline = variant === 'variant-b' 
    ? 'AI Voice Scheduling for Teams'
    : 'Record Meetings, Not Transcripts';

  return (
    <section>
      <h1>{headline}</h1>
      <CTA />
    </section>
  );
}
```

### Gradual Feature Rollout

```typescript
// components/Dashboard.tsx
import { useFeatureFlag } from '@/lib/analytics';

export function Dashboard() {
  const newSidebarEnabled = useFeatureFlag('dashboard-sidebar-rollout');

  if (newSidebarEnabled) {
    return <DashboardWithNewSidebar />;
  }
  return <DashboardLegacy />;
}
```

### Survey on Trial Expiration

```typescript
// pages/TrialExpiring.tsx
import { useEffect } from 'react';
import { showSurvey } from '@/lib/analytics';

export function TrialExpiringPage() {
  useEffect(() => {
    // Show "Why did you cancel?" survey after 2 seconds
    const timer = setTimeout(
      () => showSurvey('survey-churn-reason'),
      2000
    );
    return () => clearTimeout(timer);
  }, []);

  return <TrialExpirationMessage />;
}
```

---

## Troubleshooting

### PostHog not initializing

**Check:**
1. `VITE_POSTHOG_KEY` is set in `.env` (not `.env.example`)
2. PostHog host is reachable: `https://us.i.posthog.com`
3. No errors in browser console

**Fix:**
```bash
# Verify env is loaded
echo $VITE_POSTHOG_KEY

# Restart dev server
npm run dev
```

### Feature flags not evaluating

**Check:**
1. Flag exists and is "released" in PostHog
2. Flag is targeting the right user segment
3. User is identified (check PostHog person profile)

**Debug:**
```typescript
import { posthog } from '@/lib/analytics';

// Log all flags
posthog.onFeatureFlags(() => {
  console.log('All flags:', posthog.getFeatureFlags());
});
```

### Surveys not showing

**Check:**
1. Survey is "active" in PostHog
2. Targeting conditions match current user
3. Browser DevTools → Network → filter `surveys`

**Manual trigger:**
```typescript
import { showSurvey } from '@/lib/analytics';
showSurvey('your-survey-id');
```

---

## Next Steps

1. **Set your PostHog API key** in `.env`
2. **Create your first feature flag** in PostHog
3. **Wrap a component** with `useFeatureFlag()` to test
4. **Monitor results** in PostHog dashboard
5. **Iterate** based on data

For detailed PostHog docs, see: https://posthog.com/docs

---

## Quick Reference

| Function | Purpose | Example |
|----------|---------|---------|
| `initAnalytics()` | Initialize PostHog (called in main.tsx) | `initAnalytics()` |
| `useFeatureFlag(key)` | Get flag value in component | `const v = useFeatureFlag('test-flag')` |
| `getFeatureFlag(key)` | Get flag value outside React | `posthog.getFeatureFlag('test-flag')` |
| `capture(event, props)` | Track custom event | `capture('signup', { plan: 'core' })` |
| `identify(userId, props)` | Identify user with properties | `identify(uid, { plan: 'core' })` |
| `group(type, key, props)` | Associate user with group | `group('account', accId, { plan })` |
| `showSurvey(id)` | Manually trigger survey | `showSurvey('survey-123')` |
| `closeSurveys()` | Close all open surveys | `closeSurveys()` |
| `resetAnalytics()` | Clear identity on logout | `resetAnalytics()` |

---

## Files Modified

- **package.json** — Added `@posthog/react` and `@posthog/surveys`
- **src/lib/analytics.ts** — Enhanced with self-driving methods
- **.env.example** — Updated with configuration guidance

All changes maintain backward compatibility. Existing `posthog-js` setup continues to work unchanged.
