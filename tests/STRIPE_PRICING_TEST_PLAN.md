# RingSnap Stripe Pricing Overhaul — Comprehensive Test Plan

**Version:** 1.0
**Date:** 2026-03-11
**Branch:** `claude/stripe-pricing-test-plan-Vq3G6`

## Context

RingSnap is migrating from a legacy 3-tier pricing model (Starter, Professional, Premium) to a new
4-tier structure:

| New Plan Key | Name | Price/mo | Included Min | Overage Rate | Coverage |
|---|---|---|---|---|---|
| `night_weekend` | Night & Weekend | $59 | 150 | $0.45/min | After-hours only |
| `lite` | Lite | $129 | 300 | $0.38/min | 24/7 |
| `core` | Core | $229 | 600 | $0.28/min | 24/7 |
| `pro` | Pro | $399 | 1,200 | $0.22/min | 24/7 |

Plans were created programmatically via `scripts/stripe-setup-new-plans.js`. Key concerns:

- New plan keys must map correctly in code (`dashboardPlans.ts`) and Stripe
- Trial signups must default to `night_weekend`
- Legacy key mapping: `starter→lite`, `professional→core`, `premium→pro`, `trial→night_weekend`
- Provisioning must succeed asynchronously (VAPI phone + assistant)
- Overage billing must be reported to Stripe via `invoice.upcoming` webhook
- Cancellation must set a 7-day phone-hold window

---

## Section 1: Summary Risks

### P0 — Launch Blockers

| # | Risk | Root Cause Area | How to Detect |
|---|------|-----------------|---------------|
| R1 | Trial signup creates subscription under wrong plan | `STRIPE_PRICE_ID_NIGHT_WEEKEND` env var not set or pointing to old price | Check Stripe subscription `items[0].price.id` matches env var |
| R2 | Webhook `price→plan_key` mapping fails for new IDs | `stripe-webhook` reads env vars at runtime; env not deployed to edge function | `accounts.plan_key` is NULL or wrong after `checkout.session.completed` |
| R3 | Overage metered item ID not stored | `stripe_overage_item_id` not captured in `checkout.session.completed` handler | `accounts.stripe_overage_item_id` is NULL; `invoice.upcoming` fails silently |
| R4 | Legacy subscribers get wrong `plan_key` after migration | `normalizeLegacyPlanKey()` mapping incorrect | Query `accounts` where `plan_type` is old key and `plan_key` is wrong or NULL |
| R5 | Provisioning stuck in `pending` indefinitely | `provision-vapi` worker not running or `provisioning_jobs` table not polled | `accounts.provisioning_status` stays `pending` > 5 min after signup |
| R6 | Duplicate webhook processing | `stripe_events` dedup not working | Same invoice processed twice; `account_credits` double-applied |
| R7 | Night & Weekend plan answers daytime calls | Coverage-hours restriction not enforced in VAPI | `rejected_daytime_calls` never increments; calls answered 8AM–6PM weekdays |
| R8 | Overage not reported to Stripe on `invoice.upcoming` | `stripe_overage_item_id` NULL or usage record API call fails | Stripe invoice has no usage line; customer charged $0 for overages |
| R9 | Cancellation doesn't set phone hold window | `customer.subscription.deleted` handler doesn't compute `phone_number_held_until` | `phone_number_held_until` is NULL after cancellation |
| R10 | Payment failure doesn't block service | `subscription_status` not set to `past_due` on `invoice.payment_failed` | Service continues after failed payment |

### P1 — High Risks

| # | Risk | Area |
|---|------|------|
| R11 | Account credits applied twice to same invoice | Idempotency gap in credit application logic |
| R12 | Trial minutes limit not enforced (night_weekend: 150 min) | `sync-usage` reads wrong plan minutes |
| R13 | Upgrade from night_weekend doesn't clear `rejected_daytime_calls` | Counter reset missing in `create-upgrade-checkout` |
| R14 | Invoice email sent with wrong plan name (shows old plan) | Email template reads `plan_type` not `plan_key` |
| R15 | Legacy subscribers see "Starter"/"Professional"/"Premium" in UI | `BillingTab` doesn't call `normalizeLegacyPlanKey()` |

---

## Section 2: Test Matrix

### Legend

- **CI** = Automated, runs in CI pipeline
- **Manual** = Manual smoke test, pre-launch
- **Clock** = Requires Stripe Test Clock
- **[Unverified]** = Assumption — verify from repo or Stripe dashboard before treating as fact

---

### Group A: Trial Signup & Default Plan

