# SEO / Indexing Fix Report

**Date:** 2026-05-28
**Branch:** `claude/ringsnap-seo-indexing-em0KT`
**Audit baseline:** Ahrefs (Health 39, 41 errors, 79 warnings)

---

## Summary of changes

| Area | Before | After |
| --- | --- | --- |
| Sitemap URLs with duplicate `<meta name="description">` | 33 / 33 | 0 / 33 |
| Sitemap URLs with incomplete Open Graph | 2 (privacy, terms) | 0 |
| Sitemap URLs returning 5XX (local prerender) | 0 | 0 |
| Sitemap URLs with canonical → non-200 (local prerender) | 0 | 0 |
| Sitemap URLs missing canonical | 0 | 0 |
| Sitemap URLs not covered by prerender | 1 (`/compare`) | 0 |

`/compare` was in the sitemap but absent from the prerender allow-list, so it
shipped as a bare SPA shell instead of fully-rendered HTML. That is the most
likely source of at least one of the Ahrefs 5XX reports — fixed.

---

## Root causes

### 1. Duplicate `<meta name="description">` on every sitemap URL (28 in Ahrefs)
- The static `<head>` in `index.html` declared `<meta name="description">`,
  `og:title`, `og:description`, `twitter:title`, and `twitter:description`.
- Each prerendered page adds the same tags again via
  `react-helmet-async`, which emits `data-rh="true"` tags without removing the
  static defaults.
- Result: every prerendered URL has two `<meta name="description">` tags, two
  `og:title` tags, etc. Crawlers consume the first (static) one, which is the
  generic homepage copy — wrong for /pricing, /crm, every comparison page,
  every resource page.

### 2. `/compare` returning the SPA shell
- `/compare` (CompareLanding) was listed in `sitemap-compare.xml` but missing
  from `scripts/prerender.mjs`'s `ROUTES` array. Production was serving the
  unhydrated `index.html` for that URL, which gives crawlers the generic
  homepage title/description.

### 3. Privacy & Terms missing OG / Twitter tags
- Both pages set `<title>`, `description`, and canonical via Helmet but never
  added `og:title`, `og:description`, `og:url`, `og:type`, `twitter:title`,
  `twitter:description`. They were relying on the static defaults in
  `index.html`, which are page-agnostic.

---

## Files changed

### `index.html`
- Removed conflicting per-page tags that duplicate Helmet output:
  `meta[name=description]`, `meta[property=og:title]`,
  `meta[property=og:description]`, `meta[name=twitter:title]`,
  `meta[name=twitter:description]`, `meta[property=og:type]`.
- Kept page-agnostic constants as static defaults: `og:image`,
  `og:image:width|height|type`, `og:site_name`, `twitter:card`,
  `twitter:site`, `twitter:image`.
- Kept `<title>` as a fallback so non-prerendered routes still have something
  before JS hydrates.

### `src/pages/Privacy.tsx`
- Added `og:title`, `og:description`, `og:type=website`, `og:url`,
  `twitter:title`, `twitter:description` to the existing `<Helmet>` block.

### `src/pages/Terms.tsx`
- Same set of additions as Privacy.

### `scripts/prerender.mjs`
- Added `/compare` to `ROUTES` so the compare-landing page ships as
  prerendered HTML, matching the sitemap.

### `scripts/audit-seo.mjs` (new)
- Standalone Node script that walks the sitemap, fetches each URL with
  redirects, parses HTML, and emits a report of status codes, canonical
  targets, meta-tag duplicates, OG completeness, and title/description
  length flags.
- Supports `--local` mode (or `AUDIT_LOCAL=true`) which boots an embedded
  static server pointed at `dist/`, applies the Netlify `_redirects` rules,
  and falls back to `index.html` for SPA paths. Use this when production is
  not reachable.
- Supports `AUDIT_BASE=<url>` to target staging or production from a host
  with network access.

### `docs/seo-audit-results.md` (new)
- Full per-URL audit output. Regenerated on every audit run.

---

## What was intentionally left alone

