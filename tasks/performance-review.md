# Performance Review Agent — Playbook

This document is a playbook for Claude (or a human reviewer) performing a
Lighthouse regression investigation. Follow it when the `Lighthouse CI` check
fails on a PR or when scores drop between runs.

---

## When to use this playbook

- The `Lighthouse CI` GitHub Actions check is failing
- A maintainer types `/performance-review` or asks Claude to investigate perf
- A PR introduces JS, CSS, image, or HTML changes on a measured route

---

## Step 1 — Identify the regression

### 1a. Read the PR comment

The `Lighthouse CI` workflow posts a score table on every PR. Look at:
- Which category dropped below threshold (Accessibility, Best Practices, SEO, or Performance)
- Which route(s) failed
- The "Failed assertions" section below the table

### 1b. Download the artifact

The workflow uploads `.lighthouseci/` as `lighthouse-reports-{run}`.
Download it and run:
```
node scripts/lhci-summary.mjs --dir <unzipped-path>
```
This surfaces scores and the top 3 opportunities per route.

### 1c. Reproduce locally

```bash
npm run build:no-prerender
npm run test:lhci
node scripts/lhci-summary.mjs
```

---

## Step 2 — Triage the failure

### SEO regression (categories:seo < 0.85)

Common causes and safe fixes:

| Audit | Cause | Safe fix |
|-------|-------|----------|
| `document-title` | New page missing `<title>` | Add `<Helmet><title>…</title></Helmet>` |
| `meta-description` | New page missing meta description | Add description to Helmet block |
| `image-alt` | New `<img>` missing `alt` | Add `alt` attribute — always safe |
| `html-has-lang` | Changed `index.html` lang attr | Restore `<html lang="en">` |
| `link-text` | New link with "click here" text | Rename to descriptive text |
| `structured-data` | Invalid JSON-LD added by PR | Validate at schema.org/validator |

**Do not touch**: pricing logic, billing, auth flows, analytics, existing structured data unless provably broken.

### Accessibility regression (categories:accessibility < 0.85)

Common causes:

| Audit | Cause | Safe fix |
|-------|-------|----------|
| `image-alt` | Same as SEO — always fix | Add `alt` |
| `color-contrast` | New text element with low contrast | Darken text or lighten background using Tailwind classes |
| `button-name` | Icon-only button missing `aria-label` | Add `aria-label` |
| `duplicate-id` | Dynamic component renders duplicate `id` | Change id to unique or remove it |
| `heading-order` | Added headings that skip h-levels | Fix heading hierarchy |

### Best Practices regression (categories:best-practices < 0.85)

Common causes:

| Audit | Cause | Safe fix |
|-------|-------|----------|
| `no-vulnerable-libraries` | New dep with known CVE | `npm audit fix` or bump the dep |
| `js-libraries` | Outdated detected library | Not always fixable without testing |
| `uses-http2` | Serving from localhost (CI) | Not a real issue; skip |
| `csp` | Missing Content Security Policy | Add via Netlify headers (complex — defer) |
| `errors-in-console` | New runtime JS errors | Fix the JS error in the PR diff |

### Performance regression (categories:performance < 0.6)

Performance scores under CI CPU throttling are noisy (±10–15 points). Before
investigating, check:
- Did the score drop more than 15 points? If not, likely noise.
- Did the PR add large new imports that appear in the initial bundle?

Common causes of real regressions:

| Symptom | Cause | Safe fix |
|---------|-------|----------|
| LCP increased significantly | Large above-fold image added without `loading="eager"` + explicit dimensions | Add `width`/`height` attrs; avoid `loading="lazy"` on LCP image |
| TBT increased | Large sync JS added to critical path | Move to dynamic `import()` or `React.lazy()` |
| CLS introduced | Image/element added without dimensions | Add explicit `width` + `height` or Tailwind `aspect-*` class |
| `render-blocking-resources` new | New `<link rel="stylesheet">` added to `index.html` | Use `rel="preload"` + onload pattern (see existing fonts in `index.html`) |
| `unused-javascript` spike | Large library imported eagerly on marketing pages | Move behind `React.lazy()` |

---

## Step 3 — Apply fixes (safe-fix policy)

### Safe to fix without asking:
- Missing `alt` on `<img>` elements (never affects semantics unless alt is wrong)
- Missing `<title>` or `<meta name="description">` on new pages
- `aria-label` on icon buttons
- Fix JS console errors introduced by PR
- Bump a dep to fix a CVE (verify no breaking changes)
- Add explicit `width`/`height` to new images

### Ask before fixing:
- Color palette / visual changes
- Heading restructure on existing pages
- Removing or changing structured data
- Changes to `index.html` (affects all pages)
- Changes to `vite.config.ts`
- Any change to analytics, auth, billing, or onboarding code

### Never auto-fix:
- Regressions in pricing, signup, billing, or onboarding flows
- Removals of tracking scripts or structured data
- Changes that affect existing component behavior

---

## Step 4 — Verify the fix

After applying a fix:
```bash
npm run build:no-prerender
npm run test:lhci
node scripts/lhci-summary.mjs
```

Compare before vs after. If the fix doesn't improve the score by at least 2
points on the failing category, do not land it — flag the regression for human
review instead.

---

## Step 5 — Report

If you are Claude performing this review, output:

```
## Lighthouse Performance Review

**Regression**: [audit name] on [route]
**Root cause**: [what in the PR diff caused it]
**Recommended fix**: [specific code change]
**Risk**: [low/medium/high] because [reason]
**Status**: [Fixed in this review / Deferred — requires human decision]
```

---

## Tuning thresholds

Thresholds live in `lighthouserc.js`. To update:
1. Edit the `assert.assertions` block
2. Use `'warn'` for noisy or aspirational goals
3. Use `'error'` only for gates you would actually block a PR over
4. Keep performance at `'warn'` — CI throttling makes hard gates too flaky
5. After changing thresholds, re-run LHCI locally to verify the new config

See also: `docs/lighthouse-ci.md`