| ID | Scenario | Steps | Systems to Verify | Assertions | Data to Record | Expected Outcome | Type |
|----|----------|-------|-------------------|------------|----------------|-----------------|------|
| A1 | Happy path: Trial signup defaults to Night & Weekend | POST `create-trial` with valid email, phone, card; no `plan` param | Stripe API, `accounts` table, `stripe_events` table | 1. `accounts.plan_key = 'night_weekend'`<br>2. `accounts.subscription_status = 'trialing'`<br>3. `accounts.trial_active = true`<br>4. Stripe subscription status = `trialing`<br>5. Stripe price ID = `STRIPE_PRICE_ID_NIGHT_WEEKEND` env value<br>6. `stripe_events` has `checkout.session.completed` row with `processed = true` | `accounts.stripe_subscription_id`, `accounts.stripe_customer_id`, Stripe sub ID | Account created on night_weekend plan in trial | CI |
| A2 | Trial signup with explicit `plan = 'lite'` | POST `create-trial` with `plan: 'lite'` | Stripe, `accounts` | 1. `accounts.plan_key = 'lite'`<br>2. Stripe price = `STRIPE_PRICE_ID_LITE` | `accounts.plan_key`, Stripe subscription items | Lite plan subscription created | CI |
| A3 | Trial signup with legacy plan key `plan = 'starter'` | POST `create-trial` with `plan: 'starter'` | Stripe, `accounts` | 1. `normalizeLegacyPlanKey` maps `starter→lite`<br>2. `accounts.plan_key = 'lite'` | `accounts.plan_key` | Legacy key normalized correctly | CI |
| A4 | Trial signup with legacy key `plan = 'trial'` | POST `create-trial` with `plan: 'trial'` | Stripe, `accounts` | 1. `normalizeLegacyPlanKey` maps `trial→night_weekend`<br>2. `accounts.plan_key = 'night_weekend'` | `accounts.plan_key` | Defaults to night_weekend | CI |
| A5 | Duplicate signup — idempotency key reuse | POST `create-trial` twice with same idempotency key | Stripe, `accounts` | 1. Only ONE Stripe customer created<br>2. Only ONE `accounts` row<br>3. Second call returns cached success response | Count of `stripe_customer_id` occurrences | Idempotent — no duplicates | CI |
| A6 | Signup with disposable email | POST `create-trial` with known disposable domain | Anti-abuse check | HTTP 400 returned; no Stripe customer created; no `accounts` row | Error code in response | Rejected by anti-abuse filter | CI |
| A7 | Payment method decline during signup | POST `create-trial` with Stripe test card `4000000000000002` | Stripe, `accounts` | 1. HTTP error returned<br>2. Stripe subscription rolled back<br>3. Stripe customer deleted<br>4. No `accounts` row created | Stripe customer list (should not exist) | Compensation logic fires; no orphaned data | Manual |

---

### Group B: Provisioning After Signup

| ID | Scenario | Steps | Systems to Verify | Assertions | Data to Record | Expected Outcome | Type |
|----|----------|-------|-------------------|------------|----------------|-----------------|------|
| B1 | Provisioning completes successfully | After A1 signup, wait up to 5 min | `accounts.provisioning_status`, VAPI dashboard, `provisioning_jobs` table | 1. `accounts.provisioning_status = 'completed'`<br>2. `accounts.vapi_phone_number` is non-NULL<br>3. VAPI assistant exists in VAPI dashboard for account | `vapi_phone_number`, VAPI assistant ID | Phone number assigned, assistant provisioned | Manual |
| B2 | Provisioning status transitions | After A1, poll `accounts.provisioning_status` at t=0, t=30s, t=60s, t=300s | `accounts` table | Status: `pending` → `processing` → `completed` | Timestamps of each status transition | Status moves through pipeline without hanging | Manual |
| B3 | Provisioning failure and retry | [Unverified: simulate VAPI failure by temporarily revoking VAPI key] | `provisioning_jobs`, `accounts.provisioning_status` | 1. `accounts.provisioning_status = 'failed'` after max retries<br>2. `provisioning_jobs` shows retry count > 0 | Retry count, final status | Failure recorded; no infinite retry loop | Manual |
| B4 | Sales-sourced provisioning (`source = 'sales'`) | Call `provision-account` with `source: 'sales'` | `accounts`, Stripe | Same as B1 plus: Stripe customer/sub created if not existing | Stripe customer ID | Sales path provisions correctly | Manual |

---

### Group C: Webhook Processing & Idempotency

