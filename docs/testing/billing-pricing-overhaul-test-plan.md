Context
RingSnap is migrating from a legacy 3-tier pricing model (Starter $297, Professional $547, Premium $947) to a new 4-tier structure (Night & Weekend $59, Lite $129, Core $229, Pro $399). Plans were created programmatically via scripts/stripe-setup-new-plans.js. Key concerns: new plan keys must map correctly in code and Stripe, trial signups must default to night_weekend, provisioning must succeed asynchronously, billing must recur automatically via metered overage, and cancellation must respect a 7-day phone-hold window.
This is a pure test plan document — no code changes are needed. The output is a deliverable to be committed and used by the QA team.

Section 1: Summary Risks
Critical Risks (P0 — Launch Blockers)
#RiskRoot Cause AreaHow to DetectR1Trial signup creates subscription under wrong planSTRIPE_PRICE_ID_NIGHT_WEEKEND env var not set or pointing to old priceCheck Stripe subscription items[0].price.id matches env varR2Webhook price→plan_key mapping fails for new IDsstripe-webhook reads env vars at runtime; env not deployed to edge functionaccounts.plan_key is NULL or wrong after checkout.session.completedR3Overage metered item ID not storedstripe_overage_item_id not captured in checkout.session.completed handleraccounts.stripe_overage_item_id is NULL; invoice.upcoming handler fails silentlyR4Legacy plan subscribers get wrong plan_key after migrationnormalizeLegacyPlanKey() mapping: starter→lite, professional→core, premium→proQuery accounts where plan_type is old key and plan_key is wrong or NULLR5Provisioning stuck in pending indefinitelyprovision-vapi worker not running or provisioning_jobs table not polledaccounts.provisioning_status stays pending > 5 min after signupR6Duplicate webhook processingstripe_events dedup not workingSame invoice processed twice; account_credits double-appliedR7Night & Weekend plan answers daytime callsCoverage-hours restriction not enforced in VAPIrejected_daytime_calls never increments; calls answered 8AM–6PM weekdaysR8Overage not reported to Stripe on invoice.upcomingstripe_overage_item_id NULL or usage record API call failsStripe invoice has no usage line; customer charged $0 for overagesR9Cancellation doesn't set phone hold windowcustomer.subscription.deleted handler doesn't compute phone_number_held_untilphone_number_held_until is NULL after cancellationR10Payment failure doesn't block servicesubscription_status not set to past_due on invoice.payment_failedService continues after failed payment
High Risks (P1)
#RiskAreaR11Account credits applied twice to same invoiceIdempotency gap in credit application logicR12Trial minutes limit not enforced (night_weekend 150 min vs others)sync-usage reads wrong plan minutesR13Upgrade from night_weekend doesn't clear rejected_daytime_callscreate-upgrade-checkout counter reset missingR14Invoice email sent with wrong plan name (shows old plan)Email template reads plan_type not plan_keyR15Legacy subscribers see "Starter"/"Professional"/"Premium" in UIBillingTab doesn't call normalizeLegacyPlanKey()

Section 2: Test Matrix
Legend

CI = Automated, runs in CI pipeline
Manual = Manual smoke test, pre-launch
Clock = Requires Stripe Test Clock
[Unverified] = Assumption — verify from repo or Stripe dashboard


