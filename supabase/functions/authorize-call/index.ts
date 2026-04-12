/**
 * authorize-call
 *
 * Called by Vapi BEFORE answering every inbound call.
 * Implements call-based billing enforcement (billing_call_based_v1) with
 * backward-compatible fallback to minute-based logic for legacy accounts.
 *
 *   Trial (trialExperienceV1=true):
 *     3a. Verification call gating: only from allowlisted numbers, max 3
 *     3b. Live trial cap: hard reject at 15 handled calls
 *
 *   Live plans (call-based):
 *     3c. Night & Weekend time restriction (after-hours only)
 *     3d. Call-based overflow behavior (always_answer | soft_cap | hard_cap)
 *
 *   Live plans (minute-based, legacy fallback):
 *     3e. Minute-based overflow logic (unchanged)
 *
 * Returns: { allowed: boolean, message?: string }
 * `allowed: false` with a message → Vapi plays the message and hangs up
 */

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "supabase";
import { extractCorrelationId, logError, logInfo, logWarn } from '../_shared/logging.ts';
import { sendUsageAlert } from '../_shared/usage-alerts.ts';

const FUNCTION_NAME = 'authorize-call';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Night & Weekend schedule ─────────────────────────────────────────────────
// Business hours: Mon–Fri 8:00AM–6:00PM local time.
// Night & Weekend plan is ONLY active outside these hours.
function isBusinessHours(nowLocal: Date): boolean {
  const day = nowLocal.getDay(); // 0=Sun, 6=Sat
  const hour = nowLocal.getHours();
  const minute = nowLocal.getMinutes();
  const timeMinutes = hour * 60 + minute;
  const isWeekday = day >= 1 && day <= 5;
  const duringHours = timeMinutes >= 8 * 60 && timeMinutes < 18 * 60; // 8:00–17:59
  return isWeekday && duringHours;
}

function toLocalDate(utcNow: Date, timezone: string): Date {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(utcNow);
    const get = (type: string) => parseInt(parts.find((p: Intl.DateTimeFormatPart) => p.type === type)?.value || '0');
    const hour = get('hour') % 24; // hour12:false can return "24" for midnight
    return new Date(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
  } catch {
    // Fallback to Mountain Time if timezone invalid
    return toLocalDate(utcNow, 'America/Denver');
  }
}