| ID | Scenario | Steps | Systems to Verify | Assertions | Data to Record | Expected Outcome | Type |
|----|----------|-------|-------------------|------------|----------------|-----------------|------|
| C1 | `checkout.session.completed` — all fields populated | Trigger via trial signup or Stripe CLI: `stripe trigger checkout.session.completed` | `accounts`, `stripe_events` | 1. `stripe_events` row with `processed = true`<br>2. `accounts.stripe_overage_item_id` non-NULL<br>3. `accounts.trial_start_date` and `trial_end_date` set<br>4. `accounts.current_period_start` / `current_period_end` set | All 4 `accounts` fields | All fields written correctly | CI |
| C2 | `customer.subscription.created` — plan_key mapping for all 4 plans | Trigger subscription creation once per plan | `accounts`, `stripe_events` | For each plan: `accounts.plan_key` matches expected value (`night_weekend`, `lite`, `core`, `pro`) | `plan_key` per plan | Correct `plan_key` for all 4 plans | CI |
| C3 | `customer.subscription.updated` — status sync | Manually update subscription status in Stripe test dashboard | `accounts` | `accounts.subscription_status` mirrors Stripe status within 30s | `subscription_status` before/after | Status synced correctly | Manual |
| C4 | `invoice.payment_succeeded` — receipt email and referral credits | Trigger payment success | Email inbox, `stripe_events` | 1. Invoice email sent to primary profile email<br>2. `stripe_events` row marked processed<br>3. If referral: referrer credited $50, referee credited $25 | Email delivery timestamp, credit amounts | Email sent; referral credits applied | Manual |
| C5 | `invoice.payment_failed` — `past_due` set | Attach Stripe test card `4000000000000341` to existing subscription | `accounts`, `stripe_events` | 1. `accounts.subscription_status = 'past_due'`<br>2. `accounts.unpaid_since` is non-NULL | `subscription_status`, `unpaid_since` | Account marked past_due | Manual |
| C6 | `customer.subscription.deleted` — cancellation state | Cancel subscription via Stripe dashboard | `accounts`, `stripe_events` | 1. `accounts.account_status = 'cancelled'`<br>2. `accounts.subscription_status = 'cancelled'`<br>3. `accounts.phone_number_held_until` = billing period end + 7 days | `phone_number_held_until` timestamp | 7-day hold window set correctly | Manual |
| C7 | `invoice.upcoming` — overage reported to Stripe | Advance Test Clock to 7 days before renewal; inject overage via `sync-usage` | Stripe usage records, `accounts` | 1. `stripe.subscriptionItems.createUsageRecord()` called with correct quantity<br>2. Stripe usage record quantity = `accounts.overage_minutes_current_period`<br>3. Counter reset to 0 after | Stripe usage record quantity, `overage_minutes_current_period` before/after | Overage reported; counter reset | Clock |
| C8 | Duplicate webhook delivery — idempotency | Send same Stripe event ID twice to webhook endpoint | `stripe_events`, `accounts` | 1. Second delivery returns 200<br>2. Only ONE `stripe_events` row for that event_id<br>3. Account updated only once | `stripe_events` row count for event_id | Idempotent — duplicate ignored | CI |
| C9 | Webhook signature verification | Send POST with invalid Stripe signature | Webhook response | HTTP 400 returned; no `stripe_events` row created | HTTP status code | Rejected — no processing | CI |
| C10 | `invoice.payment_succeeded` — clears `unpaid_since` | Pay failed invoice after C5 | `accounts` | `accounts.unpaid_since = NULL`; `accounts.subscription_status = 'active'` | `unpaid_since`, `subscription_status` | Account reactivated | Manual |

---

### Group D: Billing Cycle, Renewal & Trial Conversion (Stripe Test Clock)

| ID | Scenario | Steps | Systems to Verify | Assertions | Data to Record | Expected Outcome | Type |
|----|----------|-------|-------------------|------------|----------------|-----------------|------|
| D1 | Trial → paid conversion (Night & Weekend) | 1. Create account via A1<br>2. Create Stripe Test Clock<br>3. Advance clock past `trial_end_date` | Stripe invoice, `accounts`, email | 1. Stripe invoice = $59.00<br>2. Invoice paid automatically<br>3. `accounts.subscription_status = 'active'`<br>4. `accounts.trial_active = false`<br>5. Receipt email sent | Invoice amount, subscription status | Trial converts; first payment charged correctly | Clock |
| D2 | Overage item survives trial conversion | After D1, inspect subscription | Stripe subscription items | `accounts.stripe_overage_item_id` unchanged; subscription has 2 items (base + metered overage) | Item IDs pre/post conversion | Metered item intact after conversion | Clock |
| D3 | Monthly renewal — no overage | 1. Create paid account<br>2. Advance clock to renewal date with 0 overage minutes | Stripe invoice, `accounts` | 1. Invoice = base plan price only (no usage line items)<br>2. `accounts.minutes_used_current_period` reset to 0 | Invoice line items, `minutes_used_current_period` | Clean renewal at base price | Clock |
| D4 | Monthly renewal — with overage | 1. Create paid account<br>2. Inject overage via `sync-usage`<br>3. Advance to 7 days pre-renewal (triggers `invoice.upcoming`)<br>4. Advance to renewal | Stripe invoice, `accounts`, usage records | 1. Usage record quantity = injected overage minutes<br>2. Invoice total = base + (overage_min × rate)<br>3. `accounts.overage_minutes_current_period` reset to 0 | Invoice total, usage quantity, reset counter | Overage billed at correct per-minute rate | Clock |
| D5 | Trial ends by minutes exhaustion | 1. Create night_weekend trial (150 min limit)<br>2. Inject 151 minutes via `sync-usage` | `accounts`, `usage_alerts` | 1. `accounts.trial_active` updated appropriately [Unverified: verify auto-convert vs block behavior]<br>2. `usage_alerts` row with `alert_type = 'trial_ended_minutes'` | `trial_minutes_used`, alert row | Trial ends at minute limit | Manual |
| D6 | Trial period expires before minutes exhausted | Advance Test Clock past trial end with minutes remaining | `accounts`, Stripe | 1. `usage_alerts` row with `alert_type = 'trial_ended_time'`<br>2. Stripe moves subscription to active | Alert row, `subscription_status` | Time-based trial expiry handled | Clock |

