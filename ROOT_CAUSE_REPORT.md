# SEO & Indexing Diagnosis and Fix Report

**Last Updated:** 2026-01-28

## 1. Root Cause Analysis

### A. Primary Issue: SPA Not Prerendered

- **Problem**: Google reported pages as "Discovered - not indexed"
- **Root Cause**:
  - The site is a Single Page Application (SPA) that returns an empty `<div id="root"></div>` shell
  - Googlebot must execute JavaScript to see content, which:
    - Delays indexing (sometimes by weeks)
    - Can fail for complex SPAs
    - Makes pages invisible to AI search engines that don't render JavaScript
  - Internal pages were missing consistent navigation (SiteHeader)

### B. Secondary Issues Identified

1. **Missing SiteHeader on Trade Pages**: Plumbers, HVAC, Electricians, Roofing pages lacked the site header, reducing internal linking signals
2. **URL Inconsistency**: Schema markup mixed `www.getringsnap.com` and `getringsnap.com`
3. **No AI Crawler Support**: robots.txt didn't include rules for GPTBot, Claude, Perplexity, etc.
4. **Outdated Sitemap**: Static dates instead of current build dates

## 2. Implemented Fixes

### A. **Prerendering at Build Time** (Critical Fix)

- **What**: Created `scripts/prerender.mjs` using Puppeteer
- **How**: Runs automatically during `npm run build` after sitemap generation
- **Details**:
  - Spins up a local static server
  - Uses headless Chrome to render each marketing page
  - Saves fully-rendered HTML with all React content
  - Adds `data-prerendered="true"` attribute to identify prerendered pages
- **Pages Prerendered**:
  - `/` (Homepage)
  - `/pricing`
  - `/difference`
  - `/plumbers`
  - `/hvac`
  - `/electricians`
  - `/roofing`
  - `/privacy`
  - `/terms`
- **Benefit**: Google now receives fully-rendered HTML immediately, enabling fast and reliable indexing

### B. **SiteHeader Added to Trade Pages**

- **What**: Added consistent navigation header to all 4 trade landing pages
- **Files Updated**:
  - `src/pages/trades/Plumbers.tsx`
  - `src/pages/trades/HVAC.tsx`
  - `src/pages/trades/Electricians.tsx`
  - `src/pages/trades/Roofing.tsx`
- **Benefit**: Improves internal linking structure, helping Google discover and value these pages

### C. **URL Consistency Fixed**

- **What**: Updated `Index.tsx` structured data to use consistent `getringsnap.com` (without www)
- **Items Fixed**:
  - Organization schema URL and logo
  - WebSite schema URL
  - SearchAction target URL
  - SoftwareApplication image URL
- **Benefit**: Prevents canonicalization confusion

### D. **AI Search Crawler Support**

- **What**: Updated `robots.txt` with explicit rules for AI crawlers
- **Crawlers Added**:
  - `GPTBot` (OpenAI/ChatGPT)
  - `ChatGPT-User`
  - `Claude-Web` (Anthropic)
  - `anthropic-ai`
  - `Perplexitybot`
- **Benefit**: Improves visibility in AI-powered search experiences

### E. **Enhanced AI Discovery Files**

- **What**: Comprehensive updates to `ai.txt` and `llms.txt`
- **Details**:
  - Added product summary and key features
  - Listed pricing information
  - Included all page URLs
  - Clear usage policies for AI systems
- **Benefit**: AI systems can accurately understand and recommend RingSnap

### F. **Improved Build Pipeline**

- **What**: Updated build process in `package.json`
- **Scripts**:
  - `build`: Full production build with prerendering
  - `build:no-prerender`: Quick build without prerendering (for testing)
  - `build:sitemap`: Sitemap generation only
  - `build:prerender`: Prerendering only
- **Benefit**: Flexible build options for different scenarios

### G. **Netlify Configuration Optimized**

- **What**: Updated `netlify.toml` and `public/_redirects`
- **Changes**:
  - Added caching headers for SEO files (sitemap, robots, ai.txt, llms.txt)
  - Set appropriate cache headers for prerendered pages
  - Configured redirects to serve prerendered HTML for marketing routes
- **Benefit**: Better performance and proper content delivery

## 3. Post-Fix Verification

### What to Check After Deployment

1. **Verify Prerendered HTML**:

   ```bash
   curl -s https://getringsnap.com/pricing | head -20
   # Should show actual HTML content, not just <div id="root"></div>
   ```

2. **Google Search Console**:
   - Go to **Sitemaps** → Submit `https://getringsnap.com/sitemap.xml`
   - Use **URL Inspection** → Enter `/pricing` → Click "Request Indexing"
   - Monitor **Pages** report for "Discovered - currently not indexed" to decrease

3. **Test AI Visibility**:
   - Ask ChatGPT: "What is RingSnap?"
   - Ask Perplexity: "RingSnap virtual receptionist for contractors"
   - Check if accurate information is returned

4. **Lighthouse SEO Audit**:

   ```bash
   npx lighthouse https://getringsnap.com --only-categories=seo
   ```

## 4. Expected Timeline

- **Immediate**: Prerendered HTML visible to crawlers
- **24-48 hours**: Sitemap reprocessed by Google
- **1-2 weeks**: Marketing pages move from "Discovered" to "Indexed"
- **2-4 weeks**: Improved rankings for target keywords

## 5. Technical Details

### Prerender Script Architecture

```
npm run build
    ├── vite build          # Creates SPA bundle in dist/
    ├── build:sitemap       # Generates sitemap.xml
    └── build:prerender     # Prerenders 9 marketing pages
        ├── Starts local server on port 8787
        ├── Launches Puppeteer (headless Chrome)
        ├── For each route:
        │   ├── Navigate to page
        │   ├── Wait for React hydration
        │   ├── Extract rendered HTML
        │   └── Save to dist/[route]/index.html
        └── Cleanup and report results
```

### File Changes Summary

| File | Change |
|------|--------|
| `scripts/prerender.mjs` | NEW - Puppeteer prerendering script |
| `scripts/generate-sitemap.js` | Updated - Improved formatting, writes to dist |
| `package.json` | Updated - Added prerender build scripts |
| `vite.config.ts` | No change - kept simple, prerender is post-build |
| `public/robots.txt` | Updated - Added AI crawler rules |
| `public/ai.txt` | Updated - Comprehensive AI guidance |
| `public/llms.txt` | Updated - Full product documentation |
| `public/_redirects` | Updated - Routes prerendered pages |
| `netlify.toml` | Updated - Caching headers for SEO files |
| `src/pages/trades/*.tsx` | Updated - Added SiteHeader to all 4 pages |
| `src/pages/Index.tsx` | Updated - Fixed www/non-www URL inconsistency |

## 6. Maintenance Notes

- **Keep Routes in Sync**: If adding new marketing pages, update:
  1. `scripts/prerender.mjs` - ROUTES array
  2. `scripts/generate-sitemap.js` - routes array
  3. `public/_redirects` - add redirect rule
  
- **Build Time**: Prerendering adds ~30-60 seconds to build (depending on page complexity)

- **CI/CD**: Ensure CI environment has Chrome/Chromium available (Puppeteer needs it)