// ─── PostHog capture ──────────────────────────────────────────────────────────
async function capturePostHog(
  event: string,
  distinctId: string,
  props: Record<string, unknown>
): Promise<void> {
  const key = Deno.env.get('POSTHOG_API_KEY');
  if (!key) return;
  try {
    await fetch('https://us.i.posthog.com/capture/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        event,
        distinct_id: distinctId,
        properties: { ...props, $lib: 'edge-function', function: FUNCTION_NAME },
        timestamp: new Date().toISOString(),
      }),
    });
  } catch { /* best-effort */ }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  const correlationId = extractCorrelationId(req);
  const baseLogOptions = { functionName: FUNCTION_NAME, correlationId };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: object) =>
    new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const payload = await req.json();
    // Vapi sends: { phoneNumber, customData: { accountId }, customer: { number } }
    const accountId: string | null =
      payload?.customData?.accountId || payload?.accountId || null;
    const callerNumber: string | null =
      payload?.customer?.number ?? payload?.phoneNumber ?? null;

    logInfo('Authorize call request received', {
      ...baseLogOptions,
      accountId,
      context: { callerNumber }
    });

    if (!accountId) {
      return json({ allowed: false, message: 'Account not found.' });
    }

    // ── Fetch account + plan ────────────────────────────────────────────────
    const { data: account, error: acctErr } = await supabase
      .from('accounts')
      .select(
        'id, account_status, subscription_status, plan_key, plan_type, ' +
        'trial_active, trial_minutes_used, trial_minutes_limit, trial_end_date, ' +
        'trial_live_calls_used, trial_live_calls_limit, ' +
        'verification_calls_used, verification_calls_limit, ' +
        'minutes_used_current_period, overage_minutes_current_period, ' +
        'calls_used_current_period, overage_calls_current_period, ' +
        'overflow_behavior, soft_cap_overage_minutes, ' +
        'billing_call_based, selected_post_trial_plan, ' +
        'rejected_daytime_calls, ceiling_reject_sent, alerts_sent'
      )
      .eq('id', accountId)
      .single();

    if (acctErr || !account) {
      logError('Account not found', { ...baseLogOptions, accountId, error: acctErr });
      return json({ allowed: false, message: 'Account not found.' });
    }

    // plan_key (new schema) takes priority over plan_type (legacy)
    const planKey: string = account.plan_key || account.plan_type || 'night_weekend';

    // Fetch plan configuration from DB
    const { data: plan } = await supabase
      .from('plans')
      .select('included_minutes, system_overage_ceiling_minutes, coverage_hours, billing_unit, included_calls, max_overage_calls, overage_rate_calls_cents, plan_version')
      .eq('plan_key', planKey)
      .single();

    // Determine billing mode.
    // Explicit false on account = legacy/grandfathered, must stay on minute-based.
    // Env flag only applies when account flag is not explicitly false.
    const useCallBased: boolean = account.billing_call_based === true ||
      (account.billing_call_based !== false && Deno.env.get('BILLING_CALL_BASED_V1') === 'true');

    // ── Check account status ─────────────────────────────────────────────────
    if (['suspended', 'disabled', 'cancelled'].includes(account.account_status || '')) {
      return json({
        allowed: false,
        message: 'Your RingSnap account is not active. Please visit ringsnap.ai/dashboard.',
      });
    }

    // ── Fetch customer contact info for alert sending ────────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, timezone')
      .eq('account_id', accountId)
      .eq('is_primary', true)
      .maybeSingle();

    const customerTimezone: string = (profile as any)?.timezone || 'America/Denver';
    let customerEmail: string | null = null;
    let customerPhone: string | null = null;

    if (profile?.id) {
      const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
      customerEmail = authUser?.user?.email || null;
      customerPhone = authUser?.user?.phone || null;
    }

    const phDistinctId = accountId;

    // ══════════════════════════════════════════════════════════════════════════
    // TRIAL ENFORCEMENT
    // ══════════════════════════════════════════════════════════════════════════
    // Stripe stores the trial period status as 'trialing' (not 'trial').
    // The subscription_status column is written verbatim from Stripe's subscription.status,
    // so we must match both spellings here.
    const isTrial = account.trial_active === true ||
      account.subscription_status === 'trial' ||
      account.subscription_status === 'trialing';

    if (isTrial) {
      const trialEndDate = account.trial_end_date ? new Date(account.trial_end_date) : null;
      const expiredByTime = trialEndDate !== null && trialEndDate <= new Date();

      if (expiredByTime) {
        logInfo('Trial expired by time — rejecting call', { ...baseLogOptions, accountId });
        await sendUsageAlert(supabase, 'trial_ended_time', {
          accountId, customerPhone, customerEmail, planKey,
          callsUsed: 0, callsLimit: 0,
          minutesUsed: 0, minutesLimit: 0,
          functionName: FUNCTION_NAME, correlationId,
        });
        return json({
          allowed: false,
          message:
            'Your free trial has ended. Visit ringsnap.ai/dashboard to start your plan ' +
            'and reactivate your AI receptionist in minutes.',
        });
      }

      // ── New call-based trial enforcement ────────────────────────────────────
      if (useCallBased || Deno.env.get('TRIAL_EXPERIENCE_V1') === 'true') {
        const liveCallsUsed: number = account.trial_live_calls_used || 0;
        const liveCallsLimit: number = account.trial_live_calls_limit || 15;
        const verifCallsUsed: number = account.verification_calls_used || 0;
        const verifCallsLimit: number = account.verification_calls_limit || 3;

        // Check if caller is on verification allowlist
        const isVerificationCall = await checkVerificationAllowlist(supabase, accountId, callerNumber);

        if (isVerificationCall) {
          // ── Verification call path ─────────────────────────────────────────
          if (verifCallsUsed >= verifCallsLimit) {
            logInfo('Verification call limit reached — rejecting', {
              ...baseLogOptions, accountId,
              context: { verifCallsUsed, verifCallsLimit, callerNumber }
            });
            await capturePostHog('call_blocked_over_limit', phDistinctId, {
              account_id: accountId, plan_key: planKey, call_kind: 'verification',
              blocked_reason: 'verification_cap_reached', calls_used: verifCallsUsed,
              calls_limit: verifCallsLimit,
            });
            return json({
              allowed: false,
              message: 'Your 3 setup verification calls have been used. This number can still receive live calls.',
            });
          }

          logInfo('Verification call authorized', {
            ...baseLogOptions, accountId,
            context: { verifCallsUsed, verifCallsLimit }
          });
          await capturePostHog('trial_verification_call_authorized', phDistinctId, {
            account_id: accountId, verif_calls_used: verifCallsUsed + 1,
          });
          return json({ allowed: true, callKind: 'verification' });
        }

        // ── Live trial call path ───────────────────────────────────────────
        if (liveCallsUsed >= liveCallsLimit) {
          logInfo('Trial live call cap reached — hard reject', {
            ...baseLogOptions, accountId,
            context: { liveCallsUsed, liveCallsLimit }
          });
          await sendUsageAlert(supabase, 'trial_live_cap_reached', {
            accountId, customerPhone, customerEmail, planKey,
            callsUsed: liveCallsUsed, callsLimit: liveCallsLimit,
            minutesUsed: 0, minutesLimit: 0,
            functionName: FUNCTION_NAME, correlationId,
          });
          await capturePostHog('trial_cap_reached', phDistinctId, {
            account_id: accountId, plan_key: planKey,
            live_calls_used: liveCallsUsed, live_calls_limit: liveCallsLimit,
          });
          const selectedPlan = account.selected_post_trial_plan || 'lite';
          return json({
            allowed: false,
            message:
              'Your free trial has reached the 15-call limit. ' +
              'Visit ringsnap.ai/dashboard to activate your plan and keep answering calls.',
          });
        }

        // Fire threshold alerts before allowing
        const pct = liveCallsLimit > 0 ? (liveCallsUsed / liveCallsLimit) * 100 : 0;
        if (pct >= 80) {
          await sendUsageAlert(supabase, 'trial_80_pct', {
            accountId, customerPhone, customerEmail, planKey,
            callsUsed: liveCallsUsed, callsLimit: liveCallsLimit,
            minutesUsed: 0, minutesLimit: 0,
            functionName: FUNCTION_NAME, correlationId,
          });
        }

        logInfo('Trial live call authorized (call-based)', {
          ...baseLogOptions, accountId,
          context: { liveCallsUsed, liveCallsLimit }
        });
        await capturePostHog('trial_live_call_authorized', phDistinctId, {
          account_id: accountId, live_calls_used: liveCallsUsed + 1,
        });
        return json({ allowed: true, callKind: 'live' });
      }

      // ── Legacy minute-based trial enforcement (fallback) ────────────────────
      const trialUsed: number = account.trial_minutes_used || 0;
      const trialLimit: number = account.trial_minutes_limit || 50;
      const expiredByMinutes = trialUsed >= trialLimit;

      if (expiredByMinutes) {
        logInfo('Trial ended (minutes) — rejecting call', { ...baseLogOptions, accountId });
        await sendUsageAlert(supabase, 'trial_ended_minutes', {
          accountId, customerPhone, customerEmail, planKey,
          callsUsed: 0, callsLimit: 0,
          minutesUsed: trialUsed, minutesLimit: trialLimit,
          functionName: FUNCTION_NAME, correlationId,
        });
        return json({
          allowed: false,
          message:
            'Your free trial has ended. Visit ringsnap.ai/dashboard to start your plan ' +
            'and reactivate your AI receptionist in minutes.',
        });
      }

      const pct = trialLimit > 0 ? (trialUsed / trialLimit) * 100 : 0;
      if (pct >= 90) {
        await sendUsageAlert(supabase, 'trial_90_pct', {
          accountId, customerPhone, customerEmail, planKey,
          callsUsed: 0, callsLimit: 0,
          minutesUsed: trialUsed, minutesLimit: trialLimit,
          functionName: FUNCTION_NAME, correlationId,
        });
      } else if (pct >= 70) {
        await sendUsageAlert(supabase, 'trial_70_pct', {
          accountId, customerPhone, customerEmail, planKey,
          callsUsed: 0, callsLimit: 0,
          minutesUsed: trialUsed, minutesLimit: trialLimit,
          functionName: FUNCTION_NAME, correlationId,
        });
      }

      logInfo('Trial call authorized (minute-based)', { ...baseLogOptions, accountId });
      return json({ allowed: true });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // NIGHT & WEEKEND TIME RESTRICTION
    // Check BEFORE overflow logic. Daytime calls rejected without consuming usage.
    // ══════════════════════════════════════════════════════════════════════════
    if (planKey === 'night_weekend') {
      const nowLocal = toLocalDate(new Date(), customerTimezone);
      if (isBusinessHours(nowLocal)) {
        logInfo('Night & Weekend: blocking daytime call', {
          ...baseLogOptions, accountId,
          context: { localTime: nowLocal.toString() },
        });

        await supabase
          .from('accounts')
          .update({ rejected_daytime_calls: (account.rejected_daytime_calls || 0) + 1 })
          .eq('id', accountId);

        await capturePostHog('call_blocked_daytime_window', phDistinctId, {
          account_id: accountId, plan_key: planKey,
          local_time: nowLocal.toISOString(),
        });

        return json({
          allowed: false,
          message:
            'Your RingSnap plan covers after-hours calls. ' +
            'For 24/7 coverage, upgrade at ringsnap.ai/dashboard.',
        });
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // CALL-BASED OVERFLOW ENFORCEMENT (billing_call_based_v1)
    // ══════════════════════════════════════════════════════════════════════════
    if (useCallBased) {
      const includedCalls: number = plan?.included_calls ?? 60;
      const maxOverageCalls: number = plan?.max_overage_calls ?? 40;
      const callsUsed: number = account.calls_used_current_period || 0;
      const overageCalls: number = Math.max(0, callsUsed - includedCalls);
      const totalCap = includedCalls + maxOverageCalls;
      const alertCtx = {
        accountId, customerPhone, customerEmail, planKey,
        callsUsed, callsLimit: includedCalls,
        minutesUsed: 0, minutesLimit: 0,
        functionName: FUNCTION_NAME, correlationId,
      };

      // 1. System ceiling (hard stop — non-user-configurable)
      if (callsUsed >= totalCap) {
        logWarn('Call ceiling reached — blocking call', {
          ...baseLogOptions, accountId,
          context: { callsUsed, totalCap, includedCalls, maxOverageCalls },
        });

        if (!account.ceiling_reject_sent) {
          await sendUsageAlert(supabase, 'plan_ceiling_hit', alertCtx);
          await supabase.from('accounts')
            .update({ ceiling_reject_sent: true })
            .eq('id', accountId);
        }

        await capturePostHog('hard_cap_reached', phDistinctId, {
          account_id: accountId, plan_key: planKey,
          calls_used: callsUsed, total_cap: totalCap,
        });

        return json({
          allowed: false,
          message:
            "We're experiencing high call volume right now. Your team will return your call shortly. " +
            'Please leave a message with your name, number, and the best time to reach you.',
        });
      }

      // 2. Over included calls — check user's overflow preference
      if (callsUsed >= includedCalls) {
        const behavior: string = account.overflow_behavior || 'always_answer';

        if (behavior === 'hard_cap') {
          logInfo('hard_cap: rejecting overage call (call-based)', {
            ...baseLogOptions, accountId, context: { callsUsed, includedCalls }
          });
          await capturePostHog('call_blocked_over_limit', phDistinctId, {
            account_id: accountId, plan_key: planKey, overflow_mode: 'hard_cap',
            calls_used: callsUsed, included_calls: includedCalls,
          });
          return json({
            allowed: false,
            message:
              "You've reached your monthly call limit. " +
              'Upgrade at ringsnap.ai/dashboard for immediate reactivation.',
          });
        }

        if (behavior === 'soft_cap') {
          // soft_cap_overage_minutes field is reused as soft_cap_overage_calls
          const buffer: number = Math.min(account.soft_cap_overage_minutes || 40, maxOverageCalls);
          if (overageCalls >= buffer) {
            logInfo('soft_cap: buffer exhausted, rejecting call (call-based)', {
              ...baseLogOptions, accountId,
              context: { callsUsed, overageCalls, buffer }
            });
            await capturePostHog('soft_cap_reached', phDistinctId, {
              account_id: accountId, plan_key: planKey, overflow_mode: 'soft_cap',
              calls_used: callsUsed, overage_calls: overageCalls, buffer,
            });
            return json({
              allowed: false,
              message:
                "You've reached your monthly call limit. " +
                'Upgrade at ringsnap.ai/dashboard for immediate reactivation.',
            });
          }
        }

        // always_answer or soft_cap within buffer → allow
        if (overageCalls === 0) {
          // Exactly at 100% — this call starts overage; warn before billing kicks in
          await sendUsageAlert(supabase, 'plan_100_pct', alertCtx);
        } else {
          await sendUsageAlert(supabase, 'plan_overage_started', alertCtx);
        }
        await capturePostHog('overage_started', phDistinctId, {
          account_id: accountId, plan_key: planKey,
          calls_used: callsUsed, overage_calls: overageCalls,
        });

      } else {
        // Within included calls — check 80% threshold
        const pct = includedCalls > 0 ? (callsUsed / includedCalls) * 100 : 0;
        if (pct >= 80) {
          await sendUsageAlert(supabase, 'plan_80_pct', alertCtx);
        }
      }

      logInfo('Call authorized (call-based)', {
        ...baseLogOptions, accountId,
        context: { planKey, callsUsed, includedCalls }
      });
      return json({ allowed: true });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // LEGACY MINUTE-BASED OVERFLOW ENGINE (fallback for non-call-based accounts)
    // ══════════════════════════════════════════════════════════════════════════
    const includedMinutes: number = plan?.included_minutes ?? 600;
    const ceilingMinutes: number = plan?.system_overage_ceiling_minutes ?? 200;
    const minutesUsed: number = account.minutes_used_current_period || 0;
    const overageMinutes: number = Math.max(0, minutesUsed - includedMinutes);
    const ceilingReached: boolean = overageMinutes >= ceilingMinutes;

    const alertCtx = {
      accountId, customerPhone, customerEmail, planKey,
      callsUsed: 0, callsLimit: 0,
      minutesUsed, minutesLimit: includedMinutes,
      functionName: FUNCTION_NAME, correlationId,
    };

    if (ceilingReached) {
      logWarn('System overage ceiling reached (minute-based) — routing to voicemail', {
        ...baseLogOptions, accountId,
        context: { minutesUsed, includedMinutes, ceilingMinutes },
      });

      if (!account.ceiling_reject_sent) {
        await sendUsageAlert(supabase, 'plan_ceiling_hit', alertCtx);
        await supabase.from('accounts')
          .update({ ceiling_reject_sent: true })
          .eq('id', accountId);
      }

      return json({
        allowed: false,
        message:
          "We're experiencing high call volume right now. Your team will return your call shortly. " +
          'Please leave a message with your name, number, and the best time to reach you.',
      });
    }

    if (minutesUsed >= includedMinutes) {
      const behavior: string = account.overflow_behavior || 'always_answer';

      if (behavior === 'hard_cap') {
        return json({
          allowed: false,
          message:
            "You've reached your monthly call limit. " +
            'Upgrade at ringsnap.ai/dashboard for immediate reactivation.',
        });
      }

      if (behavior === 'soft_cap') {
        const buffer: number = account.soft_cap_overage_minutes || 100;
        if (overageMinutes >= buffer) {
          return json({
            allowed: false,
            message:
              "You've reached your monthly call limit. " +
              'Upgrade at ringsnap.ai/dashboard for immediate reactivation.',
          });
        }
      }

      await sendUsageAlert(supabase, 'plan_overage_started', alertCtx);
    } else {
      const pct = includedMinutes > 0 ? (minutesUsed / includedMinutes) * 100 : 0;
      if (pct >= 90) {
        await sendUsageAlert(supabase, 'plan_90_pct', alertCtx);
      } else if (pct >= 70) {
        await sendUsageAlert(supabase, 'plan_70_pct', alertCtx);
      }
    }

    logInfo('Call authorized (minute-based legacy)', {
      ...baseLogOptions, accountId, context: { planKey, minutesUsed }
    });
    return json({ allowed: true });

  } catch (err) {
    logError('authorize-call unexpected error', { ...baseLogOptions, error: err });
    // Fail closed — billing enforcement must not be bypassed on infrastructure errors
    return json({
      allowed: false,
      message: "We're having a technical issue right now. Please try your call again in a few minutes."
    });
  }
});

/**
 * Check if a caller number is on the verification call allowlist for this account.
 * Returns true only when:
 *   1. Caller number is present
 *   2. Account has an active entry for that number in verification_call_allowlist
 */
async function checkVerificationAllowlist(
  supabase: ReturnType<typeof createClient>,
  accountId: string,
  callerNumber: string | null
): Promise<boolean> {
  if (!callerNumber) return false;

  try {
    const { data } = await supabase
      .from('verification_call_allowlist')
      .select('id')
      .eq('account_id', accountId)
      .eq('phone_number', callerNumber)
      .eq('is_active', true)
      .maybeSingle();

    return !!data;
  } catch {
    return false;
  }
}