---

### Group E: Usage Tracking & Alerts

| ID | Scenario | Steps | Systems to Verify | Assertions | Data to Record | Expected Outcome | Type |
|----|----------|-------|-------------------|------------|----------------|-----------------|------|
| E1 | Usage alert at 70% | POST `sync-usage` with minutes = 70% of plan limit | `usage_alerts`, email | 1. `usage_alerts` row with `alert_type = '70_pct'`<br>2. Alert email sent<br>3. Second call at same % does NOT create duplicate (JSONB dedup in `alerts_sent`) | Alert row timestamp, email delivered | Alert fires exactly once at 70% | CI |
| E2 | Usage alert at 90% | POST `sync-usage` with minutes = 90% of plan limit | `usage_alerts`, email | Same as E1 with `alert_type = '90_pct'` | Alert row | Alert fires exactly once at 90% | CI |
| E3 | Overage started alert | Push past included minutes | `usage_alerts`, `accounts` | 1. `usage_alerts` row with `alert_type = 'overage_started'`<br>2. `accounts.overage_minutes_current_period` > 0 | Overage counter | Overage alert fires | CI |
| E4 | System ceiling reached (Night & Weekend: 100 overage min) | Push Night & Weekend account past 100 overage minutes | `accounts`, `usage_alerts` | 1. `accounts.ceiling_reject_sent = true`<br>2. `usage_alerts` row with `alert_type = 'ceiling_hit'`<br>3. Further calls rejected | `ceiling_reject_sent`, alert row | Hard ceiling enforced | Manual |
| E5 | Ceiling resets on new billing period | After E4, advance Test Clock to renewal | `accounts` | `accounts.ceiling_reject_sent = false` after `invoice.upcoming` handler fires | `ceiling_reject_sent` | Ceiling flag cleared for new period | Clock |
| E6 | Trial usage alerts use correct alert types | During trial, reach 70% of `trial_minutes_limit` | `usage_alerts` | Alert type is `trial_70_pct` (not the paid `70_pct`) | `alert_type` | Correct alert type for trial context | CI |

---

### Group F: Plan Changes (Upgrade/Downgrade)

| ID | Scenario | Steps | Systems to Verify | Assertions | Data to Record | Expected Outcome | Type |
|----|----------|-------|-------------------|------------|----------------|-----------------|------|
| F1 | In-place upgrade via `stripe-subscription-update` | PATCH plan from `night_weekend` → `lite` | Stripe, `accounts` | 1. Stripe subscription item updated to lite price ID<br>2. Proration invoice created (`proration_behavior: 'always_invoice'`)<br>3. `accounts.plan_key = 'lite'` | New price ID, proration invoice amount | Upgrade succeeds with proration | Manual |
| F2 | Upgrade via `create-upgrade-checkout` (Checkout flow) | POST with new plan key | Stripe, `accounts` | 1. Checkout session created with 2 line items: base + overage<br>2. `accounts.plan_key` updated on `checkout.session.completed` | Checkout session items | Checkout created with both price items | Manual |
| F3 | Upgrade from Night & Weekend clears rejection counter | Upgrade `night_weekend` → `lite` | `accounts` | `accounts.rejected_daytime_calls = 0` after upgrade | Counter before/after | Counter cleared on upgrade | CI |
| F4 | Downgrade [Unverified: check if downgrade is blocked in UI] | PATCH plan from `core` → `lite` | Stripe, `accounts` | 1. Subscription item updated<br>2. Credit note or credit applied (no double-charge) | Stripe subscription status | Downgrade handled per Stripe proration policy | Manual |
| F5 | Legacy subscriber sees correct plan name after migration | Query `accounts` where `plan_type = 'starter'` | `accounts`, UI | 1. `accounts.plan_key = 'lite'` (set by migration backfill)<br>2. BillingTab shows "Lite" not "Starter" | `plan_key` value, UI screenshot | Legacy mapping correct end-to-end | Manual |

---

### Group G: Cancellation Flow