Group A: Trial Signup & Default Plan
IDScenarioStepsSystems to VerifyAssertionsData to RecordExpected OutcomeTypeA1Happy path: Trial signup defaults to Night & WeekendPOST create-trial with valid email, phone, card; no plan paramStripe API, accounts table, stripe_events table1. accounts.plan_key = 'night_weekend' 2. accounts.subscription_status = 'trialing' 3. accounts.trial_active = true 4. Stripe subscription status = trialing 5. Stripe price ID = STRIPE_PRICE_ID_NIGHT_WEEKEND env value 6. stripe_events has checkout.session.completed row with processed = trueaccounts.stripe_subscription_id, accounts.stripe_customer_id, Stripe sub IDAccount created on night_weekend plan in trialCIA2Trial signup with explicit plan = 'lite'POST create-trial with plan: 'lite'Stripe, accounts1. accounts.plan_key = 'lite' 2. Stripe price = STRIPE_PRICE_ID_LITEaccounts.plan_key, Stripe subscription itemsLite plan subscription createdCIA3Trial signup with legacy plan key plan = 'starter'POST create-trial with plan: 'starter'Stripe, accounts1. normalizeLegacyPlanKey maps starter→lite 2. accounts.plan_key = 'lite'accounts.plan_keyLegacy key normalized correctlyCIA4Trial signup with legacy key plan = 'trial'POST create-trial with plan: 'trial'Stripe, accounts1. normalizeLegacyPlanKey maps trial→night_weekend 2. accounts.plan_key = 'night_weekend'accounts.plan_keyDefaults to night_weekendCIA5Duplicate signup (idempotency key reuse)POST create-trial twice with same idempotency keyStripe, accounts1. Only ONE Stripe customer created 2. Only ONE accounts row 3. Second call returns cached success responseCount of stripe_customer_id occurrencesIdempotent — no duplicatesCIA6Signup with disposable emailPOST create-trial with known disposable domainAnti-abuse checkHTTP 400 returned; no Stripe customer created; no accounts rowError code in responseRejected by anti-abuse filterCIA7Payment method decline during signupPOST create-trial with Stripe test card 4000000000000002 (decline)Stripe, accounts, Stripe compensation1. HTTP error returned 2. Stripe subscription rolled back (cancelled or not created) 3. Stripe customer deleted 4. No accounts row createdStripe customer list (should not exist)Compensation logic fires; no orphaned dataManual

Group B: Provisioning After Signup
IDScenarioStepsSystems to VerifyAssertionsData to RecordExpected OutcomeTypeB1Provisioning completes successfullyAfter successful A1 signup, wait up to 5 minaccounts.provisioning_status, VAPI dashboard, provisioning_jobs table1. accounts.provisioning_status = 'completed' 2. accounts.vapi_phone_number is non-NULL 3. VAPI assistant exists in VAPI dashboard for accountvapi_phone_number, VAPI assistant IDPhone number assigned, assistant provisionedManualB2Provisioning status pollingAfter A1 signup, poll accounts.provisioning_status at t=0, t=30s, t=60s, t=300saccounts tableStatus transitions: pending → processing → completedTimestamps of each status transitionStatus moves through pipeline without hangingManualB3Provisioning failure and retry[Unverified: simulate VAPI API failure by temporarily revoking VAPI key] Force VAPI provisioning errorprovisioning_jobs table, accounts.provisioning_status1. accounts.provisioning_status = 'failed' after max retries 2. provisioning_jobs shows retry count > 0Retry count, final statusFailure recorded; no infinite retry loopManualB4Sales-sourced provisioning (source = 'sales')Call provision-account with source: 'sales'accounts, StripeSame assertions as B1 plus: Stripe customer/sub created fresh if not existingStripe customer IDSales path provisions correctlyManual

Group C: Webhook Processing & Idempotency
IDScenarioStepsSystems to VerifyAssertionsData to RecordExpected OutcomeTypeC1checkout.session.completed — fields populatedTrigger via trial signup or Stripe CLI: stripe trigger checkout.session.completedaccounts, stripe_events1. stripe_events row inserted with processed = true 2. accounts.stripe_overage_item_id non-NULL 3. accounts.trial_start_date and trial_end_date populated 4. accounts.current_period_start / current_period_end setAll 4 fields from accountsAll fields written correctlyCIC2customer.subscription.created — plan_key mappingTrigger subscription creation for each of 4 plansaccounts, stripe_eventsFor each plan: accounts.plan_key matches expected value (night_weekend, lite, core, pro)plan_key per planCorrect plan_key for all 4 plansCIC3customer.subscription.updated — status syncManually update subscription status in Stripe test dashboardaccountsaccounts.subscription_status mirrors Stripe status within 30ssubscription_status before/afterStatus synced correctlyManualC4invoice.payment_succeeded — receipt emailTrigger payment successEmail inbox, stripe_events1. Invoice email sent to primary profile email 2. stripe_events row marked processed 3. If referral: referrer credited $50, referee credited $25Email delivery timestamp, credit amountsEmail sent; referral credits appliedManualC5invoice.payment_failed — past_due setUse Stripe test card 4000000000000341 (attach after sub created) to force failureaccounts, stripe_events1. accounts.subscription_status = 'past_due' 2. accounts.unpaid_since is non-NULLsubscription_status, unpaid_sinceAccount marked past_dueManualC6customer.subscription.deleted — cancellation stateCancel subscription via Stripe dashboardaccounts, stripe_events1. accounts.account_status = 'cancelled' 2. accounts.subscription_status = 'cancelled' 3. accounts.phone_number_held_until = billing period end + 7 daysphone_number_held_until timestamp7-day hold window set correctlyManualC7invoice.upcoming — overage reported to StripeAdvance Test Clock to 7 days before renewal; simulate overage minutes via sync-usageStripe subscription item usage records, accounts1. stripe.subscriptionItems.createUsageRecord() called with correct quantity 2. Stripe usage record shows correct minute count 3. accounts.overage_minutes_current_period reset to 0 afterStripe usage record quantity, overage_minutes_current_period before/afterOverage minutes reported; counters resetClockC8Duplicate webhook delivery — idempotencySend same Stripe event ID twice to webhook endpointstripe_events, accounts1. Second delivery returns 200 (not error) 2. Only ONE stripe_events row with that event_id 3. Account updated only once (no double credit/double status flip)stripe_events row count for event_idIdempotent — duplicate ignoredCIC9Webhook signature verificationSend POST to webhook URL with invalid Stripe signatureWebhook responseHTTP 400 returned; no stripe_events row createdHTTP status codeRejected — no processingCIC10invoice.payment_succeeded — clears unpaid_sincePay failed invoice in Stripe (after C5)accountsaccounts.unpaid_since set to NULL; accounts.subscription_status = 'active'unpaid_since, subscription_statusAccount reactivatedManual

