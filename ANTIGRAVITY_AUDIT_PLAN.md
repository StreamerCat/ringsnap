# RingSnap Audit & Plan

## 1. Executive Summary
This document serves as the baseline audit and implementation plan for improving RingSnap's performance, SEO, accessibility, and mobile UX.
**Goal**: Production-ready, optimized infrastructure with autonomous monitoring.

---

## 2. Baseline Audit (Static Analysis)

### Homepage (`Index.tsx` & `ContractorHero.tsx`)
*   **Performance**: 
    *   Good use of `React.lazy` for below-the-fold components.
    *   Images (logo, backgrounds) need verification for modern formats (WebP) and explicit sizing to prevent layout shifts (CLS).
    *   `lucide-react` icons are used; ensure tree-shaking is active.
*   **SEO**:
    *   **Double H1 Issue**: `Index.tsx` defines a hidden H1 (`sr-only`) while `ContractorHero.tsx` defines a visible H1. This can confuse search engines and screen readers.
    *   **Meta Tags**: Good coverage (Title, Description, Canonical, OG, Twitter).
    *   **Schema**: Excellent implementation of JSON-LD (Organization, WebSite, FAQPage).
*   **Accessibility**:
    *   "Skip to main content" link present.
    *   Color contrast on "Charcoal" text looks good, but `hsl` values need verification against WCAG AA.

### Onboarding (`Start.tsx` & `OnboardingChat.tsx`)
*   **Performance**: 
    *   `OnboardingChat.tsx` is a large component (~1300 lines). Risk of large initial download for that route.
    *   Stripe Elements loaded; ensure it is only loaded when payment step is imminent (or efficiently).
*   **UX/Mobile**:
    *   Inputs use `text-base` (good for iOS).
    *   Touch targets look appropriate (`h-12`).
*   **Accessibility**:
    *   Chat interface needs `aria-live` regions for new messages to be announced to screen readers.
    *   Contrast on user/assistant message bubbles needs verification.

### Core Issues Identified
1.  **Duplicate H1 tags** on Homepage.
2.  **Large Bundle Size risk** in Onboarding chat (should be lazy loaded or split).
3.  **Missing Runtime Audit Tools**: No `lighthouse` or `axe` scripts currently.
4.  **Image Optimization**: Potential for using `vite-plugin-image-optimizer` or similar.

---

## 3. Implementation Plan

### Phase 1: Infrastructure (Immediate)
*   Add `npm run audit:*` scripts using `lighthouse` (CLI) and `axe-core`.
*   Establish baseline measures.

### Phase 2: Performance
*   **Code Splitting**: Break `OnboardingChat` into sub-components.
*   **Image Opt**: Ensure all static assets are WebP/AVIF. Add `width`/`height` attributes.
*   **Bundle Analysis**: Run `vite-bundle-visualizer` to identify heavy dependencies.

### Phase 3: SEO Hardening
*   **Fix H1s**: Consolidate to a single, descriptive H1 per page.
*   **Sitemap**: Ensure `sitemap.xml` generation is automated or accurate. (Currently `public/site.webmanifest` exists, need to check for sitemap).

### Phase 4: Mobile UX & A11y
*   **Chat A11y**: Add `aria-log` or `aria-live` to chat container.
*   **Contrast**: Audit colors using `axe`.

---

## 4. Automation Recommendations
For the **Performance Guardian Agent**:
1.  It should run `npm run audit:perf` after deployments.
2.  Parse the JSON output from Lighthouse to fail builds if Score < 90.
