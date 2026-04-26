# RingSnap — Product Surface
_Source of truth derived from codebase. Generated 2026-04-25._

✅ CONFIRMED | ⚠️ INFERRED | ❓ UNKNOWN

---

## Public Marketing Pages

| Route | File | Purpose |
|---|---|---|
| `/` | `src/pages/Index.tsx` | Homepage — hero, missed-call calculator, voice demo, testimonials, competitor comparison, pricing teaser |
| `/pricing` | `src/pages/Pricing.tsx` | Full pricing page — plan cards, feature comparison, FAQ |
| `/difference` | `src/pages/Difference.tsx` | "Why RingSnap" — structured data, interactive demo (legacy toggle via `VITE_USE_LEGACY_DIFFERENCE_INTERACTIVE`) |
| `/privacy` | `src/pages/Privacy.tsx` | Privacy policy |
| `/terms` | `src/pages/Terms.tsx` | Terms of service |

---

## Trade-Specific Landing Pages

All use `getTradeConfig(trade)` helper for SEO copy, pain points, testimonials. Include breadcrumb JSON-LD schema.

| Route | File |
|---|---|
| `/plumbers` | `src/pages/trades/Plumbers.tsx` |
| `/hvac` | `src/pages/trades/HVAC.tsx` |
| `/electricians` | `src/pages/trades/Electricians.tsx` |
| `/roofing` | `src/pages/trades/Roofing.tsx` |

Components: `src/components/trades/TradeHero.tsx`, `TradePainPoints.tsx`, `TradeTestimonials.tsx`

---

## Competitor Comparison Pages

All use `src/components/compare/ComparisonPage.tsx` template (configurable feature matrix, FAQ, pricing, JSON-LD schema).

| Route | File |
|---|---|
| `/compare` | `src/pages/compare/CompareLanding.tsx` — comparison hub |
| `/compare/ringsnap-vs-ruby` | `src/pages/compare/RingSnapVsRuby.tsx` |
| `/compare/ringsnap-vs-smith-ai` | `src/pages/compare/RingSnapVsSmithAi.tsx` |
| `/compare/ringsnap-vs-goodcall` | `src/pages/compare/RingSnapVsGoodcall.tsx` |
| `/compare/ai-receptionist-vs-live-answering` | `src/pages/compare/AiReceptionistVsLiveAnswering.tsx` |
| `/compare/best-ai-receptionist-home-services` | `src/pages/compare/BestAiReceptionistHomeServices.tsx` |

---

## Resource Center (SEO / Lead-Gen)

Hub: `/resources` → `src/pages/resources/ResourceHub.tsx`

All resource pages use `src/components/resources/ResourceLayout.tsx` (TOC, hero, CTA sidebar, copy blocks, benchmark tables, FAQ accordion, related resources, lead-capture download modal).

### Call Scripts (19 pages)

| Route | File |
|---|---|
| `/resources/hvac-dispatcher-script` | `HvacDispatcherScript.tsx` |
| `/resources/plumbing-dispatcher-script` | `PlumbingDispatcherScript.tsx` |
| `/resources/electrician-call-script` | `ElectricianCallScript.tsx` |
| `/resources/hvac-after-hours-script` | `HvacAfterHoursScript.tsx` |
| `/resources/hvac-price-shopper-script` | `HvacPriceShopperScript.tsx` |
| `/resources/hvac-emergency-triage` | `HvacEmergencyTriage.tsx` |
| `/resources/burst-pipe-call-script` | `BurstPipeCallScript.tsx` |
| `/resources/sewer-backup-call-script` | `SewerBackupCallScript.tsx` |
| `/resources/drain-cleaning-upsell-script` | `DrainCleaningUpsellScript.tsx` |
| `/resources/electrical-safety-triage` | `ElectricalSafetyTriage.tsx` |
| `/resources/panel-upgrade-booking-script` | `PanelUpgradeBookingScript.tsx` |
| `/resources/power-outage-call-script` | `PowerOutageCallScript.tsx` |

