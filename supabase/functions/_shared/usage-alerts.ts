/**
 * usage-alerts.ts
 *
 * Shared module for sending usage threshold alerts (SMS + Email).
 * All alert sends are logged to the `usage_alerts` table.
 * Each alert type is sent at most once per billing period (deduped via alerts_sent JSONB).
 *
 * Supports both:
 *   - Call-based alerts (new plans, billing_call_based_v1=true)
 *   - Minute-based alerts (legacy plans, fallback)
 */

import { sendSMS } from './sms.ts';
import { logError, logInfo } from './logging.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || Deno.env.get('RESEND_PROD_KEY') || '';
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'RingSnap <noreply@getringsnap.com>';
const DASHBOARD_URL = 'https://ringsnap.ai/dashboard';

// ─── Plan metadata ────────────────────────────────────────────────────────────
// Call-based (v2) — authoritative for new plans
export const PLAN_META_CALLS: Record<string, {
  name: string;
  priceMonthly: number;
  includedCalls: number;
  overageRateCents: number;   // cents per overage call
  overageRateDollars: number; // for display
  maxOverageCalls: number;
  nextPlan?: string;
  nextPlanPrice?: number;
}> = {
  night_weekend: {
    name: 'Night & Weekend', priceMonthly: 59,
    includedCalls: 60, overageRateCents: 110, overageRateDollars: 1.10, maxOverageCalls: 40,
    nextPlan: 'Lite', nextPlanPrice: 129,
  },
  lite: {
    name: 'Lite', priceMonthly: 129,
    includedCalls: 125, overageRateCents: 95, overageRateDollars: 0.95, maxOverageCalls: 50,
    nextPlan: 'Core', nextPlanPrice: 229,
  },
  core: {
    name: 'Core', priceMonthly: 229,
    includedCalls: 250, overageRateCents: 85, overageRateDollars: 0.85, maxOverageCalls: 75,
    nextPlan: 'Pro', nextPlanPrice: 449,
  },
  pro: {
    name: 'Pro', priceMonthly: 449,
    includedCalls: 450, overageRateCents: 75, overageRateDollars: 0.75, maxOverageCalls: 90,
  },
};

