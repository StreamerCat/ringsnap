# RingSnap Authentication & Onboarding Flows

## State Machine Summary

| State | Definition | Primary Route | Allowed Actions |
|-------|------------|---------------|-----------------|
| **Anonymous** | No Auth Cookie | `/start`, `/login` | Submit signup form (Step 1), Login |
| **Lead (Partial)** | No Auth, `lead_id` present | `/onboarding-chat` | Continue onboarding, Pay, Create Account |
| **Authenticated (New)** | Auth Cookie, No Profile Status | `/onboarding-chat` | Complete setup |
| **Authenticated (Active)** | Auth Cookie, `status='active'` | `/dashboard` | View Dashboard, Manage Account |
| **Invalid Session** | Auth Cookie present but expired/bad | (Any, redirects to `/login` or clears) | Must re-authenticate |

## Key Routes & Guards

### 1. `/start` (Entry Point)
- **Role**: Capture initial lead info (Name, Email).
- **Behavior**:
  - **Check Auth**: 
    - If valid user + active profile → Redirect to `/dashboard`.
    - If valid user + incomplete profile → Redirect to `/onboarding-chat`.
    - If **invalid/error session** → Automatically signs out to allow form submission.
  - **Check Lead**:
    - If `lead_id` exists locally/URL → Redirect to `/onboarding-chat` to resume.
  - **Submission**:
    - Calls `capture-signup-lead` Edge Function (idempotent).
    - On success → Redirect to `/onboarding-chat`.
    - On "Already Exists" → Detects, grabs lead, redirects to resume.

### 2. `/onboarding-chat` (Signup Flow)
- **Role**: Collect business info, payment, provisioning.
- **Access**:
  - Requires `lead_id` OR authenticated user.
  - If neither → Redirects to `/start`.
- **Outcome**: 
  - Creates Supabase User (if new).
  - Creates Account, Profile, Subscription.
  - Provisions Phone Number (Async).

### 3. Password Reset Flow
- **Request (`/login`)**:
  - Input Email → "If account exists, email sent." (No enumeration leakage).
- **Reset (`/reset-password`)**:
  - Validates recovery token.
  - Updates password via `supabase.auth.updateUser`.
  - On Success → **Redirects to Dashboard** (skips login screen).

## Edge Case Handling

### Returning User on `/start`
- **Issue**: Previously caused JSON errors or confusing state.
- **Fix**: Strict session check. Any error during profile fetch results in a clean `signOut()`, presenting the form as if anonymous. Prevents "stuck" states.

### Duplicate Signups
- **Issue**: User re-submits Step 1 with same email.
- **Fix**: Edge function updates the existing lead instead of failing. Client detects "already exists" scenario and redirects to resume.

### JSON/Network Errors
- **Issue**: Unhandled 500s or HTML responses from Supabase.
- **Fix**: `captureSignupLead` wrapper catches non-JSON errors and throws readable messages. Route guards handle auth check failures gracefully.