| ID | Scenario | Steps | Systems to Verify | Assertions | Data to Record | Expected Outcome | Type |
|----|----------|-------|-------------------|------------|----------------|-----------------|------|
| G1 | Happy path cancellation from dashboard | Click "Cancel" in BillingTab; confirm dialog | Stripe, `accounts`, `stripe_events` | 1. `cancel-subscription` returns 200<br>2. Stripe subscription status = `canceled`<br>3. `accounts.subscription_status = 'cancelled'`<br>4. `accounts.account_status = 'cancelled'`<br>5. `accounts.phone_number_held_until` = billing period end + 7 days<br>6. Analytics event logged | `phone_number_held_until`, Stripe sub status | Cancellation complete; 7-day hold active | Manual |
| G2 | Reactivation within hold period retains phone number | Cancel (G1), resubscribe within 7 days | Stripe, `accounts` | 1. New subscription created<br>2. `accounts.account_status = 'active'`<br>3. Same phone number retained (not released) | Phone number before/after reactivation | Phone retained on reactivation | Manual |
| G3 | Phone released after hold period expires | Cancel (G1), advance clock past `phone_number_held_until` | VAPI, `accounts` | Phone number released in VAPI; `accounts.vapi_phone_number` cleared [Unverified: verify if automatic cron or manual] | `vapi_phone_number` after clock advance | Phone released after hold | Clock |
| G4 | Cancellation with missing Stripe sub (soft fail) | Cancel when `accounts.stripe_subscription_id` is NULL | `accounts` | 1. Function does not return 500<br>2. `accounts.subscription_status` updated to `cancelled` regardless | HTTP status code | Soft fail — DB updated even without Stripe sub | CI |

---

### Group H: Billing UI Verification

| ID | Scenario | Steps | Systems to Verify | Assertions | Data to Record | Expected Outcome | Type |
|----|----------|-------|-------------------|------------|----------------|-----------------|------|
| H1 | BillingTab renders current plan | Log in as active subscriber; navigate to `/dashboard?tab=billing` | `BillingTab.tsx`, `accounts` | 1. Plan name matches `accounts.plan_key`<br>2. Included minutes correct for plan<br>3. Monthly price correct<br>4. Coverage hours label shown (after-hours vs 24/7) | Plan name, price rendered | Correct plan data displayed | Manual |
| H2 | Trial countdown visible | Log in during active trial | `BillingTab.tsx` | Trial badge and days-remaining counter shown | Badge text | Trial UI state correct | Manual |
| H3 | Minutes usage bar accurate | Log in with known `minutes_used_current_period` value | `BillingTab.tsx` | Usage bar % = `minutes_used / included_minutes × 100` (within ±1%) | Bar percentage vs DB value | Usage bar accurate | Manual |
| H4 | Invoice list renders | Navigate to billing tab with invoices present | `InvoicesList.tsx`, `stripe-invoices-list` | 1. Invoices listed with date, amount, status<br>2. PDF download link present<br>3. Hosted invoice URL present | Invoice count, links present | Invoice list renders correctly | Manual |
| H5 | Invoice list — empty state | New account with no invoices | `InvoicesList.tsx` | "No invoices" message shown (not blank, not crash) | UI state | Empty state renders | Manual |
| H6 | Payment method display | Active subscriber with card on file | `BillingTab.tsx`, `get-billing-summary` | Last 4 digits, card brand, expiration shown correctly | Last 4, brand | Payment method displays | Manual |
| H7 | Upgrade modal shows all 4 plans with correct prices | Click upgrade from `night_weekend` account | Upgrade modal | 4 plan cards: Night & Weekend ($59, 150 min), Lite ($129, 300 min), Core ($229, 600 min), Pro ($399, 1,200 min) | Plan cards rendered | All 4 plans with correct details | Manual |
| H8 | Upgrade modal shows no legacy plan names | Open upgrade modal | Upgrade modal | Text "Starter", "Professional", "Premium" does NOT appear anywhere in modal | Text content scan | No legacy plan names visible | Manual |

---

### Group I: Payment Method Management

| ID | Scenario | Steps | Systems to Verify | Assertions | Data to Record | Expected Outcome | Type |
|----|----------|-------|-------------------|------------|----------------|-----------------|------|
| I1 | Update payment method | Click "Update Payment Method"; enter new test card | Stripe, `accounts`, `stripe-payment-method-default` | 1. New card attached to Stripe customer<br>2. Set as default payment method<br>3. `get-billing-summary` returns new card's last4 | New last4 | Payment method updated | Manual |
| I2 | Setup intent created with correct usage type | Initiate payment method update | `stripe-setup-intent` edge function | Setup intent has `usage: 'off_session'` [Unverified: verify setup intent type in function code] | Setup intent ID | Setup intent ready for off-session use | Manual |

---

### Group J: Stripe Plan Configuration Verification

