# SEO & Indexing Diagnosis and Fix Report

## Summary

Google indexed few pages; SERP snippets were outdated. Specific CWV field data requires a minimum threshold of Chrome User Experience Report (CrUX) data (real user traffic). No data in GSC is normal for low-traffic sites.

This PR ensures Google can reliably discover, crawl, and select ALL intended public marketing pages for indexing, and ensures CWV eligibility where possible.

## Root Cause

- **Sitemap**: The `sitemap.xml` was manually maintained and static. It might have been outdated or missing new pages.
- **SPA Architecture**: Status 200 for all routes (soft 404s). If Googlebot hits a bad URL, it sees 200, which is confusing.
- **Internal Linking**: Links were standard `<a>` tags causing full page reloads, hurting Core Web Vitals (LCP) and user experience.

## Changes

### A. Automated Sitemap Generation

- Created `scripts/generate-sitemap.js`.
- It runs automatically during `npm run build`.
- Generates a clean `sitemap.xml` including all marketing pages (`/`, `/pricing`, `/difference`, `/plumbers`, etc.) and legal pages (`/privacy`, `/terms`).

### B. Soft 404 Prevention

- Verified that `NotFound.tsx` component includes `<meta name="robots" content="noindex, nofollow" />`.

### C. Discovery & CWV Improvements

- Updated `ContractorFooter.tsx` to use `react-router-dom`'s `<Link>`.
- Internal navigation is now instant (client-side), drastically improving LCP and CLS for users browsing multiple pages. Anchor links (`/#solution`) were fixed to ensure they work from deep pages.

### D. Canonical & Meta

- Verified `Index.tsx` contains rich Structured Data (`Organization`, `WebSite`, `FAQPage`).
- Verified Canonical tags indicate `https://getringsnap.com` as the primary host.

## Testing

- [x] Run `npm run build` and verify `sitemap.xml` is generated with current date.
- [x] Verify internal links in Footer navigate without full page reload.
- [x] Verify anchor links in Footer scroll correctly on Home and navigate correctly from other pages.

## Rollback

Revert changes to `package.json` and `src/components/ContractorFooter.tsx`. Delete `scripts/generate-sitemap.js`.

## Checklist

- [x] Branch pushed
- [ ] PR merged to main
- [ ] Resubmit sitemap in GSC
