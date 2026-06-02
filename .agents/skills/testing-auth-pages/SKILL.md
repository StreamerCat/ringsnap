---
name: testing-auth-pages
description: Test RingSnap auth pages (password reset, login) locally. Use when verifying auth UI changes.
---

# Testing RingSnap Auth Pages

## Setup

```bash
npm install
npm run dev  # Vite dev server on port 8080 (may use 8081 if 8080 is in use)
```

No `.env` file is required for basic UI testing — the app renders without Supabase credentials. However, without Supabase configured, actual API calls (password update, login) will fail with expected errors like "Auth session missing!".

## Key Auth Routes

| Route | Component | Purpose |
|-------|-----------|--------|
| `/auth/password` | `AuthPassword.tsx` | Password reset form (newer) |
| `/reset-password` | `PasswordReset.tsx` | Password reset (legacy) |
| `/auth/login` | `AuthLogin.tsx` | Login page |
| `/auth/callback` | `AuthCallback.tsx` | OAuth callback |
| `/auth/magic-callback` | `MagicCallback.tsx` | Magic link callback |
| `/auth/staff-invite` | `StaffInvite.tsx` | Staff invite flow |

## Testing `/auth/password`

The `AuthPassword` component has 4 UI states controlled by URL params and form state:

### 1. Invalid Link State
**URL:** `/auth/password` (no query params)
- Shows "Invalid Link" card with expiry info
- "Back to Login" button navigates to `/auth/login`

### 2. Password Form State
**URL:** `/auth/password?token=test123&type=recovery`
- Adding `token` and `type` query params triggers the form view
- Shows two password fields + "Reset Password" button
- Page title: "Reset Password | RingSnap"

### 3. Client-Side Validation
- **Short password:** Browser native `minLength=8` validation fires first, blocking form submit. The component also has a secondary check (`password.length < 8`) that shows a sonner toast.
- **Mismatched passwords:** Toast "Passwords do not match" via sonner.

### 4. Server Error Handling
- With matching valid passwords but no Supabase session, submitting shows toast "Auth session missing!" and the form recovers (not stuck in loading).

### 5. Reset Complete State
- Only reachable with a real Supabase recovery session. Cannot be triggered locally without backend.

## Responsive Testing

All auth pages use `max-w-md` cards with `px-4` padding, centered via flexbox. Test at 375px width using Chrome DevTools device toolbar (`Ctrl+Shift+M` with DevTools open).

## Tips

- Auth pages hide the Vapi chat widget automatically.
- The `PasswordReset.tsx` (at `/reset-password`) is a legacy version that checks for `#access_token` in the URL hash and listens for Supabase `PASSWORD_RECOVERY` auth events. `AuthPassword.tsx` (at `/auth/password`) uses search params instead.
- To test the full password reset flow end-to-end, you need Supabase credentials configured in `.env` (see `CLAUDE.md` for required env vars).

## Devin Secrets Needed

- `VITE_SUPABASE_URL` — for full end-to-end auth testing
- `VITE_SUPABASE_PUBLISHABLE_KEY` — for full end-to-end auth testing