| ID | Scenario | Steps | Systems to Verify | Assertions | Data to Record | Expected Outcome | Type |
|----|----------|-------|-------------------|------------|----------------|-----------------|------|
| J1 | All 4 base plan prices exist and are active in Stripe | Stripe Dashboard → Products; or `stripe prices list --active` | Stripe Products & Prices | 4 active prices matching env vars `STRIPE_PRICE_ID_{NIGHT_WEEKEND,LITE,CORE,PRO}`; amounts match plan table | Price IDs, amounts | All 4 base prices active | Manual |
| J2 | All 4 overage prices are metered | Stripe Dashboard → Prices for each plan's product | Stripe Prices | 4 metered prices (`billing_scheme = per_unit`, `usage_type = metered`); `aggregate_usage` value confirmed [Unverified: `last_during_period` or `sum`?] | Billing scheme, aggregate_usage | Overage prices are metered correctly | Manual |
| J3 | Legacy prices are archived/inactive | Stripe Dashboard → search old price IDs | Stripe Prices | Old prices for Starter ($297), Professional ($547), Premium ($947) are **inactive** | Price `active` status | Old prices inactive — no accidental use | Manual |
| J4 | `plans` table in Supabase matches Stripe | `SELECT stripe_price_id FROM plans`; verify each against Stripe API | `plans` table, Stripe API | Every `stripe_price_id` in `plans` is active in Stripe; no orphaned IDs | All 8 price IDs compared | DB and Stripe in sync | Manual |
| J5 | All 8 price env vars deployed to edge functions | Supabase Dashboard → Edge Functions → Secrets | Supabase secrets panel | All 8 non-empty: `STRIPE_PRICE_ID_{NIGHT_WEEKEND,LITE,CORE,PRO}` and `STRIPE_OVERAGE_PRICE_ID_{NIGHT_WEEKEND,LITE,CORE,PRO}` | Secret names confirmed | All env vars deployed | Manual |

---

## Section 3: Minimum Go-Live Suite (Top 10 Checks)

These 10 checks must all pass before go-live. Estimated time: under 2 hours.

| Priority | ID | Check | Method | Pass Criteria |
|----------|----|-------|--------|---------------|
| **1** | J5 | All 8 Stripe price env vars set in production edge functions | Supabase Dashboard → Secrets | All 8 non-empty |
| **2** | J1+J2 | All 4 base + 4 overage prices active in Stripe | Stripe Dashboard → Products | 8 prices visible, active, and correctly configured |
| **3** | A1 | Trial signup creates `night_weekend` subscription | Live test signup (Stripe test mode) | `accounts.plan_key = 'night_weekend'`; Stripe sub items match price env var |
| **4** | C1 | `checkout.session.completed` populates `stripe_overage_item_id` | Query `accounts` after A1 | `accounts.stripe_overage_item_id` non-NULL |
| **5** | B1 | Provisioning completes within 5 min | Wait after A1; poll `accounts` | `provisioning_status = 'completed'`; `vapi_phone_number` non-NULL |
| **6** | D1 | Trial → paid conversion charges correct amount ($59) | Stripe Test Clock: advance past trial end | Invoice amount = $59.00; `subscription_status = 'active'` |
| **7** | C7 | Overage reported on `invoice.upcoming` | Test Clock: inject overages; advance to 7 days pre-renewal | Stripe usage record exists with correct quantity |
| **8** | G1 | Cancellation from dashboard sets cancelled status + 7-day hold | Manual dashboard cancel | `account_status = 'cancelled'`; `phone_number_held_until` set |
| **9** | C8 | Duplicate webhook rejected (idempotency) | Send same Stripe event ID twice to webhook URL | Only 1 row in `stripe_events` for that ID; account updated once |
| **10** | H4+H7 | Billing UI: invoice list and 4-plan upgrade modal render | Manual browser test | Invoice list visible; 4 plan cards with correct prices shown |

---

## Section 4: Full Suite (Execution Order)

| Phase | Tests | Focus | Automation | Est. Time |
|-------|-------|-------|-----------|-----------|
| 1 | J1–J5 | Configuration verification | Manual | 30 min |
| 2 | A1–A7, B1–B4 | Signup & provisioning | CI + Manual | 90 min |
| 3 | C1–C10 | Webhook processing & idempotency | CI + Manual | 60 min |
| 4 | D1–D6 | Billing cycle with Test Clock | Clock | 60 min |
| 5 | E1–E6 | Usage tracking & alerts | CI + Manual | 30 min |
| 6 | F1–F5 | Plan changes | Manual | 45 min |
| 7 | G1–G4 | Cancellation flow | Manual + Clock | 30 min |
| 8 | H1–H8 | Billing UI | Manual | 45 min |
| 9 | I1–I2 | Payment method management | Manual | 15 min |

**Total estimated time:** ~7 hours for full suite

---

## Section 5: Common Failure Modes and How to Detect Them

### FM-1: Env Var Not Deployed to Edge Function

**Symptom:** `accounts.plan_key` is NULL or `night_weekend` is used as fallback for all plans regardless of selected plan.

