# SEO Indexing Investigation (April 12, 2026)

## Problem Statement
Google is reporting that public RingSnap pages are not being indexed.

## Investigation Summary

### 1) robots.txt is not blocking public marketing routes
- `public/robots.txt` allows `/` for Googlebot and blocks internal app/auth paths like `/dashboard`, `/admin`, `/auth/`, `/settings/`, and `/api/`.
- This configuration is directionally correct for excluding internal pages while allowing public pages.

### 2) Sitemap includes public marketing/content routes
- `public/sitemap.xml` includes the homepage, marketing pages, trade pages, resource center pages, CRM page, and comparison pages.
- This means discovery hints exist for indexable pages.

### 3) Root cause found: production builds can skip prerender entirely
- `scripts/prerender.mjs` explicitly skipped prerendering whenever CI/Netlify/Vercel was detected.
- Netlify production builds run in CI-like environments, so route-level prerendered HTML was never generated for deployment.
- Without prerender output, crawlers initially receive the SPA shell (`index.html` with minimal body content) and must rely on JavaScript rendering. This increases risk of delayed indexing, soft-404-like quality signals, and URL-level canonical/meta inconsistency at crawl time.

## Why this can look like “all pages not indexed”
When a JS-heavy SPA serves nearly identical HTML to every route at first response, Google can treat many URLs as low-value/duplicate while deferring or reducing render-based indexing. This often appears in Search Console as broad non-indexing even when robots/sitemap are technically present.

## Fix Implemented in This Change
1. **Enable prerender in production CI builds** by removing the unconditional CI skip in `scripts/prerender.mjs`.
2. **Use a crawler-safe render wait strategy**:
   - changed `waitUntil` from `networkidle0` to `domcontentloaded`
   - added deterministic stabilization wait
   - prevents hangs caused by long-lived sockets while still capturing fully rendered route HTML.
3. **Preserve non-indexing for internal pages**:
   - prerender route list remains limited to known public/indexable routes only.
   - internal routes continue to be excluded via robots disallow + page-level noindex where applicable.
4. **Keep CI checks stable while protecting production SEO**:
   - CI pre-check pipelines can skip prerender by default, while production deploys can enforce strict prerendering by setting `REQUIRE_PRERENDER=true` (with optional emergency override `ALLOW_PRERENDER_SKIP=true`).

## Rollout / Validation Plan
1. Deploy build.
2. Confirm prerendered files exist in deploy artifact (e.g., `/pricing/index.html`, `/resources/index.html`).
3. Validate live headers and robots/sitemap:
   - `https://getringsnap.com/robots.txt`
   - `https://getringsnap.com/sitemap.xml`
4. In Google Search Console:
   - inspect 5–10 representative public URLs
   - request indexing for homepage + top templates (`/pricing`, `/difference`, `/resources`, `/crm`, one `/compare/*` page)
   - monitor “Crawled - currently not indexed” and “Discovered - currently not indexed” over 7–14 days.

## Guardrails (Recommended Next)
- Add CI assertion that critical public route files are prerendered in `dist/<route>/index.html` before deployment.
- Keep source-of-truth public route list centralized (already partly done in `scripts/seo-routes.js`) and reuse it across sitemap + prerender route generation.