### Calculators (4 pages)

| Route | File | Purpose |
|---|---|---|
| `/resources/missed-call-calculator` | `MissedCallCalculator.tsx` | Revenue impact of missed calls |
| `/resources/after-hours-calculator` | `AfterHoursCalculator.tsx` | After-hours revenue opportunity |
| `/resources/service-pricing-calculator` | `ServicePricingCalculator.tsx` | Service pricing tool |
| `/resources/average-ticket-planner` | `AverageTicketPlanner.tsx` | Average ticket value optimizer |

---

## Signup / Trial Paths

### Two-Step Signup (✅ CONFIRMED — `featureFlags.twoStepSignup = true`)

| Step | Route | File | What Happens |
|---|---|---|---|
| 1 | `/start` | `src/pages/Start.tsx` | Minimal lead capture (name + email only). Calls `capture-signup-lead` edge fn. Stores `lead_id` in localStorage key `ringsnap_signup_lead_id`. Redirects to /onboarding-chat. |
| 2 | `/onboarding-chat` | `src/pages/OnboardingChat.tsx` | 11-step AI chat flow: phone → company → trade → website → hours → voice → goal → plan → payment (Stripe Elements) → provisioning poll → complete. Creates account + charges card. |
| 3 | `/setup/assistant` or `/onboarding-status` | `src/pages/ProvisioningStatus.tsx` | Polls `provisioning_status` on account until `completed` or `failed`. Shows progress UI. |
| 4 | `/activation` | `src/pages/Activation.tsx` | "Wow moment." Shows provisioned phone number, test call CTA, call forwarding instructions. Feature-flagged (`activationOnboardingEnabled`). Kill switch: `USE_NEW_FLOW` constant in file. |

### Legacy Signup (⚠️ INFERRED — redirects still present)
- `/signup` → redirects to `/start` via `src/pages/SignupRedirect.tsx`
- `/onboarding` → `src/pages/OnboardingRedirect.tsx` — routes based on auth/onboarding state
- `/activation?legacy=true` → renders `src/pages/LegacyActivation.tsx`

### Sales-Assisted Paths
- `/form-preview` — `src/pages/FormPreview.tsx` — staff preview of signup form
- `/trial-preview` — `src/pages/TrialFlowPreview.tsx` — staff preview of trial flow
- Sales wizard: `src/components/wizard/SalesSignupWizard.tsx` — multi-step staff-guided signup

---

## Authentication Pages

| Route | File | Purpose |
|---|---|---|
| `/login`, `/auth/login`, `/signin` | `src/pages/AuthLogin.tsx` | Login (magic link or password) |
| `/auth/callback` | `src/pages/AuthCallback.tsx` | Google OAuth redirect handler |
| `/auth/magic-callback` | `src/pages/MagicCallback.tsx` | Magic link token consumption |
| `/reset-password` | `src/pages/PasswordReset.tsx` | Password reset form |
| `/auth/staff-invite` | `src/pages/StaffInvite.tsx` | Staff invite acceptance + credential creation |
| `/settings/security` | `src/pages/SecuritySettings.tsx` | 2FA and security settings |

---

## Customer Dashboard (`/dashboard`)

File: `src/pages/CustomerDashboard.tsx`
Guard: `withAuthGuard` + `useOnboardingGuard` (redirects to `/activation` if `onboarding_completed_at IS NULL`)

### Dashboard Tabs

| Tab | Component | Content |
|---|---|---|
| overview | `OverviewTab.tsx` | Account summary, provisioning status, key metrics |
| inbox | `InboxTab.tsx` | Recent calls with `CallDetailsDrawer` |
| assistants | `AssistantsTab.tsx` | Vapi assistant config; `AssistantStudio/` for guided setup |
| phone-numbers | `PhoneNumbersTab.tsx` | Provisioned numbers, add-phone flow |
| team | `TeamTab.tsx` | Team member management |
| settings | `SettingsTab.tsx` | Account settings, recording consent, business info |
| billing | `BillingTab.tsx` | Plan management, invoices, payment methods |
| referrals | `ReferralsTab.tsx` | Referral code sharing |
| schedule | `ScheduleTab.tsx` | Schedule/calendar integration |
| calendar | `CalendarTab.tsx` | Calendar view |
| appointments | `AppointmentsTab.tsx` | Appointment management |
| usage | `UsageTab.tsx` | Usage history and billing details |