**Detection:**
1. After `customer.subscription.created`, query `accounts.plan_key`
2. If wrong, check `stripe_events` row for that event — inspect `event_data->'data'->'object'->'items'->'data'->0->'price'->>'id'`
3. Compare that price ID to each `STRIPE_PRICE_ID_*` env var

**Fix:** Deploy env vars via Supabase Edge Function Secrets panel. Re-deliver the webhook event from Stripe Dashboard.

---

### FM-2: Overage Price Item Missing from Subscription

**Symptom:** `accounts.stripe_overage_item_id` is NULL; `invoice.upcoming` handler silently fails to report usage.

**Detection:**
1. After signup, query `accounts.stripe_overage_item_id`
2. Check Stripe subscription items via API — should have 2 items (base + metered overage)
3. If only 1 item, overage price was never attached at subscription creation

**Root Cause:** `create-trial` or `finalize-trial` only added base price to subscription items.

**Fix:** Verify `create-trial` code creates subscription with `items: [{ price: basePriceId }, { price: overagePriceId }]`.

---

### FM-3: Webhook Event Silently Dropped

**Symptom:** Stripe shows event as delivered (received 200), but `accounts` not updated.

**Detection:**
1. Query `stripe_events` for the event ID
2. If `processed = false` or row missing, the handler threw an error after returning 200
3. Check edge function logs in Supabase Dashboard → Functions → `stripe-webhook` → Logs

**Fix:** Find and fix the error thrown in the handler. Re-deliver the event from Stripe Dashboard → Webhooks → Event details.

---

### FM-4: Legacy Subscribers on Wrong `plan_key` Post-Migration

**Symptom:** Old subscribers show `plan_key = NULL` or an invalid key like `'starter'`.

**Detection:**
```sql
SELECT id, plan_type, plan_key
FROM accounts
WHERE plan_type IN ('starter', 'professional', 'premium')
  AND (plan_key IS NULL OR plan_key NOT IN ('night_weekend', 'lite', 'core', 'pro'));
```

**Fix:** Run backfill SQL using the same mapping as `normalizeLegacyPlanKey()`:
```sql
UPDATE accounts SET plan_key = CASE plan_type
  WHEN 'starter'      THEN 'lite'
  WHEN 'professional' THEN 'core'
  WHEN 'premium'      THEN 'pro'
  WHEN 'trial'        THEN 'night_weekend'
END
WHERE plan_type IN ('starter', 'professional', 'premium', 'trial')
  AND plan_key IS NULL;
```

---

### FM-5: Trial Never Converts — Subscription Stays "Trialing"

**Symptom:** After trial period ends, `accounts.subscription_status` stays `trialing`; no payment taken.

**Detection:**
1. Check Stripe Dashboard → Subscriptions — look for `status: active` after trial end
2. Check `customer.subscription.updated` event in Stripe → was it delivered?
3. Query `stripe_events` for that event ID and `processed` status

**Fix:** Re-deliver the `customer.subscription.updated` event from Stripe Dashboard. Check function logs for errors.

---

### FM-6: `invoice.upcoming` Resets Counters Without Reporting Usage

**Symptom:** `accounts.overage_minutes_current_period` had overage but Stripe usage record is 0.

**Detection:**
1. Before advancing Test Clock, record `accounts.overage_minutes_current_period`
2. After advancing, check Stripe → Subscription → Usage Records for the metered item
3. If quantity = 0 but DB had overage, usage record API call failed silently

**Root Cause:** `stripe_overage_item_id` was NULL (see FM-2), causing the API call to use a wrong/null item ID.

**Fix:** Resolve FM-2 first. Then re-report usage manually via Stripe CLI: `stripe subscription_items usage_records create --subscription-item=si_xxx --quantity=N --timestamp=now`.

---

### FM-7: Double-Billing on Renewal

**Symptom:** Customer charged twice for same month; `account_credits` shows double deduction.

**Detection:**
```sql
-- Check for duplicate event processing
SELECT stripe_event_id, COUNT(*) as count
FROM stripe_events
GROUP BY stripe_event_id
HAVING COUNT(*) > 1;

-- Check for duplicate credit applications
SELECT invoice_id, COUNT(*) as count
FROM account_credits
GROUP BY invoice_id
HAVING COUNT(*) > 1;
```

**Root Cause:** Webhook deduplication race condition. The `stripe_events` UNIQUE constraint on `stripe_event_id` should prevent this — verify the `record_stripe_event()` RPC uses `ON CONFLICT DO NOTHING`.

---

### FM-8: Night & Weekend Plan Answering Daytime Calls After Upgrade

**Symptom:** After upgrade from `night_weekend` to `lite`, calls still rejected during 8AM–6PM weekdays.

**Detection:**
1. Check `accounts.rejected_daytime_calls` — should be 0 after upgrade
2. Check VAPI assistant configuration in VAPI dashboard — `coverageHours` should be `24_7`

**Root Cause:** [Unverified] `create-upgrade-checkout` clears the DB counter but may not update VAPI assistant schedule.

