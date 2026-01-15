# Fix Password Reset and Magic Link Redirection

## Overview

This PR resolves critical issues with the password reset flow and magic link sign-in process where users were being redirected to the home page or invalid routes instead of their intended destination. It also fixes a "Link or token has expired" error caused by device binding mismatches.

## Changes

### Frontend

- **`src/pages/AuthLogin.tsx`**: Updated the password reset flow to use `/auth/callback?next=/reset-password` as the redirect URL. This ensures the PKCE code exchange happens correctly via the `AuthCallback` component before landing on the reset password page.

### Backend (Response Edge Functions)

- **`supabase/functions/send-magic-link/index.ts`**:
  - Updated the function to dynamically determine the `SITE_URL` from the request `origin` header. This fixes issues where local development or staging environments would redirect to the production domain determined by environment variables.
  - **[NEW]** Removed `deviceNonce` binding from magic link generation. This resolves the "Link or token has expired" error when a user requests a link on one device (e.g., desktop) and clicks it on another (e.g., mobile), ensuring cross-device authentication works as expected for email links.
- **`supabase/functions/_shared/email-service.ts`**: Standardized the magic link redirect URL to always point to `/auth/callback`. Removed invalid paths (e.g., `/onboarding/welcome`) that were causing 404s or unintended home page redirects.

## Testing

- Verified that requesting a password reset link now correctly redirects to the reset password page after clicking the email link.
- Verified that magic links correctly sign the user in and redirect to the dashboard (or onboarding) regardless of the environment (local vs. prod).
- Confirmed that magic links can be opened on a different device than the one that requested them.
