/**
 * authorize-call
 *
 * Called by Vapi BEFORE answering every inbound call.
 * Implements:
 *   3a. Trial minute enforcement (hard reject at 50 min limit)
 *   3b. Live plan overflow behavior (always_answer | soft_cap | hard_cap)
 *   3c. Night & Weekend time restriction (after-hours only)
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
    // Vapi sends: { phoneNumber, customData: { accountId } }
    const accountId: string | null =
      payload?.customData?.accountId || payload?.accountId || null;

    logInfo('Authorize call request received', {
      ...baseLogOptions,
      accountId,
      context: { phoneNumber: payload?.phoneNumber }
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
        'minutes_used_current_period, overage_minutes_current_period, ' +
        'overflow_behavior, soft_cap_overage_minutes, ' +
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
      .select('included_minutes, system_overage_ceiling_minutes, coverage_hours')
      .eq('plan_key', planKey)
      .single();

    const includedMinutes: number = plan?.included_minutes ?? 600;
    const ceilingMinutes: number = plan?.system_overage_ceiling_minutes ?? 200;

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

    const minutesUsed: number = account.minutes_used_current_period || 0;

    const alertCtx = {
      accountId,
      customerPhone,
      customerEmail,
      planKey,
      minutesUsed,
      minutesLimit: includedMinutes,
      functionName: FUNCTION_NAME,
      correlationId,
    };

    // ══════════════════════════════════════════════════════════════════════════
    // 3a. TRIAL ENFORCEMENT — hard reject at limit; no overage for trials
    // ══════════════════════════════════════════════════════════════════════════
    const isTrial = account.trial_active === true || account.subscription_status === 'trial';

    if (isTrial) {
      const trialUsed: number = account.trial_minutes_used || 0;
      const trialLimit: number = account.trial_minutes_limit || 50;
      const trialEndDate = account.trial_end_date ? new Date(account.trial_end_date) : null;
      const expiredByTime = trialEndDate !== null && trialEndDate <= new Date();
      const expiredByMinutes = trialUsed >= trialLimit;

      if (expiredByTime || expiredByMinutes) {
        logInfo('Trial ended — rejecting call (hard reject)', {
          ...baseLogOptions,
          accountId,
          context: { trialUsed, trialLimit, expiredByTime, expiredByMinutes },
        });

        const alertType = expiredByMinutes ? 'trial_ended_minutes' : 'trial_ended_time';
        await sendUsageAlert(supabase, alertType, {
          ...alertCtx,
          minutesUsed: trialUsed,
          minutesLimit: trialLimit,
        });

        return json({
          allowed: false,
          message:
            'Your free trial has ended. Visit ringsnap.ai/dashboard to start your plan ' +
            'and reactivate your AI receptionist in minutes.',
        });
      }

      // Trial active — fire threshold alerts
      const pct = trialLimit > 0 ? (trialUsed / trialLimit) * 100 : 0;
      if (pct >= 90) {
        await sendUsageAlert(supabase, 'trial_90_pct', {
          ...alertCtx, minutesUsed: trialUsed, minutesLimit: trialLimit,
        });
      } else if (pct >= 70) {
        await sendUsageAlert(supabase, 'trial_70_pct', {
          ...alertCtx, minutesUsed: trialUsed, minutesLimit: trialLimit,
        });
      }

      logInfo('Trial call authorized', { ...baseLogOptions, accountId });
      return json({ allowed: true });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 3c. NIGHT & WEEKEND TIME RESTRICTION
    // Check BEFORE overflow logic. Daytime calls are rejected without consuming minutes.
    // ══════════════════════════════════════════════════════════════════════════
    if (planKey === 'night_weekend') {
      const nowLocal = toLocalDate(new Date(), customerTimezone);
      if (isBusinessHours(nowLocal)) {
        logInfo('Night & Weekend: blocking daytime call', {
          ...baseLogOptions,
          accountId,
          context: { localTime: nowLocal.toString() },
        });

        // Increment daytime-rejected call counter (used for upgrade nudge in dashboard)
        await supabase
          .from('accounts')
          .update({ rejected_daytime_calls: (account.rejected_daytime_calls || 0) + 1 })
          .eq('id', accountId);

        return json({
          allowed: false,
          message:
            'Your RingSnap plan covers after-hours calls. ' +
            'For 24/7 coverage, upgrade at ringsnap.ai/dashboard.',
        });
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 3b. LIVE PLAN OVERFLOW BEHAVIOR ENGINE
    // ══════════════════════════════════════════════════════════════════════════

    const overageMinutes: number = Math.max(0, minutesUsed - includedMinutes);
    const ceilingReached: boolean = overageMinutes >= ceilingMinutes;

    // 1. System ceiling (hard stop — non-user-configurable)
    if (ceilingReached) {
      logWarn('System overage ceiling reached — routing to voicemail', {
        ...baseLogOptions,
        accountId,
        context: { minutesUsed, includedMinutes, ceilingMinutes },
      });

      if (!account.ceiling_reject_sent) {
        await sendUsageAlert(supabase, 'plan_ceiling_hit', alertCtx);
        await supabase
          .from('accounts')
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

    // 2. Over included minutes — check user's overflow preference
    if (minutesUsed >= includedMinutes) {
      const behavior: string = account.overflow_behavior || 'always_answer';

      if (behavior === 'hard_cap') {
        logInfo('hard_cap: rejecting overage call', { ...baseLogOptions, accountId });
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
          logInfo('soft_cap: buffer exhausted, rejecting call', {
            ...baseLogOptions,
            accountId,
            context: { overageMinutes, buffer },
          });
          return json({
            allowed: false,
            message:
              "You've reached your monthly call limit. " +
              'Upgrade at ringsnap.ai/dashboard for immediate reactivation.',
          });
        }
      }

      // always_answer or soft_cap within buffer → allow, fire overage alert
      await sendUsageAlert(supabase, 'plan_overage_started', alertCtx);

    } else {
      // Within included minutes — check 70%/90% thresholds
      const pct = includedMinutes > 0 ? (minutesUsed / includedMinutes) * 100 : 0;
      if (pct >= 90) {
        await sendUsageAlert(supabase, 'plan_90_pct', alertCtx);
      } else if (pct >= 70) {
        await sendUsageAlert(supabase, 'plan_70_pct', alertCtx);
      }
    }

    logInfo('Call authorized', { ...baseLogOptions, accountId, context: { planKey, minutesUsed } });
    return json({ allowed: true });

  } catch (err) {
    logError('authorize-call unexpected error', { ...baseLogOptions, error: err });
    // Fail open — never drop a customer call on an unexpected server error
    return json({ allowed: true });
  }
});