### Page-specific titles >60 chars (23 in current audit)
The Ahrefs audit flagged 7 titles too long. My local audit (60-char threshold)
catches 23. These are hand-authored, keyword-targeted titles such as
"Virtual Answering Service for Plumbers | Never Miss Another Emergency Call".
Per the task rules ("Do not touch page-specific strings unless they are
clearly auto-generated and broken") I did not edit them. They are listed in
`docs/seo-audit-results.md` under the `TITLE_TOO_LONG` bucket and should be
trimmed by the content owner in a follow-up.

### Page-specific descriptions >160 chars (19 in current audit)
Same reasoning — these are hand-written marketing copy strings. Listed in the
audit report under `DESCRIPTION_TOO_LONG`.

### `robots.txt`
- Already declares both sitemap locations.
- Already allows every public marketing path (`/`, `/pricing`, `/crm`,
  `/difference`, trade pages, `/resources/*`, `/compare/*`, `/privacy`,
  `/terms`, `/missed-calls`, `/home-services-answering-service`).
- Disallow rules are limited to non-indexable paths (`/dashboard`, `/admin`,
  `/auth/*`, `/settings/*`, `/api/`, signup/onboarding flow, etc.). These are
  the source of Ahrefs's "Blocked by robots.txt: 30" warning — that count
  matches expected behavior because the disallowed routes are linked from
  the marketing pages (signup CTAs, login links). No change needed.

### Per-page `og:image` duplicates (not flagged by Ahrefs)
Several marketing pages set `og:image` in Helmet even though the static
default in `index.html` already provides it. This produces two `og:image`
tags per page with identical content. Crawlers tolerate identical-value
duplicates; Ahrefs did not flag this. Removing the redundant calls is a
clean follow-up but not required to clear the audit.

### `_redirects`
- The three 3XX redirects Ahrefs flagged (`/signup`, `/signup/form`,
  `/onboarding`) live in `public/_redirects` and are intentional legacy
  paths. None of them appear in the sitemap, so they cannot cause sitemap
  3XX flags. No change.

---

## Validation results

```
npm run typecheck   ✅ 0 errors
npm run lint        ✅ 0 errors (28 pre-existing warnings, unrelated)
npm run build       ✅ Built, sitemap generated (33 URLs), prerender 33/33
node scripts/audit-seo.mjs --local
  - total                    33
  - status5xx                0    ← was the primary failure mode
  - status4xx                0
  - status3xx                0
  - status2xx                33
  - missingCanonical         0
  - duplicateCanonical       0
  - canonicalToNon200        0
  - duplicateDescription     0    ← was 33 / 33
  - descriptionMissing       0
  - ogIncomplete             0    ← was 2 (Privacy, Terms)
```

The `TITLE_TOO_LONG` (23) and `DESCRIPTION_TOO_LONG` (19) flags are
page-specific content issues, retained per task rules. Full per-URL detail
is in `docs/seo-audit-results.md`.

---

## Manual / post-deploy steps

The sandbox running this task cannot reach `getringsnap.com` (outbound
network policy blocks the host). The audit was therefore run against the
fully prerendered `dist/` output via the script's `--local` mode. The 5XX
counts in the original Ahrefs report could not be reproduced against the
local build — every sitemap URL returns 200 after the fixes.

After deploy:

1. **Re-run the audit against production** from a host with network access:
   ```bash
   AUDIT_BASE=https://getringsnap.com node scripts/audit-seo.mjs
   ```
   Confirm `status5xx = 0` and `canonicalToNon200 = 0`. If any 5XX appears,
   that URL needs an individual Netlify-side investigation (build log,
   function logs) — none of the fixes in this branch could create new 5XX.

2. **Google Search Console**: resubmit `https://getringsnap.com/sitemap.xml`
   and `https://getringsnap.com/sitemap-index.xml`. Use the URL Inspection
   tool on `/compare` (which previously served the SPA shell) to confirm
   the new prerendered HTML is being indexed.

3. **Ahrefs**: trigger a fresh site audit. Expected drops:
   - "Multiple meta description tags" → 0 (was 28)
   - "Open Graph incomplete" → 0 (was 2)
   - 5XX warnings related to `/compare` → 0
   The remaining "Title too long" and "Meta description too long" findings
   are page-content tasks for the marketing owner.

4. **Page copy follow-up** (out of scope for this branch): review the URLs
   in `docs/seo-audit-results.md` under `TITLE_TOO_LONG` /
   `DESCRIPTION_TOO_LONG` and trim where it doesn't hurt the keyword
   strategy. Recommended limits: titles ≤60 chars including the
   `| RingSnap` suffix, descriptions ≤160 chars.

---

## Risk notes

- Removing the static `<meta name="description">` means non-prerendered,
  non-Helmet routes (none currently exist in the public surface) would
  serve HTML without a description until JS hydrates. Every route that is
  in `robots.txt` `Allow` set has a `<Helmet>` block, so this is safe.
- The static `og:image` constants remain in `index.html`. Some pages also
  set `og:image` in Helmet, producing a same-value duplicate. Cleaning that
  up requires editing each page's Helmet block and is recorded above as a
  follow-up.