**Fix:** Verify whether VAPI uses `plan_key` dynamically at call time or stores a static schedule on the assistant. If static, the upgrade flow must patch the VAPI assistant.

---

### FM-9: Phone Number Not Released After Hold Period

**Symptom:** Cancelled account's phone number still assigned in VAPI after `phone_number_held_until` passes.

**Detection:**
```sql
SELECT id, vapi_phone_number, phone_number_held_until
FROM accounts
WHERE account_status = 'cancelled'
  AND phone_number_held_until < NOW()
  AND vapi_phone_number IS NOT NULL;
```

**Root Cause:** [Unverified] No automated cron to release numbers after hold expires. Release may require manual VAPI API call.

**Fix:** Verify if a scheduled function handles this. If not, create a cron job that queries the above and calls VAPI to release.

---

### FM-10: Stripe Webhook Endpoint URL Mismatch Post-Deployment

**Symptom:** All Stripe events show 404 or 403 delivery failures in Stripe Dashboard.

**Detection:** Stripe Dashboard → Developers → Webhooks → Endpoint — compare URL to production Supabase edge function URL: `https://<project>.supabase.co/functions/v1/stripe-webhook`.

**Fix:** Update the webhook endpoint URL in Stripe Dashboard after each deployment that changes the function URL.

---

## Stripe Test Clock Strategy

### Setup Steps

1. In Stripe Test Mode: Customers → **Create Test Clock**  (name by scenario, e.g., `TC-D1-trial-conversion`)
2. Create a test customer attached to this clock
3. Use that customer's ID to create a subscription (pass directly to `create-trial` or `provision-account`)
4. Advance the clock in controlled increments:

| Clock Advance | What to Verify |
|---|---|
| +1 hour | `checkout.session.completed` processed; `stripe_overage_item_id` set |
| +3 days (trial end) | Trial converts; first invoice = $59; `subscription_status = 'active'` |
| +23 days (7 days pre-renewal) | `invoice.upcoming` fires; overage reported to Stripe |
| +30 days (renewal) | Renewal invoice = base + overage; `minutes_used_current_period` reset to 0 |

### Clock-Specific Assertions

**Before advancing each increment, record:**
- `accounts.minutes_used_current_period`
- `accounts.overage_minutes_current_period`
- `accounts.stripe_overage_item_id`
- Stripe subscription `current_period_end`

**After `invoice.upcoming` fires:**
- Stripe usage record quantity === `overage_minutes_current_period` (pre-advance value)

**After renewal invoice paid:**
- `accounts.overage_minutes_current_period = 0`
- Invoice total = `base_price + (pre_advance_overage_min × overage_rate)`

---

## Data Collection Template

Copy this for each manual test execution:

```
Test ID:
Date/Time (UTC):
Tester:
Stripe Mode: [ ] Test  [ ] Live
Account ID (Supabase UUID):
Stripe Customer ID (cus_xxx):
Stripe Subscription ID (sub_xxx):
Plan Key Expected:
Plan Key Actual (accounts.plan_key):
Overage Item ID (accounts.stripe_overage_item_id):
Provisioning Status (accounts.provisioning_status):
VAPI Phone Number (accounts.vapi_phone_number):
Stripe Events Processed (stripe_events row count for this session):
Invoice Amount (if applicable):
Pass / Fail:
Notes / Deviations:
```

---

## Files Referenced

| File | Purpose |
|------|---------|
| `src/lib/billing/dashboardPlans.ts` | Plan definitions, legacy key mapping, `normalizeLegacyPlanKey()` |
| `supabase/functions/stripe-webhook/index.ts` | All webhook event handlers |
| `supabase/functions/create-trial/index.ts` | Trial signup flow |
| `supabase/functions/finalize-trial/index.ts` | Two-step signup completion |
| `supabase/functions/provision-account/index.ts` | Post-signup provisioning |
| `supabase/functions/sync-usage/index.ts` | Usage tracking + alerts |
| `supabase/functions/cancel-subscription/index.ts` | Cancellation handler |
| `supabase/functions/create-upgrade-checkout/index.ts` | Plan upgrade via Checkout |
| `supabase/functions/stripe-subscription-update/index.ts` | In-place plan change |
| `supabase/functions/reset-monthly-usage/index.ts` | Monthly overage reset cron |
| `supabase/functions/stripe-invoices-list/index.ts` | Invoice list API |
| `supabase/functions/get-billing-summary/index.ts` | Payment method summary |
| `supabase/migrations/20260302000001_pricing_restructure.sql` | DB schema: accounts, plans, stripe_events |
| `supabase/migrations/20251123000003_stripe_events.sql` | Webhook deduplication table |
| `.env.example` | All 8 Stripe price env var names |
| `tests/e2e/dashboard-billing.spec.ts` | Existing E2E tests (currently mostly skipped) |
| `scripts/stripe-setup-new-plans.js` | Plan creation script |
