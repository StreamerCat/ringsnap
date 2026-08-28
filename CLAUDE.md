# RingSnap — AI Assistant Guide

RingSnap is an AI receptionist SaaS for home-services contractors (Vapi voice AI + Twilio numbers + Supabase/Stripe). Full repo structure, env vars, and key flows: see `docs/ARCHITECTURE.md` — read it on demand, not by default.

## Workflow

- Plan mode for architecturally significant or ambiguous multi-step tasks — not a default for every 3+ step task. Skip it for well-scoped bug fixes and small features.
- Delegate to a subagent only when a search/research task would otherwise pull several tool calls of noise into main context (e.g. broad codebase exploration). Don't spawn subagents by default.
- If something goes sideways, stop and re-plan rather than pushing through.
- After a user correction that reveals a repeatable pattern, add a short entry to `tasks/lessons.md`. Check that file at session start.
- Before marking anything done: run the relevant tests/typecheck/lint, don't just claim it works.
- Keep changes minimal and scoped to what was asked — no drive-by refactors, no speculative abstractions.

## Task Tracking

For multi-step work, track progress with `tasks/todo.md` (checkable items, review notes at the end). Not needed for small, single-step changes.

## Core Principles

- **Simplicity first**: smallest change that solves the problem.
- **Root causes only**: no temporary/band-aid fixes.
- **Minimal impact**: touch only what's necessary.

---

## Key Conventions

### TypeScript
- `@/` path alias resolves to `src/`
- TypeScript is configured permissively (`noImplicitAny: false`, `strictNullChecks: false`, `noUnusedLocals: false`) — don't tighten without discussion
- `src/integrations/supabase/types.ts` is auto-generated — never hand-edit; regenerate with `supabase gen types`

### React patterns
- One page per route in `src/pages/`; all but `Index` use `React.lazy()` (see `App.tsx`)
- Protected routes: `withAuthGuard(Component)` from `@/lib/auth/useUser`
- Auth state: `useUser()` hook
- Server state: `@tanstack/react-query`
- Forms: `react-hook-form` + `zod`
- Toasts: `sonner` (`import { toast } from 'sonner'`)

### UI components
- Always use shadcn/ui primitives from `src/components/ui/` — never recreate buttons/dialogs/inputs
- `src/components/ui/` is shadcn-generated — don't edit directly
- Tailwind + `cn()` from `@/lib/utils` for conditional classes
- Icons: `lucide-react` only

### Supabase client
- Browser: `import { supabase } from '@/lib/supabase'` (anon key)
- Edge functions: create a service-role client per function using `SUPABASE_SERVICE_ROLE_KEY`
- Never use the service-role key in frontend code

### Edge functions
- Deno TypeScript in `supabase/functions/[name]/index.ts`
- Always handle `OPTIONS` preflight and return `corsHeaders` from `../_shared/cors.ts`
- Structured logging via `logInfo`/`logError`/`logWarn` from `../_shared/logging.ts`
- `verify_jwt` is set per-function in `supabase/config.toml` — check when adding public endpoints
- `_shared/` is not a deployable function — never deploy it standalone

### Database migrations
- Filename: `supabase/migrations/YYYYMMDDHHMMSS_description.sql` exactly
- `scripts/lint-migrations.mjs` runs at session start — fix lint errors before committing
- No `COMMENT ON` with `||` string concatenation; no `CREATE INDEX` with STABLE functions in WHERE; rollback scripts go in `supabase/migrations/rollback/`

### Feature flags
- Defined in `src/lib/featureFlags.ts`, env-var controlled (`VITE_FEATURE_*`)
- Default ON in dev/staging, OFF in prod unless specified
- Use `featureFlags.flagName` — never raw `import.meta.env` checks inline

### RBAC / Roles
- Roles: `platform_owner`, `platform_admin`, `sales`, `staff`
- Use `hasRoleAccess(userRole, allowedRoles)` from `@/lib/auth/roles`
- Owners/admins bypass all role checks automatically

### Analytics
- Route tracking is automatic via `RouteTracker` in `App.tsx`
- Custom events: `posthog-js` directly
- Errors: Sentry (`@sentry/react`, `@/lib/sentry-tracking`)

---

## Commands

```bash
npm run dev            # dev server, port 8080
npm test                # vitest unit tests
npm run test:e2e        # playwright e2e (needs dev server)
npm run test:smoke      # fast CI gate
npm run typecheck
npm run lint
npm run build
```

---

## Gotchas

- Don't edit `src/components/ui/` or `src/integrations/supabase/types.ts`
- Edge functions are Deno, not Node — use `Deno.env.get()`, not `process.env`
- Migration filenames must match the timestamp format exactly
- Check `supabase/config.toml` `verify_jwt` when adding new public endpoints
- `_shared/` in edge functions is not a standalone function
- E2E test accounts must start with `E2E Test` (cleanup safety guardrail)
- TypeScript is intentionally lenient here — don't add strict checks to existing files