// Minute-based (v1 legacy) — kept for grandfathered accounts
export const PLAN_META: Record<string, {
  name: string;
  overageRate: number;
  includedMinutes: number;
  nextPlan?: string;
  nextPlanPrice?: number;
}> = {
  night_weekend: { name: 'Night & Weekend', overageRate: 0.45, includedMinutes: 150, nextPlan: 'Lite', nextPlanPrice: 129 },
  lite:          { name: 'Lite',            overageRate: 0.38, includedMinutes: 300, nextPlan: 'Core', nextPlanPrice: 229 },
  core:          { name: 'Core',            overageRate: 0.28, includedMinutes: 600, nextPlan: 'Pro',  nextPlanPrice: 399 },
  pro:           { name: 'Pro',             overageRate: 0.22, includedMinutes: 1200 },
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type AlertType =
  // Trial (call-based, new)
  | 'trial_80_pct'
  | 'trial_live_cap_reached'
  | 'trial_24h_before_convert'
  | 'trial_6h_before_convert'
  | 'trial_converted'
  // Trial (minute-based, legacy)
  | 'trial_70_pct'
  | 'trial_90_pct'
  | 'trial_ended_minutes'
  | 'trial_ended_time'
  // Paid plan (call-based, new)
  | 'plan_80_pct'
  | 'plan_100_pct'
  | 'plan_overage_started'
  | 'plan_80_pct_overage'
  | 'plan_ceiling_hit'
  // Paid plan (minute-based, legacy)
  | 'plan_70_pct'
  | 'plan_90_pct';

export interface AlertContext {
  accountId: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  planKey: string;
  // Call-based context
  callsUsed?: number;
  callsLimit?: number;
  // Minute-based context (legacy)
  minutesUsed: number;
  minutesLimit: number;
  functionName: string;
  correlationId: string;
  // Optional: selected post-trial plan for trial conversion alerts
  selectedPostTrialPlan?: string | null;
  trialEndDate?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt$(n: number): string {
  return `$${n.toFixed(2)}`;
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY || !to) return;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend error ${res.status}: ${body}`);
    }
  } catch (e) {
    console.error('[usage-alerts] Email send failed:', e);
  }
}

function upgradeCallsEmailBody(
  planName: string,
  callsUsed: number,
  callsLimit: number,
  overageRateDollars: number,
  nextPlanName?: string,
  nextPlanPrice?: number,
): string {
  const overageCalls = Math.max(0, callsUsed - callsLimit);
  const projectedOverage = overageCalls * overageRateDollars;
  const nextPlanLine = nextPlanName && nextPlanPrice
    ? `<p><strong>Upgrade to ${nextPlanName}:</strong> $${nextPlanPrice}/mo — more included calls, no overage projected at current usage</p>`
    : '';
  return `
<p>Current usage: <strong>${callsUsed} / ${callsLimit} handled calls</strong></p>
<p>Overage calls: <strong>${overageCalls}</strong> at ${fmt$(overageRateDollars)}/call</p>
<p>Projected overage cost: <strong>${fmt$(projectedOverage)}</strong></p>
<hr/>
${nextPlanLine}
<p><a href="${DASHBOARD_URL}" style="background:#D95F3C;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:12px;">Upgrade My Plan</a></p>
`;
}

// ─── Legacy: minute-based email body ─────────────────────────────────────────
function upgradeEmailBody(
  currentPlanName: string,
  currentPlanCost: number,
  minutesUsed: number,
  minutesLimit: number,
  overageRate: number,
  nextPlanName?: string,
  nextPlanPrice?: number,
): string {
  const overageMinutes = Math.max(0, minutesUsed - minutesLimit);
  const projectedOverage = overageMinutes * overageRate;
  const projectedTotal = currentPlanCost + projectedOverage;
  const nextPlanLine = nextPlanName && nextPlanPrice
    ? `<p><strong>Upgrade to ${nextPlanName}:</strong> $${nextPlanPrice}/mo — no overage projected at current usage</p>`
    : '';
  return `
<p>Current usage: <strong>${minutesUsed} / ${minutesLimit} minutes</strong></p>
<p>Overage minutes: <strong>${overageMinutes}</strong> at ${fmt$(overageRate)}/min</p>
<p>Projected overage cost: <strong>${fmt$(projectedOverage)}</strong></p>
<hr/>
<p><strong>Stay on ${currentPlanName}:</strong> est. ${fmt$(projectedTotal)} this month</p>
${nextPlanLine}
<p><a href="${DASHBOARD_URL}" style="background:#D95F3C;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:12px;">Upgrade My Plan</a></p>
`;
}

// ─── Send + Log ───────────────────────────────────────────────────────────────

/**
 * Send an alert (SMS + email) and log it to usage_alerts.
 * Returns true if alert was sent; false if already sent (deduped) or error.
 */
export async function sendUsageAlert(
  supabase: any,
  alertType: AlertType,
  ctx: AlertContext,
): Promise<boolean> {
  // Dedup check via alerts_sent JSONB on accounts
  const { data: acct } = await supabase
    .from('accounts')
    .select('alerts_sent')
    .eq('id', ctx.accountId)
    .single();

  const alertsSent: Record<string, string> = acct?.alerts_sent || {};
  if (alertsSent[alertType]) {
    logInfo(`[usage-alerts] Skipping duplicate alert ${alertType}`, {
      functionName: ctx.functionName,
      correlationId: ctx.correlationId,
      accountId: ctx.accountId,
    });
    return false;
  }

  const callPlan = PLAN_META_CALLS[ctx.planKey] || PLAN_META_CALLS['lite'];
  const minPlan = PLAN_META[ctx.planKey] || { name: ctx.planKey, overageRate: 0.28, includedMinutes: 600 };

  const callsUsed = ctx.callsUsed ?? 0;
  const callsLimit = ctx.callsLimit ?? callPlan.includedCalls;
  const selectedPlan = ctx.selectedPostTrialPlan
    ? (PLAN_META_CALLS[ctx.selectedPostTrialPlan]?.name ?? ctx.selectedPostTrialPlan)
    : 'Lite';
  const trialEndFmt = ctx.trialEndDate
    ? new Date(ctx.trialEndDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'in 3 days';

  let smsText = '';
  let emailSubject = '';
  let emailHtml = '';

  switch (alertType) {
    // ── NEW: Call-based trial alerts ──────────────────────────────────────────

    case 'trial_80_pct': {
      const remaining = Math.max(0, callsLimit - callsUsed);
      smsText = `RingSnap: You've used ${callsUsed} of your ${callsLimit} free trial calls. ${remaining} calls remaining. Start your plan at ${DASHBOARD_URL}`;
      emailSubject = `${callsUsed} of ${callsLimit} trial calls used — ${remaining} remaining`;
      emailHtml = `
<p>You've used <strong>${callsUsed} of ${callsLimit} free trial calls</strong>.</p>
<p>${remaining} calls remaining before your trial pauses.</p>
<p>After your trial, you'll automatically start your <strong>${selectedPlan}</strong> plan.</p>
<p><a href="${DASHBOARD_URL}" style="background:#D95F3C;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">View My Plan</a></p>`;
      break;
    }

    case 'trial_live_cap_reached': {
      smsText = `RingSnap: Your 15-call trial limit is reached. Your AI receptionist is paused. Start your plan to keep answering calls: ${DASHBOARD_URL}`;
      emailSubject = 'Trial limit reached — activate your plan to keep answering calls';
      emailHtml = `
<p>Your free trial has used all <strong>15 handled calls</strong>.</p>
<p>Your AI receptionist is <strong>paused</strong> until you activate a paid plan.</p>
<p>You're set to start <strong>${selectedPlan}</strong> on ${trialEndFmt}. Or activate early now:</p>
<p><a href="${DASHBOARD_URL}" style="background:#D95F3C;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Activate My Plan</a></p>`;
      break;
    }

    case 'trial_24h_before_convert': {
      const postPlan = PLAN_META_CALLS[ctx.selectedPostTrialPlan ?? 'lite'] ?? callPlan;
      smsText = `RingSnap: Your trial converts to ${postPlan.name} ($${postPlan.priceMonthly}/mo) in 24 hours. Change or cancel at ${DASHBOARD_URL}`;
      emailSubject = `24 hours until your RingSnap ${postPlan.name} plan starts`;
      emailHtml = `
<p>Your free trial ends <strong>tomorrow</strong>.</p>
<p>On ${trialEndFmt}, your <strong>${postPlan.name} plan</strong> will start at <strong>$${postPlan.priceMonthly}/month</strong>.</p>
<p>Includes ${postPlan.includedCalls} handled calls/month. Extra calls: ${fmt$(postPlan.overageRateDollars)}/call.</p>
<p>Want to change your plan or cancel? <a href="${DASHBOARD_URL}">Visit your dashboard.</a></p>`;
      break;
    }

    case 'trial_6h_before_convert': {
      const postPlan = PLAN_META_CALLS[ctx.selectedPostTrialPlan ?? 'lite'] ?? callPlan;
      smsText = `RingSnap: 6 hours until your ${postPlan.name} plan ($${postPlan.priceMonthly}/mo) starts. Change or cancel at ${DASHBOARD_URL}`;
      emailSubject = `6 hours until your ${postPlan.name} plan starts — last chance to change`;
      emailHtml = `
<p>Your <strong>${postPlan.name}</strong> plan starts in 6 hours.</p>
<p>Price: <strong>$${postPlan.priceMonthly}/month</strong> (${postPlan.includedCalls} calls included).</p>
<p>To change or cancel: <a href="${DASHBOARD_URL}">ringsnap.ai/dashboard</a></p>`;
      break;
    }

    case 'trial_converted': {
      const postPlan = PLAN_META_CALLS[ctx.selectedPostTrialPlan ?? 'lite'] ?? callPlan;
      smsText = `RingSnap: Your ${postPlan.name} plan is now active! Your AI receptionist is answering calls 24/7. ${DASHBOARD_URL}`;
      emailSubject = `Welcome to ${postPlan.name} — your AI receptionist is live`;
      emailHtml = `
<p>Your <strong>${postPlan.name}</strong> subscription is now active.</p>
<p>${postPlan.includedCalls} handled calls/month. Extra calls: ${fmt$(postPlan.overageRateDollars)}/call.</p>
<p><a href="${DASHBOARD_URL}" style="background:#D95F3C;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">View Dashboard</a></p>`;
      break;
    }

    // ── LEGACY: Minute-based trial alerts ─────────────────────────────────────

    case 'trial_70_pct':
      smsText = `RingSnap: You've used 35 of your 50 trial minutes. Your AI receptionist is working — start a plan to keep it going: ${DASHBOARD_URL}`;
      emailSubject = 'Your trial is 70% used — here\'s what to do next';
      emailHtml = `<p>You've used <strong>35 of 50 trial minutes</strong>. Your AI receptionist is working great — choose a plan to keep it going after your trial.</p><p><a href="${DASHBOARD_URL}" style="background:#D95F3C;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Choose My Plan</a></p>`;
      break;

    case 'trial_90_pct':
      smsText = `RingSnap: Only 5 trial minutes left! Don't lose your AI receptionist — choose a plan now: ${DASHBOARD_URL}`;
      emailSubject = '⚠️ 5 trial minutes remaining — act now';
      emailHtml = `<p>You have only <strong>5 trial minutes remaining</strong>. Once they're gone, your AI receptionist will pause until you start a plan.</p><p><a href="${DASHBOARD_URL}" style="background:#D95F3C;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Start My Plan Now</a></p>`;
      break;

    case 'trial_ended_minutes':
      smsText = `RingSnap: Your trial minutes are used up. Your AI receptionist is paused. Reactivate in 60 seconds: ${DASHBOARD_URL}`;
      emailSubject = 'Your trial has ended — reactivate your AI receptionist';
      emailHtml = `<p>Your 50 trial minutes have been used. Your AI receptionist is <strong>paused</strong>.</p><p>Reactivate in under 60 seconds by choosing a plan:</p><p><a href="${DASHBOARD_URL}" style="background:#D95F3C;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Reactivate Now</a></p>`;
      break;

    case 'trial_ended_time':
      smsText = `RingSnap: Your 3-day trial has ended. Start a plan to keep answering calls: ${DASHBOARD_URL}`;
      emailSubject = 'Your RingSnap trial has ended';
      emailHtml = `<p>Your 3-day free trial has ended. Your AI receptionist is <strong>paused</strong>.</p><p><a href="${DASHBOARD_URL}" style="background:#D95F3C;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Start My Plan</a></p>`;
      break;

    // ── NEW: Call-based plan usage alerts ─────────────────────────────────────

    case 'plan_80_pct': {
      const remaining = Math.max(0, callsLimit - callsUsed);
      smsText = `RingSnap: You've used ${callsUsed} of ${callsLimit} included calls (80%). ${remaining} calls left before overage. Upgrade: ${DASHBOARD_URL}`;
      emailSubject = `80% of included calls used — ${remaining} remaining`;
      emailHtml = upgradeCallsEmailBody(
        callPlan.name, callsUsed, callsLimit,
        callPlan.overageRateDollars, callPlan.nextPlan, callPlan.nextPlanPrice
      );
      break;
    }

    case 'plan_100_pct': {
      smsText = `RingSnap: You've used all ${callsLimit} included calls. Overage rate: ${fmt$(callPlan.overageRateDollars)}/call. Upgrade to avoid overage: ${DASHBOARD_URL}`;
      emailSubject = 'All included calls used — overage starts now';
      emailHtml = upgradeCallsEmailBody(
        callPlan.name, callsUsed, callsLimit,
        callPlan.overageRateDollars, callPlan.nextPlan, callPlan.nextPlanPrice
      );
      break;
    }

    case 'plan_overage_started': {
      const overageCalls = Math.max(0, callsUsed - callsLimit);
      const extraCost = overageCalls * callPlan.overageRateDollars;
      smsText = `RingSnap: You've passed your ${callPlan.name} included calls. Overage: ${fmt$(callPlan.overageRateDollars)}/call. Extra cost so far: ${fmt$(extraCost)}. Upgrade: ${DASHBOARD_URL}`;
      emailSubject = 'Overage started — here\'s what it costs and how to stop it';
      emailHtml = upgradeCallsEmailBody(
        callPlan.name, callsUsed, callsLimit,
        callPlan.overageRateDollars, callPlan.nextPlan, callPlan.nextPlanPrice
      );
      break;
    }

    case 'plan_80_pct_overage': {
      const overageCalls = Math.max(0, callsUsed - callsLimit);
      smsText = `RingSnap: ⚠️ 80% of overage calls used. Upgrade now to avoid calls stopping: ${DASHBOARD_URL}`;
      emailSubject = '⚠️ Near your overage limit — upgrade now to keep calls answered';
      emailHtml = `<p>You've used <strong>${overageCalls}</strong> of your max overage calls on <strong>${callPlan.name}</strong>.</p><p>Once the overage limit is reached, new calls will route to voicemail.</p><p><a href="${DASHBOARD_URL}" style="background:#D95F3C;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Upgrade Now</a></p>`;
      break;
    }

    case 'plan_ceiling_hit':
      smsText = `RingSnap: ACTION REQUIRED — Calls are routing to voicemail. You've hit your monthly safety limit. Upgrade immediately: ${DASHBOARD_URL}`;
      emailSubject = '🚨 Calls going to voicemail — immediate action required';
      emailHtml = `<p><strong>Your calls are routing to voicemail.</strong> You've reached the monthly safety ceiling on your ${callPlan.name} plan.</p><p>Upgrade immediately to restore call answering:</p><p><a href="${DASHBOARD_URL}" style="background:#D95F3C;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Upgrade My Plan</a></p>`;
      break;

    // ── LEGACY: Minute-based plan alerts ──────────────────────────────────────

    case 'plan_70_pct': {
      const projected = (ctx.minutesUsed / ctx.minutesLimit) * (minPlan.includedMinutes * minPlan.overageRate);
      smsText = `RingSnap: You've used 70% of your ${minPlan.name} minutes this month. Projected bill: ${fmt$(projected)}. Upgrade to save: ${DASHBOARD_URL}`;
      emailSubject = 'You\'re at 70% — here\'s your projected bill this month';
      emailHtml = upgradeEmailBody(minPlan.name, 0, ctx.minutesUsed, ctx.minutesLimit, minPlan.overageRate, minPlan.nextPlan, minPlan.nextPlanPrice);
      break;
    }

    case 'plan_90_pct':
      smsText = `RingSnap: ⚠️ 90% of ${minPlan.name} minutes used. Overage rate: ${fmt$(minPlan.overageRate)}/min. Upgrade now vs. pay overage: ${DASHBOARD_URL}`;
      emailSubject = '⚠️ You\'re at 90% — upgrade now or expect overage charges';
      emailHtml = upgradeEmailBody(minPlan.name, 0, ctx.minutesUsed, ctx.minutesLimit, minPlan.overageRate, minPlan.nextPlan, minPlan.nextPlanPrice);
      break;
  }

  // Send SMS
  if (ctx.customerPhone && smsText) {
    await sendSMS({
      to: ctx.customerPhone,
      message: smsText,
      functionName: ctx.functionName,
      correlationId: ctx.correlationId,
    });
  }

  // Send email
  if (ctx.customerEmail && emailSubject) {
    const fullHtml = `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">${emailHtml}</body></html>`;
    await sendEmail(ctx.customerEmail, emailSubject, fullHtml);
  }

  // Mark alert as sent in accounts.alerts_sent
  const newAlertsSent = { ...alertsSent, [alertType]: new Date().toISOString() };
  await supabase
    .from('accounts')
    .update({ alerts_sent: newAlertsSent })
    .eq('id', ctx.accountId);

  // Log to usage_alerts table
  await supabase.from('usage_alerts').insert({
    account_id: ctx.accountId,
    alert_type: alertType,
    metadata: {
      calls_used: ctx.callsUsed,
      calls_limit: ctx.callsLimit,
      minutes_used: ctx.minutesUsed,
      minutes_limit: ctx.minutesLimit,
      plan_key: ctx.planKey,
      customer_email: ctx.customerEmail,
      customer_phone: ctx.customerPhone,
    },
  });

  logInfo(`[usage-alerts] Sent alert: ${alertType}`, {
    functionName: ctx.functionName,
    correlationId: ctx.correlationId,
    accountId: ctx.accountId,
  });

  return true;
}
