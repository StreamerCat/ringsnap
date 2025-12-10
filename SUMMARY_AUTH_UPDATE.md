# Auth & Onboarding System Hardening

## Overview
This update addresses critical fragility in the signup and authentication flows, specifically focusing on returning users, partial leads, and password recovery.

## Changes

### 1. Robust `/start` Experience (Returning Users)
- **Problem**: Visiting `/start` with an expired or stale session caused JSON errors or endless loading.
- **Fix**: Implemented a strict `try/catch` session check. If the user session cannot be validated (e.g., profile fetch fails), the system **automatically cleans up** the session (Sign Out) and presents the lead capture form.
- **Benefit**: No more broken JSON screens; effortless recovery for users with bad cookies.

### 2. Idempotent Lead Capture
- **Problem**: Re-submitting the signup form with an existing email caused "Unique Constraint" database errors.
- **Fix**: Switched client-side logic to use the `capture-signup-lead` Edge Function.
- **Mechanism**: The function detects existing leads and performs an **UPDATE** instead of an INSERT. It returns the existing `lead_id`, allowing the user to seamlessly resume onboarding.

### 3. Password Reset Security & UX
- **Security**: The "Forgot Password" form no longer reveals if an email is registered ("User not found" errors are masked).
- **UX**: After successfully resetting a password, the user is **automatically redirected to their dashboard** instead of being forced to log in again.

### 4. Technical Debt Code Cleanup
- Refactored `src/lib/api/leads.ts` to centralize lead capture logic via Edge Functions.
- Cleaned up imports and syntax in `PasswordReset.tsx`.
- Removed fragile direct-DB inserts from the signup flow.

## Happy Paths (Verified)

1.  **New Visitor**: `/start` (Fill Form) → `/onboarding-chat` → Account Created → `/dashboard`.
2.  **Returning Lead**: `/start` (Fill Form w/ same email) → Detects Lead → Redirects to `/onboarding-chat` (Resume).
3.  **Returning Customer**: Visit `/start` → Auto-redirect to `/dashboard`.
4.  **Bad Session**: Visit `/start` → Session cleared → Show Form.
5.  **Password Reset**: Request Link → Click Link → Update Password → Auto-redirect to `/dashboard`.
