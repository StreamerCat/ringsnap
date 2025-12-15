# Stripe Configuration & Verification Guide

## 1. Webhook Setup (Stripe Dashboard)
Go to **Developers > Webhooks** in your Stripe Dashboard (Live Mode).

### Endpoint Configuration
- **Endpoint URL**: `https://rmyvvbqnccpfeyowidrq.supabase.co/functions/v1/stripe-webhook`
- **Description**: RingSnap Supabase Edge Function

### Events to Select
Select the following events:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

### Secrets
After creating the webhook, reveal the **Signing Secret** (`whsec_...`).
Update your Supabase secrets:
```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

## 2. Environment Variables
Ensure the following variables are set in your Supabase project:
- `STRIPE_SECRET_KEY`: Your Stripe Live Secret Key (`sk_live_...`)
- `STRIPE_PRICE_STARTER`: Price ID for Starter plan
- `STRIPE_PRICE_PROFESSIONAL`: Price ID for Professional plan
- `STRIPE_PRICE_PREMIUM`: Price ID for Premium plan

## 3. Verification Steps (Live Mode)

**Warning**: These steps involve real charges unless you use a 100% off coupon or small amounts.

1.  **Subscription Lifecycle**:
    -   Sign up for a new account on RingSnap.
    -   Upgrade to a paid plan.
    -   **Verify**: Check Stripe Dashboard > logs for `checkout.session.completed` (handled by `create-upgrade-checkout`) and subsequent `customer.subscription.created` (handled by webhook).
    -   **Verify**: RingSnap Dashboard should show "Plan: [Your Plan]" and "Status: Active".

2.  **Invoices**:
    -   Go to RingSnap Dashboard > Billing.
    -   **Verify**: You should see the initial invoice in the "Billing History" table.
    -   Click the **PDF** icon to ensure it opens the invoice.

3.  **Update Card**:
    -   Go to RingSnap Dashboard > Billing.
    -   Click **Update** next to Payment Method.
    -   Enter a different card (or the same one).
    -   **Verify**: Toast appears "Card updated". The card details (last 4, brand) update in the UI.

4.  **Change Plan**:
    -   Go to RingSnap Dashboard > Billing.
    -   Change plan from Starter to Professional (or vice versa).
    -   **Verify**: Toast appears "Plan updated". UI reflects new plan immediately. Stripe Dashboard shows subscription update.

5.  **Cancel Subscription**:
    -   Go to RingSnap Dashboard > Billing.
    -   Click **Cancel Subscription** (if active).
    -   **Verify**: Toast appears. UI shows status "Active" (cancels at period end) or "Cancelled" depending on logic.
    -   **Verify**: Stripe Dashboard shows subscription `cancel_at_period_end` is true.