### Dashboard Sub-Components
- `UpgradeModal.tsx` — plan upgrade (kill switch: `featureFlags.upgradeModalEnabled`)
- `ProvisioningBanner.tsx` — shown while `provisioning_status != completed`
- `OnboardingRecoveryPanel.tsx` — recovery UI for broken onboarding
- `UsageWarningAlert.tsx` — usage limit warning banner
- `CallDetailsDrawer.tsx` — full call detail view

### Assistant Studio (`src/components/dashboard/AssistantStudio/`)
- `StudioLayout.tsx` + `OverviewPanel.tsx` — main layout
- `GuidedSetupChat.tsx` — chat-based assistant configuration
- `AdvancedSettingsForm.tsx` — Pro/premium advanced options

### Billing Components (`src/components/dashboard/billing/`)
- `InvoicesList.tsx` — invoice history
- `PaymentMethodUpdateDialog.tsx` — card update
- `PlanManagement.tsx` — upgrade/downgrade UI

---

## Admin Panel (`/admin`)

File: `src/pages/AdminControl.tsx`
Guard: `withAuthGuard` + staff role check (`platform_admin` or `platform_owner` only)
Legacy redirects: `/admin/monitoring` → `/admin?tab=overview`, `/admin/users` → `/admin?tab=staff`

### Admin Tabs

| Tab | Component | Content |
|---|---|---|
| overview | `OverviewTab.tsx` | KPI cards, system health |
| accounts | `AccountsTab.tsx` | Customer account management, search |
| billing | `BillingTab.tsx` | Billing admin; ⚠️ TODO: MRR historical data not connected to Stripe |
| margins | `MarginsTab.tsx` | Margins and profitability analysis |
| trials | `TrialsTab.tsx` | Trial account tracking and conversion |
| calls | `CallsTab.tsx` | Call analytics across all accounts |
| alerts | `AlertsTab.tsx` | System alerts; ⚠️ TODO: thresholds not persisted to DB |
| staff | `StaffTab.tsx` | Staff role management |
| settings | `SettingsTab.tsx` | Admin settings; ⚠️ TODO: feature flags not yet DB-backed |

---

## Sales Pages

| Route | File | Guard |
|---|---|---|
| `/sales` | `src/pages/Sales.tsx` | `SalesPasswordGate` (env: `VITE_JULES_SECRET`) |
| `/salesdash` | `src/pages/Dashboard.tsx` | ⚠️ INFERRED: sales role check |
| `/crm` | `src/pages/CRM.tsx` | ❓ UNKNOWN: auth requirements |
| `/dashboard/team` | `src/pages/TeamManagement.tsx` | Auth required |
| `/trial-confirmation` | `src/pages/TrialConfirmation.tsx` | Post-signup confirmation |

---

## Settings Pages

| Route | File |
|---|---|
| `/settings/security` | `src/pages/SecuritySettings.tsx` |
| `/settings/integrations/jobber` | `src/pages/settings/integrations/JobberIntegration.tsx` |

---

## Onboarding Components Detail

### Chat Components (`src/components/onboarding-chat/`)
- `ChatMessage.tsx` — message bubble with typing indicator; roles: user / assistant / system
- `ChatInput.tsx` — text input
- `ChatButtons.tsx` — quick-response button options
- `ServiceHoursEditor.tsx` — business hours scheduling widget

