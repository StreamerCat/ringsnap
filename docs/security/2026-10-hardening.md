# October 2026 security hardening

Reviewed against main commit `05aa26c6270e0f6156502d9b5802df9b43224637`.

## Changes

- Retire `cleanup-database` with HTTP 410 and remove all user-deletion code.
- Require a verified user JWT plus a current `platform_admin` or `platform_owner` database role for `debug-db`, `seed-pool`, `test-vapi-integration`, `verify-magic-debug`, `sentry-test`, and `sentry-debug`. Enable gateway JWT verification too. Public API keys and service-role JWTs are not substitutes for a staff user session.
- Require POST for debug database mutations. Remove real Stripe secrets from Sentry test fixtures and token prefixes from magic-link diagnostics.
- Remove the browser-controlled sales-login bypass. Real sales/admin/owner sessions continue to work.
- Validate internal redirect destinations in password, OAuth, and magic-link login flows, rejecting encoded backslashes, protocol-relative destinations, and control characters.
- Generate verification/referral codes with cryptographic randomness and rejection sampling.
- Update React Router, jsPDF, Vitest, Vite, SWC plugin, Axios, and compatible transitive dependencies.
- Pin Node 24.22.1 for CI/Netlify. Use npm consistently instead of retaining a stale Bun lockfile. Bind local Vite to loopback by default; remote development requires an explicit `--host`.
- Add Python security floors for certifi, uv, PyJWT, urllib3, and requests. Regenerate both Python lockfiles. Build the ops container from the tested frozen uv lockfile.
- Restore frontend unit/security tests and add Python ops tests to the PR quality gate.

## Validation

- 329 frontend tests pass; one existing skip and one existing todo.
- Six standalone authorization/redirect/randomness security tests pass.
- 89 Python ops tests pass, covering signup, payment, provisioning, retries, and voice QA without production credentials.
- ESLint: zero errors, 30 existing warnings.
- Existing `npm run typecheck` passes. An explicit `tsc -p tsconfig.app.json --noEmit` reports 161 errors on both unchanged main and this branch, with no new file/error-code combinations. The existing root script does not check the referenced app project; do not interpret its success as full app type safety.
- Vite production bundle and sitemap generation pass. Full build exits successfully, but browser prerendering cannot run in this sandbox (Chrome socket operation denied). Browser E2E and real rendering must be verified by PR CI.
- Deno type checking passes for the new authorization helper. Checking complete edge-function imports is blocked here by refused access to the existing deno.land dependency.
- npm audit package entries reduced from 55 (5 critical, 32 high) to 25 (0 critical, 13 high). Production-only audit: 4 entries (0 critical, 1 high).

## Remaining findings and boundaries

This is not a claim that every dependency or live environment is secure.

- Remaining npm findings include Zod 3 and build-tool chains (Lighthouse, Puppeteer, Tailwind/PostCSS). No forced downgrade or untested global override was applied. Zod's reported oversized-array validation path was not found in the inspected public trial schema; frontend/library presence alone does not prove a remotely reachable denial of service. A separate schema/resolver migration needs coverage before upgrading Zod across signup.
- Python ops still includes CrewAI's pinned LiteLLM dependency and ChromaDB. Critical server advisories apply if those packages are run as exposed proxy/database servers. This repository starts the ops FastAPI service, not those servers. Do not expose a Chroma or LiteLLM server using this dependency set. Removal or framework upgrades require a separate compatibility review.
- Docker build tooling is not available here. The frozen dependency install and Python tests were exercised locally; the image itself still needs a deployment build.
- Supabase live-management access was denied. Actual function deployments, RLS policies, runtime versions, and production exploitability remain unverified. No production credentials were read and no production mutation tests were attempted.

## Deployment and rollback

1. Require successful PR build/test and browser smoke checks before merge.
2. Deploy the changed diagnostic functions and configuration. Repository deployment workflow deploys functions after main changes. Confirm unauthorized requests receive 401/403 (cleanup is retired and returns 410 after any gateway authentication), authorized staff diagnostics work, and customer signup/billing/calls remain healthy.
3. Rebuild/redeploy the Python ops image so patched CA bundles are actually loaded; changing a lockfile alone does not patch a running container.
4. Remove any configured `VITE_JULES_SECRET` from hosting settings. It is no longer consumed.
5. If a dependency regression requires rollback, revert only the affected dependency changes. Do not restore the destructive cleanup endpoint or remove staff authorization.

References: [Node October security release](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases), [certifi CA advisory](https://github.com/advisories/GHSA-6q48-6c7w-9gw2), [uv CA advisory](https://github.com/advisories/GHSA-hq85-5cpj-mr62).
