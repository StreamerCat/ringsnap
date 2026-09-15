# RingSnap organic and AI-search acquisition plan

## Objective

Grow qualified trial starts from contractors looking for an AI receptionist, after-hours call coverage, missed-call recovery, or dispatcher scripts. Optimize for completed trials and activated accounts, not traffic alone.

## Audit findings

| Area | Status | Decision |
| --- | --- | --- |
| Crawlability | Strong: robots, sitemap, prerendering, canonical tags | Preserve and monitor on every release. |
| Intent coverage | Strong for core trades, comparisons, and dispatcher tools | Expand only around high-intent gaps, beginning with commercial after-hours trade pages. |
| AI discoverability | `llms.txt`, structured data, and public crawler access exist | Keep public product facts current and make pages easy to quote. |
| Authority | Weak: RingSnap rarely appears in independent category roundups | Prioritize credible third-party mentions, customer proof, and partner listings. |
| Attribution | UTM fields exist but AI and organic traffic are not consistently grouped | Implemented: `acquisition_channel` and `referrer_domain` on PostHog events. |

## Positioning to own

**AI receptionist for home-service contractors that captures, qualifies, routes, and books the calls crews cannot answer.**

Do not compete broadly on “AI receptionist for small business.” Lead with contractor urgency: after-hours jobs, emergency routing, dispatcher-quality intake, and Jobber-connected follow-up.

## 90-day execution

### Days 0–14: make the funnel measurable and trustworthy

1. Use the new PostHog properties to create one weekly view: sessions, trial starts, trial completion, activation, and paid conversion by `acquisition_channel`, landing page, and trade.
2. Keep pricing, capabilities, and setup claims identical across the pricing page, homepage, schema, and `llms.txt`. Remove or qualify any claim that cannot be demonstrated.
3. Add 2–3 attributable customer proof assets only after written permission: trade, location/market, before/after call handling, implementation time, and a direct quote.

### Days 15–45: win high-intent pages

Publish one decision-grade page per week. Each page needs a direct answer in the first paragraph, a trade-specific call flow, pricing/implementation facts, FAQs, internal links to a tool or comparison, and one clear trial CTA.

Priority sequence:

1. HVAC after-hours answering service
2. Plumbing after-hours answering service
3. Emergency call routing for contractors
4. AI receptionist for Jobber users
5. Missed-call text-back and recovery for home services

Avoid thin city pages, generic AI explainers, and unverified “best” claims. They create low-quality inventory and do not build answer-engine trust.

### Days 30–90: build independent authority

1. Create an accurate public profile wherever contractors actually evaluate software: Jobber ecosystem listings, relevant trade publications, review platforms, and credible AI-receptionist comparison authors.
2. Offer the free dispatcher scripts/calculators as source material to trade newsletters, podcasts, and associations. Ask for a contextual link, not a generic directory listing.
3. Run a small quarterly original-data report from anonymized, aggregate call data only after privacy review. Useful examples: after-hours call mix by trade or top emergency-intake questions. Original data creates citations that generic product copy cannot.

## Measurement and decision rules

| Metric | Target / action |
| --- | --- |
| Organic or AI trial-start rate | Improve the page/CTA before adding more content if it is below the site median for four weeks. |
| Trial completion | Keep at or above 90%; a lower rate is a product-funnel issue, not a traffic issue. |
| Activated accounts by landing page | Expand topics that generate activation, not only form submits. |
| Independent referring domains | Add only relevant, editorial, or partner citations. Reject paid link schemes and low-quality directories. |
| AI assistant referral conversions | Track separately, but treat missing referrer data as normal; tagged partner links are the reliable supplement. |

## Operating cadence

- Weekly: inspect the PostHog view, Search Console query/page changes, indexed-page errors, and trial-quality by landing page.
- Monthly: refresh one winning page with real product changes and prune or consolidate any page that has no qualified visits or links after 90 days.
- Quarterly: publish one original, permissioned proof asset or data-led resource and pitch it to a focused trade audience.

## Completed in this change

- Added durable acquisition classification to all targeted PostHog events.
- Added a written, measurable content and authority plan that prevents low-value SEO work.
