# UI/UX Design Audit — Fix Plan

Source: design audit (see conversation). No functional/logic changes; visual only.

## Phase 1 — High impact, low effort — DONE
- [x] Gray-scale → charcoal-tinted tokens on light-background pages (Privacy, Terms, NotFound, TrialConfirmation, Onboarding step indicators, SalesCustomerPanel badge, JobberIntegration dot).
      NOTE: scoped down from original finding — AccountsTab/AlertsTab/StaffTab/CallsTab/TrialsTab/OverviewTab/MarginsTab/SettingsTab(admin)/BillingTab(admin)/AdminSidebar/AdminKpiCard/AdminControl
      turned out to be one deliberate, internally-consistent dark ops-console theme (bg-gray-900/800/950 base), not stray defaults — left untouched to avoid a large, risky, out-of-scope theme rewrite of an internal tool.
- [x] Hero CTA hierarchy: primary filled pill (hover:bg-terracotta-dark) vs. true secondary ghost-style pill, no competing white/bordered "second primary" (ContractorHero.tsx)
- [x] Removed unused/dead infinite-pulse CSS: `.btn-pulse`, `.btn-pulse-cta`, `.card-pricing-popular` + `pricing-glow` keyframes, `.animate-pulse-subtle` + `pulse-badge` keyframes — confirmed none referenced in any .tsx before deleting
- QA: typecheck clean, lint clean (0 new warnings/errors), build clean, 307 unit tests pass, visual spot-check via Playwright screenshots (home hero, /privacy, 404) confirms no regressions

## Phase 2 — High impact, medium effort — DONE
- [x] Radius consolidation on the public marketing/customer-facing surface: `rounded-xl`/`rounded-3xl` → `rounded-2xl` across 43 files (pages, marketing components, resources, compare, trades hero). Result: cards uniformly 16px, controls stay on the existing `rounded-lg`/`rounded-md` tier, pills stay `rounded-full`. `rounded-3xl` eliminated app-wide; `rounded-xl` reduced from 125 to 7 (remaining 7 are inside the internal admin/dashboard/wizard/onboarding tooling, intentionally out of scope — see Phase 1 note).
      Scope note: did NOT touch radius inside admin/dashboard/onboarding/wizard/signup/sales/settings tooling — same reasoning as Phase 1 (deliberate/internal, high risk to rewrite wholesale, low brand-visibility).
- QA: typecheck clean, lint clean (same pre-existing warnings only), build clean, 307 unit tests pass, visual spot-check via Playwright screenshots (home, /crm, /resources) confirms consistent card radius, no broken layouts

## Phase 3 — Medium impact, low effort — DONE
- [x] Deleted dead `.aura-purple` and `.gradient-accent` CSS (confirmed zero references in any .tsx before removing)
- [x] ContractorHero background: removed the second (charcoal) blob, kept one restrained terracotta accent at lower opacity (0.10 → 0.07)
- QA: typecheck/lint/test clean, visual spot-check confirms calmer, single-accent hero background, no layout shift

## Phase 4 — Medium impact, medium effort — DONE
- [x] Deleted dead `.elevation-1..4` and `.card-premium` (0 references anywhere) — kept `.card-tier-1/2/3` as the one shadow/elevation system (42 active references across 17 files)
- [x] Converted `.card-tier-*`, `.card-glow-terracotta`, `.calculator-result-card:hover`, `.image-enhanced` hardcoded `rgba(217,119,87,x)` / `rgba(44,54,57,x)` / `rgba(244,232,216,x)` / `rgba(0,0,0,x)` shadow literals to `hsl(var(--terracotta)/x)`, `hsl(var(--charcoal)/x)`, `hsl(var(--cream)/x)` — same colors (verified they were the token's own RGB equivalents), now token-driven and brand-tinted instead of hardcoded/pure-black
- [x] Fixed `.card-tier-1` still using `rounded-3xl` (missed by the Phase 2 .tsx-only sweep since it lives in CSS) → `rounded-2xl`, consistent with the rest of the tier system
- [x] Deleted dead `.text-display`/`.text-headline`/`.text-subhead` (only 1 reference app-wide) — migrated that one use (EmergencyCalculator.tsx `text-headline` → `text-h2`) and kept `.text-h1/h2/h3/page-h1` as the one heading system (42 references across 14 files)
- QA: typecheck clean, lint clean, build clean, 307 unit tests pass, visual spot-check via Playwright (pricing "Core" popular card, home testimonials) confirms shadows/radius/typography render identically to before

## Summary
All 4 phases complete and verified. Scope was narrowed twice from the original audit text (see notes above) to avoid touching a deliberate, self-consistent internal dark admin console — narrowing kept every change to genuinely off-brand/dead code on the customer-facing surface, in line with "must not break anything."

## QA per phase
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm test` (unit)
- [ ] Visual spot-check via dev server / screenshot of affected pages
- [ ] Confirm no className/behavior removed from interactive elements (buttons/links/forms retain handlers)

## Review notes
(filled in as we go)