Group D: Billing Cycle, Renewal & Trial Conversion (Stripe Test Clock)
IDScenarioStepsSystems to VerifyAssertionsData to RecordExpected OutcomeTypeD1Trial → paid conversion (Night & Weekend)1. Create account via A1 2. Create Stripe Test Clock 3. Advance clock past trial_end_dateStripe invoice, accounts, email1. Stripe generates invoice for $59 2. Invoice paid automatically 3. accounts.subscription_status = 'active' 4. accounts.trial_active stays false 5. Receipt email sentInvoice amount, subscription statusTrial converts; first payment chargedClockD2Trial conversion → overage item still attachedAfter D1Stripe subscription itemsaccounts.stripe_overage_item_id unchanged; subscription still has 2 items (base + overage)Item IDs pre/post conversionMetered item survives trial conversionClockD3Monthly renewal — no overage1. Create paid account 2. Advance clock to renewal date 3. Verify no overage minutesStripe invoice, accounts1. Invoice shows only base plan price 2. No usage line items 3. accounts.minutes_used_current_period reset to 0Invoice line items, minutes_used_current_periodClean renewal; base price onlyClockD4Monthly renewal — with overage1. Create paid account 2. Inject overage minutes via sync-usage 3. Advance clock to 7 days before renewal (triggers invoice.upcoming) 4. Advance to renewalStripe invoice, accounts, usage records1. Usage record reported correctly 2. Invoice includes overage line (minutes × rate) 3. Total invoice = base + (overage_min × rate) 4. accounts.overage_minutes_current_period resetInvoice total, usage quantity, reset counterOverage billed correctlyClockD5Trial ends by minutes exhaustion (not time)1. Create night_weekend trial (150 min limit) 2. Inject 151 minutes via sync-usageaccounts, usage_alerts1. accounts.trial_active updated appropriately [Unverified: check if auto-converted or just blocked] 2. usage_alerts row with alert_type = 'trial_ended_minutes' 3. No more calls answered after limittrial_minutes_used, alert rowTrial ends at minute limitManualD6Trial period expires before minutes exhaustedAdvance Test Clock past trial endaccounts, Stripe1. usage_alerts row with alert_type = 'trial_ended_time' 2. Stripe moves subscription to activeAlert row, subscription_statusTime-based trial expiry handledClock

