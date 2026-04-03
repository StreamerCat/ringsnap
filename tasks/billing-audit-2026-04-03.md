# RingSnap Billing Audit — 2026-04-03

## Scope
End-to-end billing flow: Stripe customer creation → subscription lifecycle → webhook handling → plan mapping → usage counters → trial-to-paid conversion → grandfathered flags.

---

## Issue Summary

### CRITICAL — C1: Call-based overage calls never billed to Stripe (revenue leak)

**File:** `supabase/functions/stripe-webhook/index.ts` lines 1020–1100  
**Event:** `invoice.upcoming`

The handler selects only `overage_minutes_current_period` and reports it to the metered subscription item. For accounts on **call-based billing** (`billing_call_based = true`), the relevant counter is `overage_calls_current_period`; the minute counter stays at 0 for these accounts. Net effect: **every call-based account with overage calls never gets billed for them**.

```typescript
// BUG: Only queries minute-based overage
.select('id, overage_minutes_current_period, stripe_overage_item_id, plan_key')

// BUG: Only reports minute-based overage to Stripe
if (overageMinutes > 0 && account.stripe_overage_item_id) {
  await stripe.subscriptionItems.createUsageRecord(
    account.stripe_overage_item_id,
    { quantity: overageMinutes, action: 'set' }   // ← always 0 for call-based
  );
}
```

**Production risk:** HIGH — direct revenue loss for any call-based account that exceeds included calls.  
**Fix:** Also select `overage_calls_current_period` and `billing_call_based`; for call-based accounts report `overage_calls_current_period` instead.

---

### HIGH — H1: `subscription_status === 'trial'` mismatch (Stripe stores `'trialing'`)

**Files:**
- `supabase/functions/authorize-call/index.ts` line 198
- `supabase/functions/sync-usage/index.ts` line 88
- `supabase/functions/vapi-webhook/index.ts` line 861 (writeBillingLedgerForCall)

All three check:
```typescript
const isTrial = account.trial_active === true || account.subscription_status === 'trial';
```

Stripe's canonical status for a subscription in its trial period is `'trialing'`, not `'trial'`. The `customer.subscription.created/updated` webhook handler stores `subscription.status` verbatim (line 808). So `subscription_status` in the DB will be `'trialing'`, and the `=== 'trial'` branch **never matches**.

The only guard that actually works is `trial_active === true`. If that flag is wrong (see H2 below), there is **no fallback** and trial limits are silently bypassed.

**Production risk:** HIGH — trial enforcement depends entirely on `trial_active` being set; the `subscription_status` safety-net is broken.  
**Fix:** Change `=== 'trial'` → `=== 'trial' || account.subscription_status === 'trialing'` in all three locations.

---

### HIGH — H2: `checkout.session.completed` unconditionally sets `subscription_status: 'active'`

**File:** `supabase/functions/stripe-webhook/index.ts` lines 957–963

```typescript
const updateData: Record<string, unknown> = {
  plan_key: planKey || 'night_weekend',
  subscription_status: 'active',   // ← hardcoded
  account_status: 'active',
  trial_active: false,              // ← hardcoded
};
```

When a user completes Stripe Checkout for a new subscription, Stripe fires two events:
1. `customer.subscription.created` (status = `'trialing'` because `trial_period_days: 3`)
2. `checkout.session.completed`

Event delivery order is **not guaranteed**. If `checkout.session.completed` is processed last, it overwrites the correct `'trialing'` state with `'active'` **and** sets `trial_active: false`. Combined with H1, this means trial call limits are completely unenforced.

**Production risk:** HIGH — new subscribers bypass 15-call trial limit and are marked as active paying customers while still in trial.  
**Fix:** In `checkout.session.completed`, only set `trial_active: false` and `subscription_status: 'active'` if the retrieved Stripe subscription is NOT in `trialing` status. Use the already-fetched `sub.status` (line 938) as the authoritative source.

---

### MEDIUM — M1: 3-day free trial applied to re-subscriptions in checkout flow

**File:** `supabase/functions/create-upgrade-checkout/index.ts` lines 252–253

```typescript
subscription_data: {
  trial_period_days: 3,   // applied to ALL new checkout sessions
  ...
},
```

If a previous paying customer cancels and later re-subscribes through the checkout path (their `stripe_subscription_id` was canceled so the direct-update path is skipped), they receive another 3-day free trial.

**Production risk:** MEDIUM — customers can game a second (or more) free trials.  
**Fix:** Check the Stripe customer's subscription history before applying `trial_period_days`. Only add it if this is a genuine first subscription.

---

### MEDIUM — M2: Account credits not deducted from Stripe invoices

**File:** `supabase/functions/stripe-webhook/index.ts` lines 590–613

Account credits are marked `status: 'applied'` in the DB when `invoice.payment_succeeded` fires, but no corresponding Stripe credit note or proration is created. The customer was already charged the full invoice amount before this code runs. Credits are visible in the UI but never actually reduce charges.

