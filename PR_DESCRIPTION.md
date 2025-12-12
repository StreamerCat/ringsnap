## Customer Dashboard Fixes + Billing Upgrade Flow

### Summary
Stabilizes and cleans up the Customer Dashboard for MVP launch. Implements a feature-flagged plan upgrade flow, fixes broken UI elements, and improves billing UX.

### Changes

#### 🆕 New Features
- **Upgrade Modal** (`UpgradeModal.tsx`) - Shared component for plan upgrades with all 3 plans displayed
- **Kill Switch Feature Flag** - `VITE_FEATURE_UPGRADE_MODAL` defaults to `false`, allowing UI fixes to ship before enabling upgrades
- **Safe Upgrade Logic** - Edge function updates existing subscriptions instead of creating duplicates
- **Payment Method Display** - Fetches card details from Stripe with soft fail fallback

#### 🐛 Bug Fixes
- **Team Tab** - Fixed critical `useState → useEffect` bug causing "Failed to load team members"
- **Header Display** - Now shows company name, first name, and Vapi phone number

#### 🔧 Improvements
- **Overview Tab** - Changed "Manage Billing" to "Upgrade" button
- **Settings Tab** - Wired "Upgrade Now" button in Call Recording section
- **Billing Tab** - Removed "Add Credits" button, shows actual card last4 from Stripe
- **Referrals Tab** - Temporarily disabled with "coming soon" placeholder

### New Edge Functions
| Function | Purpose |
|----------|---------|
| `create-upgrade-checkout` | Handles plan upgrades safely (updates existing subscription OR creates Stripe Checkout) |
| `get-billing-summary` | Fetches payment method details from Stripe (fails soft) |

### Plan Keys (Corrected)
- `starter` | `professional` | `premium`

### Deployment Requirements

1. **Deploy edge functions:**
   ```bash
   supabase functions deploy create-upgrade-checkout
   supabase functions deploy get-billing-summary
   ```

2. **Set Stripe secrets (if not already set):**
   ```bash
   supabase secrets set STRIPE_PRICE_STARTER=price_xxx
   supabase secrets set STRIPE_PRICE_PROFESSIONAL=price_xxx
   supabase secrets set STRIPE_PRICE_PREMIUM=price_xxx
   ```

3. **Enable upgrades when ready:**
   ```
   VITE_FEATURE_UPGRADE_MODAL=true
   ```

### Testing Checklist
- [ ] Header displays company name, first name, Vapi number
- [ ] Upgrade button opens modal (with flag enabled) or billing portal (flag disabled)
- [ ] Team tab loads members successfully
- [ ] Billing tab shows card last4 (or graceful fallback)
- [ ] Referrals tab shows "coming soon" without errors
- [ ] Existing flows (signup, provisioning, billing portal) still work

### Breaking Changes
None - all changes are additive and feature-flagged.
