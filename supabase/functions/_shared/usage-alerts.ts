/**
 * usage-alerts.ts
 *
 * Shared module for sending usage threshold alerts (SMS + Email).
 * All alert sends are logged to the `usage_alerts` table.
 * Each alert type is sent at most once per billing period (deduped via alerts_sent JSONB).
 */

import { sendSMS } from './sms.ts';
import { logError, logInfo } from './logging.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || Deno.env.get('RESEND_PROD_KEY') || '';
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'RingSnap <noreply@getringsnap.com>';
const DASHBOARD_URL = 'https://ringsnap.ai/dashboard';

// ─── Plan metadata (mirrors plans table — avoids extra DB lookup) ─────────────
export const PLAN_META: Record<string, { name: string; overageRate: number; includedMinutes: number; nextPlan?: string; nextPlanPrice?: number }> = {
  night_weekend: { name: 'Night & Weekend', overageRate: 0.45, includedMinutes: 150, nextPlan: 'Lite', nextPlanPrice: 129 },
  lite:          { name: 'Lite',            overageRate: 0.38, includedMinutes: 300, nextPlan: 'Core', nextPlanPrice: 229 },
  core:          { name: 'Core',            overageRate: 0.28, includedMinutes: 600, nextPlan: 'Pro',  nextPlanPrice: 399 },
  pro:           { name: 'Pro',             overageRate: 0.22, includedMinutes: 1200 },
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type AlertType =
  | 'trial_70_pct'
  | 'trial_90_pct'
  | 'trial_ended_minutes'
  | 'trial_ended_time'
  | 'plan_70_pct'
  | 'plan_90_pct'
  | 'plan_overage_started'
  | 'plan_ceiling_hit';

export interface AlertContext {
  accountId: string;
  customerPhone?: string | null;  // customer's contact phone for SMS
  customerEmail?: string | null;
  planKey: string;
  minutesUsed: number;
  minutesLimit: number;
  functionName: string;
  correlationId: string;
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
    // Non-fatal — log only
    console.error('[usage-alerts] Email send failed:', e);
  }
}

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
  // Check dedup via alerts_sent JSONB on accounts
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

  const plan = PLAN_META[ctx.planKey] || { name: ctx.planKey, overageRate: 0.28, includedMinutes: 600 };
  const { name: planName, overageRate, nextPlan, nextPlanPrice } = plan;

  let smsText = '';
  let emailSubject = '';
  let emailHtml = '';

  switch (alertType) {
    // ── Trial alerts ──────────────────────────────────────────────────────────
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

    // ── Plan usage alerts ─────────────────────────────────────────────────────
    case 'plan_70_pct': {
      const projected = (ctx.minutesUsed / ctx.minutesLimit) * (plan.includedMinutes * overageRate);
      smsText = `RingSnap: You've used 70% of your ${planName} minutes this month. Projected bill: ${fmt$(projected)}. Upgrade to save: ${DASHBOARD_URL}`;
      emailSubject = 'You\'re at 70% — here\'s your projected bill this month';
      emailHtml = upgradeEmailBody(planName, 0, ctx.minutesUsed, ctx.minutesLimit, overageRate, nextPlan, nextPlanPrice);
      break;
    }

    case 'plan_90_pct':
      smsText = `RingSnap: ⚠️ 90% of ${planName} minutes used. Overage rate: ${fmt$(overageRate)}/min. Upgrade now vs. pay overage: ${DASHBOARD_URL}`;
      emailSubject = '⚠️ You\'re at 90% — upgrade now or expect overage charges';
      emailHtml = upgradeEmailBody(planName, 0, ctx.minutesUsed, ctx.minutesLimit, overageRate, nextPlan, nextPlanPrice);
      break;

    case 'plan_overage_started': {
      const overageMin = Math.max(0, ctx.minutesUsed - ctx.minutesLimit);
      const extraCost = overageMin * overageRate;
      smsText = `RingSnap: You've passed your ${planName} included minutes. Overage rate: ${fmt$(overageRate)}/min. Current extra: ${fmt$(extraCost)}. Upgrade to a higher plan: ${DASHBOARD_URL}`;
      emailSubject = 'You\'re now on overage — here\'s what it costs and how to stop it';
      emailHtml = upgradeEmailBody(planName, 0, ctx.minutesUsed, ctx.minutesLimit, overageRate, nextPlan, nextPlanPrice);
      break;
    }

    case 'plan_ceiling_hit':
      smsText = `RingSnap: ACTION REQUIRED — Calls are routing to voicemail. You've hit your monthly safety limit. Upgrade immediately: ${DASHBOARD_URL}`;
      emailSubject = '🚨 Calls going to voicemail — immediate action required';
      emailHtml = `<p><strong>Your calls are routing to voicemail.</strong> You've reached the monthly safety ceiling on your ${planName} plan.</p><p>Upgrade immediately to restore 24/7 call answering:</p><p><a href="${DASHBOARD_URL}" style="background:#D95F3C;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Upgrade My Plan</a></p>`;
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