**Production risk:** MEDIUM — customer-facing credits are purely cosmetic; no real billing reduction.  
**Fix:** Apply credits as Stripe invoice items or customer balance adjustments **before** the invoice is finalized (use `invoice.created` or `invoice.upcoming`), not after payment.

---

### LOW — L1: Webhook signature comparison is not constant-time

**File:** `supabase/functions/stripe-webhook/index.ts` lines 450–455

```typescript
for (const sig of signaturesV1) {
  if (sig === expectedSignature) {  // JS string equality — not constant-time
```

Stripe's official SDK uses a constant-time comparison to prevent timing oracle attacks.

**Production risk:** LOW — difficult to exploit in practice over TLS with variable network latency.  
**Fix:** Use `crypto.subtle.timingSafeEqual` (available in Deno) or convert to `Uint8Array` comparison.

---

## End-to-End Flow Map (Annotated)

```
Signup:
  create-trial / finalize-trial
    → Stripe: createCustomer (idempotent key)
    → Stripe: createSubscription (3-day trial)  ← M1 risk if re-subscriber
    → DB: accounts row (trial_active=true, subscription_status=pending)
    → provisioning job enqueued

Stripe Webhook Events:
  customer.subscription.created
    → DB: subscription_status = 'trialing'      ← correct Stripe value
  checkout.session.completed
    → DB: subscription_status = 'active'        ← H2: overwrites 'trialing'
         trial_active = false                   ← H2: clears trial gate
  customer.subscription.updated (trialing→active after 3 days)
    → DB: subscription_status = 'active'
         trial_active = false (NOT set here)    ← H1: trial_active not cleared on real conversion!
  invoice.payment_succeeded
    → DB: account credits applied               ← M2: cosmetic only
  invoice.upcoming
    → Stripe: report overage_minutes            ← C1: call-based overage ignored
    → DB: reset period counters

Per-Call:
  authorize-call (pre-call gate)
    → isTrial check: trial_active OR === 'trial' ← H1: 'trialing' never matches
    → call-based limits enforced
  vapi-webhook (post-call)
    → writeBillingLedgerForCall
    → classifyCall (live/verification/excluded)
    → writeBillingLedgerEntry (idempotent)
    → increment_calls_used RPC (atomic)
    → increment_trial_live_calls RPC (if trial)
```

---

## Affected Files Summary

| File | Issues |
|------|--------|
| `supabase/functions/stripe-webhook/index.ts` | C1, H2, M2, L1 |
| `supabase/functions/authorize-call/index.ts` | H1 |
| `supabase/functions/sync-usage/index.ts` | H1 |
| `supabase/functions/vapi-webhook/index.ts` | H1 (writeBillingLedgerForCall) |
| `supabase/functions/create-upgrade-checkout/index.ts` | M1 |

---

## Manual Verification Checklist

### C1 — Call-based overage billing
- [ ] Find a call-based account with `overage_calls_current_period > 0`
- [ ] Confirm `overage_minutes_current_period = 0` for same account
- [ ] Trigger `invoice.upcoming` (or replay from Stripe dashboard) and check Stripe metered usage record
- [ ] Verify the reported quantity equals `overage_calls_current_period` after the fix

### H1 — Trial status mismatch
- [ ] Find a trial account; confirm `subscription_status = 'trialing'` in DB
- [ ] Confirm `trial_active = true` is set; this is the only working guard before the fix
- [ ] After fix: manually set `trial_active = false` on a trial account and verify `authorize-call` still rejects calls based on `subscription_status = 'trialing'`

### H2 — Checkout session status race
- [ ] Create a test checkout session; in Stripe webhook logs check order of `customer.subscription.created` vs `checkout.session.completed`
- [ ] Confirm `trial_active` is `true` and `subscription_status = 'trialing'` after both events process
- [ ] After fix: confirm `checkout.session.completed` preserves `trialing` status when Stripe sub is in trial

### M1 — Re-subscription trial
- [ ] Cancel an active subscription; re-subscribe via checkout; verify no 3-day trial is applied

### M2 — Credits
- [ ] Create an `account_credits` row; trigger an invoice; verify the customer sees a reduced charge (currently will not work)

---

## Minimum Production-Safe Fixes (implemented)

1. **C1**: `stripe-webhook/invoice.upcoming` — add `billing_call_based` and `overage_calls_current_period` to the DB select; choose the right counter before calling `createUsageRecord`.
2. **H1**: Add `'trialing'` to the `isTrial` check in `authorize-call`, `sync-usage`, and `vapi-webhook` (writeBillingLedgerForCall).
3. **H2**: In `checkout.session.completed`, only write `subscription_status: 'active'` / `trial_active: false` if the retrieved Stripe subscription status is not `'trialing'`.
