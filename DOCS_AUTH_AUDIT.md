# RingSnap Auth & Onboarding Audit

## Executive Summary
This document outlines the current state of authentication, onboarding, and provisioning flows in RingSnap, along with identified issues and a plan for hardening.

## Current Architecture

### Frontend (`src/`)
- **Auth State**: Managed by `useUser` hook (`src/lib/auth/useUser.tsx`).
- **Protection**: `withAuthGuard` HOC (`src/lib/auth/useUser.tsx`).
- **Entry Points**:
  - `/start`: Lead capture (Step 1).
  - `/onboarding-chat`: Configuration & Payment (Step 2).
  - `/login`: Standard auth.
  - `/dashboard`: Protected area.

### Backend (Supabase)
- **Tables**:
  - `signup_leads`: Stores partial leads from Step 1.
  - `profiles`: Stores user profile & onboarding status.
  - `accounts`: Stores business/account info.
- **Edge Functions**:
  - `capture-signup-lead`: Intended for safe lead capture (currently bypassed by `Start.tsx`).
  - `create-trial`: Handles full account provisioning, Stripe, and user creation.

## Auth State Machine

1.  **Anonymous Visitor**
    - Visits `/start`.
    - Submits Name/Email.
    - Result: Row in `signup_leads`. `lead_id` stored. Redirect to `/onboarding-chat`.

2.  **Partial Lead (Returning)**
    - Visits `/start` or `/onboarding-chat`.
    - Identified by `lead_id` (URL or LocalStorage).
    - Result: Resumes chat flow.

3.  **Authenticated User (Pre-Boarding)**
    - User has `auth.users` record but no `profiles.onboarding_status = 'active'`.
    - Should be routed to `/onboarding-chat` or provisioning status.

4.  **Authenticated User (Active)**
    - User has active account.
    - Should be routed to `/dashboard`.

## Identified Issues

### 1. JSON Error on `/start` for Returning Users
- **Symptom**: "If I was previously signed in and revisit /start ... I get a JSON error".
- **Root Cause**: Likely a race condition where the `useUser` hook returns a user, triggering a `profiles` fetch. If the session is stale or invalid in a specific way, the Supabase client or the `fetch` call might be failing with a non-JSON response (e.g., 500 error from middleware), which triggers a JSON parse error in the client internals or unhandled promise rejection.
- **Additional Risk**: `Start.tsx` does not strictly wait for auth checks before allowing interaction, potentially leading to dual-state (logged in but submitting form).

### 2. Direct DB Insert in `/start`
- **Issue**: `Start.tsx` calls `signup_leads` insert directly via `captureSignupLead` (client-side), ignoring the `capture-signup-lead` edge function.
- **Risk**:
    - Bypasses server-side validation/logic in the edge function.
    - Fails on duplicate emails (no upsert logic in `src/lib/api/leads.ts`).
    - Relies on RLS policies which might be complex for anonymous vs authenticated users.

### 3. Account Provisioning Fragility
- **Issue**: `create-trial` is a monolith.
- **Risk**: Complex compensation logic (Stripe rollback) exists but catching all edge cases (like "user already exists but no account") is critical.

## Hardening Plan

### Phase 1: Robust `/start` Handling
- **Obj**: Prevent JSON errors and handle returning users gracefully.
- **Actions**:
    - Update `Start.tsx` to use a robust session check wrapper.
    - If `useUser` returns error or invalid session, strictly `signOut` and clear state before showing form.
    - If valid session, redirect immediately and **do not render form**.
    - Wrap async calls in `try/catch` that safely handles non-JSON errors.

### Phase 2: Idempotent Lead Capture
- **Obj**: Fix "already exists" errors.
- **Actions**:
    - Update `captureSignupLead` (client helper) to use `upsert` or handle unique constraint violations by returning the existing lead.
    - ALIGNMENT: Ensure `Start.tsx` uses the robust logic.

### Phase 3: Auth Guard Improvements
- **Obj**: Standardize route protection.
- **Actions**:
    - Review `withAuthGuard` for edge cases (infinite loading loops).
    - Ensure `profiles` check is cached or efficient.

### Phase 4: Password Reset & Recovery
- **Obj**: Ensure robust recovery.
- **Actions**:
    - Audit `/reset-password` flow.
    - Ensure invalid tokens fail gracefully.

