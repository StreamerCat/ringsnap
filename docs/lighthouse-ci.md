# Lighthouse CI — Team Guide

Lighthouse CI runs on every PR targeting `main`. It is a **required merge gate**:
PRs that fail the accessibility, best-practices, or SEO thresholds cannot be merged.

---

## How it runs

`.github/workflows/lighthouse-ci.yml` does the following on every PR:

1. `npm ci` — install deps
2. `npm run build:no-prerender` — production Vite build (no puppeteer prerender)
3. `npx lhci autorun` — starts `vite preview` on port 4173, audits 4 routes
4. Posts a score table as a PR comment
5. Uploads full JSON/HTML reports as a workflow artifact (14 days)

The configuration lives in `lighthouserc.js` at the repo root.

---

## Audited routes

| Route | Why it matters |
|-------|---------------|
| `/` | Home — highest traffic, primary LCP |
| `/pricing` | High-intent conversion page |
| `/plumbers` | Primary trade landing page |
| `/difference` | Brand/compare page |

To add more routes, edit the `collect.url` array in `lighthouserc.js`.

---

## Thresholds

| Category | Level | Threshold | Rationale |
|----------|-------|-----------|-----------|
| Performance | `warn` | ≥ 60 | CI CPU throttling creates ±10–15 pt noise; hard gate causes false positives |
| Accessibility | `error` | ≥ 85 | Blocks merge — accessibility issues are always fixable |
| Best Practices | `error` | ≥ 85 | Blocks merge — catches CVEs and console errors |
| SEO | `error` | ≥ 85 | Blocks merge — catches missing titles, descriptions, alt text |

In addition to category scores, specific audits are gated individually (see
`lighthouserc.js` `assert.assertions` for the full list). SEO audits like
`document-title`, `meta-description`, and `image-alt` are always hard errors.

**To update thresholds:**
1. Edit `lighthouserc.js`
2. Run `npm run build:no-prerender && npm run test:lhci` locally
3. Verify the change gives the right pass/fail behaviour
4. Open a PR — the CI run will use your updated config

---

## Required status check setup

The workflow creates a check called `Lighthouse Audit`. To make it a **required
merge gate** in GitHub:

1. Go to **Settings → Branches → Branch protection rules**
2. Edit (or create) the rule for `main`
3. Enable **Require status checks to pass before merging**
4. Search for and add `Lighthouse Audit`
5. Save

Once this is set, PRs that fail the Lighthouse check cannot be merged until
the check passes.

### Optional: GitHub commit status updates

If you set the `LHCI_GITHUB_APP_TOKEN` repository secret (a PAT with `repo`
scope), LHCI will post individual commit statuses per URL. Without the token,
the workflow job status alone is the gate.

---

## PR comment

Every PR gets a comment like this:

```
## ✅ Lighthouse CI — Passed

| Route     | Perf | A11y | Best Practices | SEO |
|-----------|------|------|----------------|-----|
| /         | 🟢 92 | 🟢 97 | 🟢 95          | 🟢 91 |
| /pricing  | 🟡 75 | 🟢 96 | 🟢 95          | 🟢 93 |
| /plumbers | 🟢 81 | 🟢 97 | 🟢 95          | 🟢 92 |
```

When the check fails, the comment includes a **Failed assertions** section
listing every failing audit with the route, actual score, and expected threshold.

---

## Downloading full reports

From the Actions tab, open the failed/passed run, scroll to **Artifacts**, and
download `lighthouse-reports-{run-number}`. The archive contains:
- `lhr-*.json` — full Lighthouse Report JSON (open in Chrome DevTools)
- `lhr-*.html` — rendered HTML report (open in any browser)
- `assertion-results.json` — machine-readable assertion outcomes

---

## Running Lighthouse locally

```bash
# Build first
npm run build:no-prerender

# Run all audited routes (uses lighthouserc.js)
npm run test:lhci

# Print a human-readable summary
node scripts/lhci-summary.mjs
```

The `vite preview` server is started and stopped automatically by LHCI.

---

## Invoking the performance reviewer (Claude)

When a Lighthouse check fails and you need help diagnosing it, ask Claude:

> "The Lighthouse CI check is failing on this PR. Please review the regression
> and either fix it or explain what changed and what the recommended fix is."

Claude will follow the playbook in `tasks/performance-review.md`, which covers:
- Identifying the failing audit and likely cause
- Safe fixes vs deferred issues
- Verification steps

Claude will **not** auto-fix changes to pricing, billing, auth, onboarding,
analytics, or structured data — those require human review.

---

## Debugging failed runs

### Build failed

Check whether the build step failed before LHCI ran. The build uses placeholder
Supabase/Stripe credentials in CI — if a new code path does synchronous
validation of these at build time, the build will fail.

Fix: ensure any validation of env vars is done at runtime, not module load time.

### `vite preview` didn't start in time

If the error is `startServerReadyTimeout`, increase `startServerReadyTimeout`
in `lighthouserc.js` (default: 30000ms).

### Score is flaky / different each run

Performance scores in CI vary by ±10–15 points. The performance threshold is
`warn` (not `error`) specifically to avoid flaky gates. If SEO or accessibility
scores are flaky, check whether a component is conditionally rendered based on
a timing dependency.

### LHCI uploads failed

The `upload.target: 'temporary-public-storage'` upload is best-effort. If it
fails, the CI check still passes/fails based on assertions alone. The full
reports are always available as a workflow artifact regardless of upload status.

---

## Architecture notes

- **No LHCI server**: We use `temporary-public-storage` (Google-hosted) for
  report upload. This requires no credentials and incurs no cost.
- **Prerendering is skipped in CI**: `build:no-prerender` is used for speed.
  Lighthouse executes JavaScript so SPA routes resolve correctly. SEO scores
  reflect the JS-rendered DOM, which is accurate.
- **4 routes, 2 runs each**: Balances signal quality vs CI time (~10–15 min).
  Increase `numberOfRuns` to 3 for more stable scores at the cost of run time.
