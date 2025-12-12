# Billing Happy State & Troubleshooting

## Happy Path
1.  **Dashboard Access**: User logs in and navigates to `[Dashboard](/dashboard?tab=billing)`.
2.  **View Status**:
    - "Current Plan" card shows the correct plan type (e.g., "Pro").
    - "Status" badge reflects Stripe status (Active, Trial, Past Due).
    - If on trial, "Trial Ends In" days are accurate.
3.  **Manage Subscription**:
    - Clicking "Manage Subscription" or "Update" (Payment Method) redirects to the Stripe Billing Portal.
    - **Success**: User lands on Stripe Portal, can see invoices, update card, or change plan.
    - **Return**: Clicking "Return to RingSnap" in Stripe redirects back to `/dashboard?tab=billing`.
4.  **Cancel Trial**:
    - If on trial, "Danger Zone" -> "Cancel Trial" is visible.
    - Clicking it prompts for confirmation.
    - **Success**: Toast appears "Subscription Canceled", page reloads, status updates to `cancelled` (or account access changes).
5.  **History**:
    - "Billing History" card -> "View Invoices" redirects to Stripe Portal invoice history.

## Troubleshooting

### "Failed to open billing portal" or 500 Error
**Symptoms**: User clicks "Manage" and gets an error toast.
**Checks**:
1.  **Stripe Customer ID**: Does the `accounts` record have a valid `stripe_customer_id`?
    - *Query*: `select stripe_customer_id from accounts where id = '...'`
    - *Fix*: If missing, the account provisioning failed. Manually create a customer in Stripe and update the DB row.
2.  **Stripe Portal Config**: Is the Portal enabled in Stripe Dashboard?
    - Go to [Stripe Billing Portal Settings](https://dashboard.stripe.com/settings/billing/portal).
    - Ensure "Allow customers to manage their subscription" is ON.
3.  **Logs**: Check Supabase Edge Function logs for `create-billing-portal-session`.
    - Look for `stripe_check` or `stripe_portal_create` phase errors.

### "Account not found" or 403
**Symptoms**: User gets "Unauthorized" or generic error.
**Checks**:
1.  **Auth**: Is the user logged in?
2.  **Ownership**: Is the `user.id` linked to the `account_id` via `profiles` table?
    - *Query*: `select * from profiles where id = 'USER_ID' and account_id = 'ACCOUNT_ID'`

### Subscription Status stuck
**Symptoms**: User upgraded in Portal but Dashboard says "Trial".
**Checks**:
1.  **Webhooks**: Is the Stripe Webhook configured?
    - Events: `customer.subscription.updated`, `customer.subscription.created`.
    - Target: `.../functions/v1/stripe-webhook`
2.  **Manual Refresh**: The dashboard updates on page reload. Verify if a hard refresh fixes it.