Group E: Usage Tracking & Alerts
IDScenarioStepsSystems to VerifyAssertionsData to RecordExpected OutcomeTypeE1Usage alert at 70%POST to sync-usage with minutes to bring total to 70% of plan limitusage_alerts, email1. usage_alerts row with alert_type = '70_pct' 2. Alert email sent 3. Second call at same % does NOT create duplicate alert (alerts_sent JSONB dedup)Alert row timestamp, email deliveredAlert fires once at 70%CIE2Usage alert at 90%Same, bring to 90%usage_alerts, emailSame as E1 with alert_type = '90_pct'Alert rowAlert fires once at 90%CIE3Overage started alertPush past included minutesusage_alerts, accounts1. usage_alerts row with alert_type = 'overage_started' 2. accounts.overage_minutes_current_period > 0Overage counterOverage alert firesCIE4System ceiling reached (Night & Weekend: 100 min overage)Push Night & Weekend account past 100 overage minutesaccounts, usage_alerts1. accounts.ceiling_reject_sent = true 2. usage_alerts row with alert_type = 'ceiling_hit' 3. Further calls rejectedceiling_reject_sent, alert rowHard ceiling enforcedManualE5Ceiling resets on new billing periodAfter E4, advance Test Clock to renewalaccountsaccounts.ceiling_reject_sent = false after invoice.upcoming handler firesceiling_reject_sentCeiling flag cleared for new periodClockE6Trial 70%/90% alerts fire separately from paid alertsDuring trial, reach 70% of trial_minutes_limitusage_alertsAlert type is trial_70_pct (not 70_pct)alert_typeCorrect alert type for trial contextCI

Group F: Plan Changes (Upgrade/Downgrade)
IDScenarioStepsSystems to VerifyAssertionsData to RecordExpected OutcomeTypeF1Upgrade via stripe-subscription-updatePATCH plan from night_weekend → liteStripe, accounts1. Stripe subscription item updated to lite price ID 2. Proration invoice created (proration_behavior: 'always_invoice') 3. accounts.plan_key = 'lite'New price ID, proration invoice amountUpgrade succeeds with prorationManualF2Upgrade via create-upgrade-checkout (no existing sub)POST with new plan keyStripe, accounts1. Checkout session created with 2 items: base + overage 2. accounts.plan_key updated on checkout.session.completedCheckout session itemsCheckout created with both price itemsManualF3Upgrade from Night & Weekend clears daytime rejection counterUpgrade night_weekend → liteaccountsaccounts.rejected_daytime_calls = 0 after upgradeCounter before/afterCounter cleared on upgradeCIF4Downgrade (if supported) [Unverified: check if downgrade is blocked in UI]PATCH plan from core → liteStripe, accounts1. Subscription item updated 2. No proration charged (credit applied) or credit note issuedStripe subscription statusDowngrade handled per Stripe proration policyManualF5Legacy subscriber sees correct plan after migrationQuery accounts where plan_type = 'starter'accounts, UI1. accounts.plan_key = 'lite' (set by migration) 2. BillingTab shows "Lite" not "Starter"plan_key value, UI screenshotLegacy mapping correctManual

Group G: Cancellation Flow
IDScenarioStepsSystems to VerifyAssertionsData to RecordExpected OutcomeTypeG1Happy path cancellation from dashboardClick "Cancel" in BillingTab; confirm dialogStripe, accounts, stripe_events1. cancel-subscription edge function returns 200 2. Stripe subscription status = canceled 3. accounts.subscription_status = 'cancelled' 4. accounts.account_status = 'cancelled' 5. accounts.phone_number_held_until = (billing period end + 7 days) 6. Analytics event loggedphone_number_held_until, Stripe sub statusCancellation complete; 7-day hold activeManualG2Reactivation within hold periodCancel (G1), then resubscribe within 7 daysStripe, accounts1. New subscription created 2. accounts.account_status = 'active' 3. Same phone number retained (not released)Phone number before/afterPhone number retained on reactivationManualG3Phone released after hold period expiresCancel (G1), advance clock past phone_number_held_untilVAPI, accountsPhone number released in VAPI; accounts.vapi_phone_number cleared [Unverified: check if release is automatic or requires cron]vapi_phone_numberPhone released after holdClockG4Cancellation with missing Stripe sub (soft fail)Cancel when accounts.stripe_subscription_id is NULLaccounts1. Function does not throw 500 2. accounts.subscription_status updated to cancelled anywayHTTP status codeSoft fail — DB updated even without Stripe subCI