### Shared Form Components (`src/components/onboarding/shared/`)
- `UserInfoForm.tsx` / `EnhancedUserInfoForm.tsx` — name, email, phone
- `BusinessBasicsForm.tsx` / `EnhancedBusinessBasicsForm.tsx` — company, trade, website
- `BusinessAdvancedForm.tsx` — advanced settings
- `PaymentForm.tsx` — Stripe Elements CardElement
- `PlanSelector.tsx` — plan selection UI
- `VoiceSelector.tsx` — voice preference (⚠️ TODO: actual voice samples not yet added per `constants.ts`)
- `PhoneReadyPanel.tsx` — provisioned number display + next steps
- `ProvisioningStatus.tsx` — progress polling UI

### Activation Flow
- `src/pages/Activation.tsx` — entry; `USE_NEW_FLOW` constant is kill switch
- `src/components/onboarding/ActivationStepper.tsx` — new guided activation
- `src/pages/LegacyActivation.tsx` — fallback (accessible via `?legacy=true`)
- `useOnboardingGuard()` hook — enforces redirect if `onboarding_completed_at IS NULL`; kill switch: `featureFlags.onboardingGuardEnabled`
- `useOnboardingState()` hook — polls RPC `get_onboarding_state()` with adaptive backoff (5s → 10s → 15s)

---

## Pricing Exposed in Code

### Plan Definitions (✅ CONFIRMED — `src/lib/billing/dashboardPlans.ts`)

| plan_key | $/mo | Included Calls | Overage | Max Overage | Coverage |
|---|---|---|---|---|---|
| night_weekend | $59 | 60 | $1.10/call | 40 calls | After-hours (6PM–8AM + weekends) |
| lite | $129 | 125 | $0.95/call | 50 calls | 24/7 |
| core | $229 | 250 | $0.85/call | 75 calls | 24/7 — "Best Value" |
| pro | $449 | 450 | $0.75/call | 90 calls | 24/7 + enterprise |

⚠️ `scripts/stripe-setup-new-plans.js` hardcodes Pro at $399 — mismatch with dashboard $449.

### Trial (✅ CONFIRMED — `authorize-call/index.ts`, `featureFlags.trialExperienceV1`)
- 15 live calls included
- 3 verification calls included (separate allowlist: `verification_call_allowlist` table)
- Trial duration: ❓ UNKNOWN (duration_days not confirmed in static analysis)
- Post-trial plan pre-selection: `preSelectPostTrialPlan(signals)` in `dashboardPlans.ts` — recommends plan based on trade + team size + coverage preference

### Legacy Plans (grandfathered, still active in DB)
`starter` → lite, `professional` → core, `premium` → pro
Env vars: `VITE_STRIPE_PRICE_STARTER_OLD`, `VITE_STRIPE_PRICE_PROFESSIONAL_OLD`, `VITE_STRIPE_PRICE_PREMIUM_OLD`

---

## Redirect Map

| From | To | File |
|---|---|---|
| `/signup` | `/start` | `SignupRedirect.tsx` |
| `/onboarding` | context-dependent | `OnboardingRedirect.tsx` |
| `/today` | `/dashboard?tab=overview` | `App.tsx` |
| `/overview` | `/dashboard?tab=overview` | `App.tsx` |
| `/calendar` | `/dashboard?tab=calendar` | `App.tsx` |
| `/appointments` | `/dashboard?tab=appointments` | `App.tsx` |
| `/admin/monitoring` | `/admin?tab=overview` | `AdminMonitoring.tsx` |
| `/admin/users` | `/admin?tab=staff` | `AdminUsers.tsx` |
| `*` | 404 | `NotFound.tsx` |

⚠️ `/setup-status` route was commented out in `src/App.tsx` — any deep links to it will 404.

---

## Vapi Chat Widget

- `src/components/VapiChatWidget.tsx` — floating AI chat widget
- `src/lib/VapiWidgetContext.tsx` — context provider wrapping entire app
- Env vars: `VITE_VAPI_PUBLIC_KEY`, `VITE_VAPI_WIDGET_ASSISTANT_ID`
- Mobile offset: `featureFlags.widgetSafeOffset`
- Present on all pages via App.tsx wrapper
