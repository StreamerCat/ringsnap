# Technical SEO / AEO hardening — Fix Plan

Source: SEO + answer-engine discoverability request. No product/logic changes.

## Tasks — DONE
- [x] 1. Single route source of truth: `scripts/prerender.mjs` no longer keeps its own `ROUTES` array; it derives routes from `getSortedIndexableRoutes()` in `scripts/seo-routes.js`, so sitemap entries and prerendered pages cannot drift (38/38 prerendered).
- [x] 2. Removed the monolithic `public/sitemap.xml`. Only `sitemap-index.xml` + `sitemap-core/resources/compare.xml` remain; `generate-sitemap.js` writes those four with a dynamic build-date `lastmod`. `robots.txt` advertises only `sitemap-index.xml`; `_redirects` 301s `/sitemap`, `/sitemap.xml`, `/sitemap_index.xml` → index and passthrough-200s the four real files; `_headers` sets XML content-type for each. `check-sitemap-coverage.mjs`, `check-sitemap-serving.mjs`, `check-robots.mjs`, `audit-seo.mjs` and the smoke spec updated to the split model (and coverage now fails if the monolith reappears).
- [x] 3. Real social share image: `scripts/generate-og-image.mjs` renders `public/og-image-1200x630.png` (1200x630). Default tags in `index.html` plus every marketing Helmet block now use it with `og:image:width` 1200 / `og:image:height` 630. Square icon kept for favicons/manifest and the JSON-LD `SoftwareApplication` image.
- [x] 4. `src/pages/Difference.tsx`: dropped the `featureFlags.enhancedMarketingSchema` gate — `serviceSchema` and the differentiation FAQ schema always render.
- [x] 5. Freshness: `ResourceLayout.tsx` Article schema falls back `dateModified = datePublished`. `llms.txt` header date refreshed, pricing block matched to the live `/pricing` page ($59/$129/$229/$449 + trial wording), sitemap URL updated, and `/contractor-answering-service`, `/after-hours-answering-service`, `/missed-call-recovery`, `/handyman` added to Key Pages. `ai.txt` Pro price corrected to $449.
- [x] 6. `robots.txt` AI-crawler blocks reduced to `Allow: /` + the private-area `Disallow` rules (dashboard, admin, auth, api, settings) for all six agents.

## QA
- [x] `npm run build` (prerender 38/38)
- [x] `npm run check:seo` (robots + 38 URLs across 3 segments + serving)
- [x] `npm run typecheck`
- [x] `npm run lint` (0 errors; pre-existing warnings only)
- [ ] `npm test` — vitest hangs before collecting any test in this environment; reproduced identically on `origin/main`, so it is pre-existing and unrelated to these changes.

## Review notes
- Coverage check is now bidirectional: every indexable route appears in exactly one segment, and any sitemap URL not in `INDEXABLE_ROUTES` fails the check.