Group H: Billing UI Verification
IDScenarioStepsSystems to VerifyAssertionsData to RecordExpected OutcomeTypeH1BillingTab renders current planLog in as active subscriber; navigate to /dashboard?tab=billingBillingTab.tsx, accounts1. Plan name matches accounts.plan_key 2. Included minutes correct 3. Monthly price correct 4. Coverage hours shown (after-hours vs 24/7)Plan name rendered, price shownCorrect plan data displayedManualH2Trial countdown visibleLog in during trialBillingTab.tsxTrial badge and days-remaining shownBadge textTrial UI state correctManualH3Minutes usage bar accurateLog in with known minutes_used_current_period valueBillingTab.tsxUsage bar percentage = minutes_used / included_minutes × 100Bar percentageUsage bar accurateManualH4Invoice list rendersNavigate to billing tab with invoices presentInvoicesList.tsx, stripe-invoices-list1. Invoices listed with date, amount, status 2. PDF download link present 3. Hosted invoice URL presentInvoice count, linksInvoice list correctManualH5Invoice list — no invoices messageNew account with no invoicesInvoicesList.tsx"No invoices" message or empty state shown (not blank/crash)UI stateEmpty state shownManualH6Payment method displayActive subscriber with card on fileBillingTab.tsx, get-billing-summaryLast 4 digits, card brand, expiration shown correctlyLast 4, brandPayment method displaysManualH7Upgrade modal shows 4 plans with correct pricesClick upgrade from night_weekend accountUpgrade modal4 plan cards shown: Night & Weekend ($59), Lite ($129), Core ($229), Pro ($399) with correct included minutesPlan cards renderedAll 4 plans shown correctlyManualH8Plan name in upgrade modal not showing legacy namesOpen upgrade modalUpgrade modal"Starter", "Professional", "Premium" do NOT appearText contentNo legacy plan namesManual

Group I: Payment Method Management
IDScenarioStepsSystems to VerifyAssertionsData to RecordExpected OutcomeTypeI1Update payment methodClick "Update Payment Method"; enter new test cardStripe, accounts, stripe-payment-method-default1. New card attached to Stripe customer 2. Set as default payment method 3. get-billing-summary returns new card last4New last4Payment method updatedManualI2Setup intent created correctlyInitiate payment method updatestripe-setup-intent edge functionSetup intent has usage: 'off_session' (for recurring billing) [Unverified: verify setup intent type]Setup intent IDSetup intent createdManual

Group J: Stripe Plan Configuration Verification
IDScenarioStepsSystems to VerifyAssertionsData to RecordExpected OutcomeTypeJ1All 4 base plan prices exist in StripeCheck Stripe dashboard or APIStripe Products & Prices4 active prices matching env vars: STRIPE_PRICE_ID_{NIGHT_WEEKEND,LITE,CORE,PRO}; each has correct amountPrice IDs, amountsAll 4 prices activeManualJ2All 4 overage prices exist and are meteredCheck Stripe dashboardStripe Prices4 metered prices (billing_scheme = per_unit, aggregate_usage = last_during_period or sum) [Unverified: confirm aggregate_usage setting]Billing scheme, aggregate_usageOverage prices are meteredManualJ3Legacy prices archived/inactiveCheck Stripe dashboard for old pricesStripe PricesSTRIPE_OLD_PRICE_ID_{STARTER,PROFESSIONAL,PREMIUM} are inactive (not active)Price active statusOld prices inactiveManualJ4plans table in Supabase matches StripeQuery plans table; compare stripe_price_id to Stripe APIplans table, Stripe APIEvery stripe_price_id in plans table is active in StripeAll 8 price IDsDB and Stripe in syncManualJ5Env vars set in edge function deploymentCheck Supabase edge function secretsSupabase dashboard → Edge Functions → SecretsAll 8 price env vars non-empty: STRIPE_PRICE_ID_* and STRIPE_OVERAGE_PRICE_ID_*Secret values (redacted)All env vars deployedManual

Section 3: Minimum Go-Live Suite (Top 10 Checks)
These 10 checks must pass before go-live. All can be completed in under 2 hours.
PriorityIDCheckMethodPass Criteria1J5All 8 Stripe price env vars set in production edge functionsSupabase dashboard → SecretsAll 8 non-empty2J1+J2All 4 base + 4 overage prices active in StripeStripe Dashboard → Products8 prices visible and active3A1Trial signup creates night_weekend subscriptionLive test signupaccounts.plan_key = 'night_weekend'; Stripe sub items match price env var4C1checkout.session.completed populates stripe_overage_item_idQuery DB after A1accounts.stripe_overage_item_id non-NULL5B1Provisioning completes within 5 minWait after A1accounts.provisioning_status = 'completed'; vapi_phone_number non-NULL6D1Trial → paid conversion charges correct amountStripe Test Clock, advance past trialInvoice amount = $59; status active7C7Overage reported on invoice.upcomingTest Clock: inject overages, advance to 7 days pre-renewalStripe usage record exists with correct quantity8G1Cancellation from dashboard sets cancelled status and holdManual dashboard cancelaccount_status = 'cancelled'; phone_number_held_until set9C8Duplicate webhook rejected (idempotency)Send same webhook event ID twiceOnly 1 stripe_events row; account updated once10H4+H7Billing UI: invoices and 4-plan upgrade modal renderManual browser testInvoice list visible; 4 plan cards with correct prices

