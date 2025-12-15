# Billing Dashboard Test Checklist

Manual test checklist for billing flows. Run through these scenarios to verify billing functionality.

## Required Stripe Webhook Events

Ensure these events are enabled in your Stripe webhook configuration:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

## Test Scenarios

### 1. Trial → Upgrade → Active

**Precondition**: Logged in as a trial user

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/dashboard` | Dashboard loads |
| 2 | Click "Billing" tab | Billing section shows trial badge, trial end date |
| 3 | Click "Upgrade Now" button | UpgradeModal opens with 3 plan cards |
| 4 | Verify current plan indicator | Current plan has "Current Plan" badge |
| 5 | Select a higher plan | Plan card highlights |
| 6 | Click "Upgrade to [Plan]" | Redirects to Stripe Checkout |
| 7 | Complete Stripe Checkout | Redirects back to `/dashboard?tab=billing&upgrade=success` |
| 8 | Verify dashboard updates | Plan shows new tier, status shows "active" |

### 2. Active → Change Plan

**Precondition**: Logged in as a paying user

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Billing tab | Shows current plan with pricing |
| 2 | Click "Change Plan" | UpgradeModal opens |
| 3 | Select different plan | Confirmation dialog appears |
| 4 | Confirm change | Toast: "Plan updated successfully" |
| 5 | Verify UI updates | New plan and pricing shown |

### 3. Cancel Subscription

**Precondition**: Logged in as active/trial user

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Scroll to "Cancel" section | Red danger zone card visible |
| 2 | Click "Cancel Subscription" | Confirmation dialog appears |
| 3 | Confirm cancellation | Toast with cancellation message |
| 4 | Verify status | Shows "Canceling" badge or updated status |

### 4. Invoices Load

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Billing tab | Billing History section visible |
| 2 | Verify invoices load | Table shows invoices (or "No invoices" message) |
| 3 | Click PDF icon | Opens invoice PDF in new tab |
| 4 | Click external link icon | Opens hosted invoice URL |

### 5. Update Payment Method

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Billing tab | Payment Method card visible |
| 2 | Click "Update" button | Card update dialog opens with Stripe Elements |
| 3 | Enter new card details | Form accepts input |
| 4 | Click "Save Card" | Toast: "Payment method updated" |
| 5 | Verify card updates | New card last 4 digits shown |

## Automated Tests

Playwright smoke tests in `tests/e2e/dashboard-billing.spec.ts` cover:

- Dashboard loads and renders billing section
- Upgrade modal opens with plan cards
- Invoices section renders

### Running Tests

```bash
# Install dependencies (if needed)
npm install

# Run all e2e tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui
```

## Mocking Strategy

For CI environments:
- Tests use mocked Supabase function responses
- No real Stripe checkout completion in CI
- Focus on UI wiring and component rendering