Section 4: Full Suite (Expanded)
All scenarios from the matrix above, executed in order:
Phase 1 — Configuration Verification (J1–J5): ~30 min, Manual
Phase 2 — Signup & Provisioning (A1–A7, B1–B4): ~90 min, CI + Manual
Phase 3 — Webhook Processing (C1–C10): ~60 min, CI + Manual
Phase 4 — Billing Cycle with Test Clock (D1–D6, E5): ~60 min, Clock
Phase 5 — Usage & Alerts (E1–E6): ~30 min, CI + Manual
Phase 6 — Plan Changes (F1–F5): ~45 min, Manual
Phase 7 — Cancellation (G1–G4): ~30 min, Manual + Clock
Phase 8 — UI Verification (H1–H8): ~45 min, Manual
Phase 9 — Payment Methods (I1–I2): ~15 min, Manual
Total estimated time: ~7 hours for full suite

Section 5: Common Failure Modes and How to Detect Them
FM-1: Env Var Not Deployed to Edge Function
Symptom: accounts.plan_key is NULL or night_weekend is used as fallback for all plans regardless of selected plan.
Detection: After customer.subscription.created, query accounts.plan_key. If wrong, check stripe_events.event_data->>'type' = customer.subscription.created and compare data.object.items.data[0].price.id to env vars.
Fix: Deploy env vars via Supabase Edge Function Secrets panel. Re-deliver webhook event.
FM-2: Overage Price Item Missing from Subscription
Symptom: accounts.stripe_overage_item_id is NULL; invoice.upcoming handler silently fails to report usage.
Detection: After signup, check accounts.stripe_overage_item_id. Also check Stripe subscription items — should have 2 items (base + metered overage).
Root Cause: create-trial or finalize-trial only attached base price to subscription, not overage price.
Fix: Verify create-trial code creates subscription with items: [{ price: basePriceId }, { price: overagePriceId }].
FM-3: Webhook Event Silently Dropped
Symptom: Stripe shows event as delivered (200 received), but accounts not updated.
Detection: Query stripe_events for the event ID. If processed = false or row missing, the handler threw an error after the 200 response.
Fix: Check Sentry for errors in stripe-webhook function matching the event timestamp. Look for DB constraint violations.
FM-4: Legacy Subscribers on Wrong plan_key Post-Migration
Symptom: Old subscribers still show plan_key = NULL or plan_key = 'starter' (which is invalid).
Detection: SELECT id, plan_type, plan_key FROM accounts WHERE plan_type IN ('starter','professional','premium') AND plan_key NOT IN ('night_weekend','lite','core','pro');
Fix: Run backfill SQL: update plan_key based on plan_type using the same mapping as normalizeLegacyPlanKey().
FM-5: Trial Never Converts — Subscription Remains "Trialing" Indefinitely
Symptom: After trial period ends, accounts.subscription_status stays trialing; no payment taken.
Detection: Check customer.subscription.updated event in Stripe dashboard showing status: active. Query stripe_events for that event and processed status.
Root Cause: Webhook delivery failed or event handler threw on status update.
Fix: Re-deliver the event from Stripe dashboard; check function logs.
FM-6: invoice.upcoming Handler Resets Counters Without Reporting Usage
Symptom: Overage minutes are in accounts.overage_minutes_current_period but Stripe usage record is 0.
Detection: Check Stripe subscription item usage records before invoice.upcoming fires (via Test Clock). Compare to accounts.overage_minutes_current_period.
Root Cause: stripe.subscriptionItems.createUsageRecord() called with wrong subscriptionItemId (e.g., NULL stripe_overage_item_id).
Fix: Ensure FM-2 is resolved first (overage item ID stored).
FM-7: Double-Billing on Renewal
Symptom: Customer charged twice for same month; account_credits show double deduction.
Detection: Query stripe_events for invoice.payment_succeeded events for same invoice ID — should be exactly 1. Check account_credits.applied_to_invoice_id for duplicates.
Root Cause: Webhook deduplication failing; stripe_events UNIQUE constraint on stripe_event_id should prevent this, but check for race conditions.
Fix: Verify record_stripe_event() RPC function uses ON CONFLICT DO NOTHING or equivalent.
FM-8: Night & Weekend Plan Answering Daytime Calls After Upgrade
Symptom: After upgrade from night_weekend to lite, calls still rejected during business hours.
Detection: Check accounts.rejected_daytime_calls counter — should be 0 after upgrade. Check VAPI assistant configuration — coverage schedule should be updated.
Root Cause: create-upgrade-checkout clears the DB counter but may not update VAPI assistant's schedule.
Fix: [Unverified: check if VAPI assistant schedule is updated on upgrade or if it uses plan_key dynamically]
FM-9: Phone Not Released After Hold Period
Symptom: Cancelled account's phone number never returned to VAPI pool after hold period.
Detection: Query accounts WHERE account_status = 'cancelled' AND phone_number_held_until < NOW() AND vapi_phone_number IS NOT NULL.
Root Cause: No automated cron to release numbers after hold; release may require manual VAPI API call.
Fix: [Unverified: verify if a cron job handles phone release after hold period expires]
FM-10: Stripe Webhook Endpoint URL Mismatch (Post-Deployment)
Symptom: All Stripe events show 404 or delivery failures in Stripe dashboard.
Detection: Check Stripe Webhook configuration → Endpoint URL matches production Supabase edge function URL.
Fix: Update webhook endpoint URL in Stripe dashboard after deployment.

Stripe Test Clock Strategy
Setup Steps

In Stripe Test Mode: Customers → Create Test Clock (name it by test scenario)
Create Stripe customer with the clock attached
Sign up using that customer's client_secret or inject customer ID directly
Advance the clock in increments:

+1 hour: verify checkout.session.completed processed
+3 days (trial end): verify trial conversion and first invoice
+23 days (7 days before renewal): triggers invoice.upcoming — verify overage reported
+30 days (renewal): verify renewal invoice amount



Clock-Specific Assertions

Before advancing: Record accounts.minutes_used_current_period, overage_minutes_current_period, stripe_overage_item_id
After invoice.upcoming fires: Verify Stripe usage record quantity = overage_minutes_current_period pre-clock-advance
After renewal: Verify counter = 0, invoice total = base_price + (overage_min × rate)


Data Collection Template
For each manual test, record:
Test ID:
Date/Time:
Tester:
Account ID (Supabase):
Stripe Customer ID:
Stripe Subscription ID:
Plan Key Expected:
Plan Key Actual (accounts.plan_key):
Overage Item ID (accounts.stripe_overage_item_id):
Provisioning Status:
VAPI Phone Number:
Stripe Events Processed (stripe_events count):
Invoice Amount:
Pass/Fail:
Notes:

Files Referenced
FilePurposesrc/lib/billing/dashboardPlans.tsPlan definitions, legacy key mapping, normalizeLegacyPlanKey()supabase/functions/stripe-webhook/index.tsAll webhook event handlerssupabase/functions/create-trial/index.tsTrial signup flowsupabase/functions/finalize-trial/index.tsTwo-step signup flowsupabase/functions/provision-account/index.tsProvisioning after signupsupabase/functions/sync-usage/index.tsUsage tracking + alertssupabase/functions/cancel-subscription/index.tsCancellation handlersupabase/functions/create-upgrade-checkout/index.tsPlan upgrade flowsupabase/functions/stripe-subscription-update/index.tsIn-place plan changesupabase/functions/reset-monthly-usage/index.tsMonthly overage reset cronsupabase/functions/stripe-invoices-list/index.tsInvoice list APIsupabase/functions/get-billing-summary/index.tsPayment method summarysupabase/migrations/20260302000001_pricing_restructure.sqlDB schema: accounts, plans, stripe_eventssupabase/migrations/20251123000003_stripe_events.sqlWebhook deduplication table.env.exampleAll 8 Stripe price env var namestests/e2e/dashboard-billing.spec.tsExisting E2E tests (currently mostly skipped)scripts/stripe-setup-new-plans.jsPlan creation script
