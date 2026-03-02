import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "supabase";
import { extractCorrelationId, logError, logInfo, logWarn } from '../_shared/logging.ts';
import type { LogOptions } from '../_shared/logging.ts';
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
// Usage alerts — sends SMS + email and dedupes via accounts.alerts_sent
import { sendUsageAlert } from '../_shared/usage-alerts.ts';

const FUNCTION_NAME = 'sync-usage';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const correlationId = extractCorrelationId(req);
  const baseLogOptions = { functionName: FUNCTION_NAME, correlationId };
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
    const stripe = stripeKey ? new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    }) : null;

    // Parse VAPI post-call webhook
    const payload = await req.json();
    const { call, customData } = payload;
    const accountId = customData?.accountId;

    logInfo('Sync usage webhook received', {
      ...baseLogOptions,
      accountId,
      context: {
        duration: call?.duration,
        cost: call?.cost,
        callId: call?.id
      }
    });

    if (!accountId) {
      return new Response(
        JSON.stringify({ error: 'Account ID required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get account details (supports both old plan_type and new plan_key schemas)
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select(
        '*, ' +
        'plan_key, trial_active, trial_minutes_used, trial_minutes_limit, ' +
        'minutes_used_current_period, overage_minutes_current_period, ' +
        'subscription_status, stripe_overage_item_id, alerts_sent'
      )
      .eq('id', accountId)
      .single();

    if (accountError || !account) {
      logError('Account not found during sync usage', {
        ...baseLogOptions,
        accountId,
        error: accountError
      });
      return new Response(
        JSON.stringify({ error: 'Account not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Calculate call duration in minutes (ceiling to next whole minute)
    const durationSeconds = call.duration || 0;
    const durationMinutes = Math.ceil(durationSeconds / 60);

    // ── Determine plan context ────────────────────────────────────────────────
    const planKey: string = account.plan_key || account.plan_type || 'night_weekend';
    const isTrial = account.trial_active === true || account.subscription_status === 'trial';

    // Fetch plan limits from plans table (new schema)
    const { data: plan } = await supabase
      .from('plans')
      .select('included_minutes')
      .eq('plan_key', planKey)
      .maybeSingle();

    // Fallback: use old monthly_minutes_limit column if new plan table not yet populated
    const includedMinutes: number =
      plan?.included_minutes ?? account.monthly_minutes_limit ?? 600;

    // ── Update trial minutes (3a: increment trial_minutes_used) ───────────────
    if (isTrial) {
      const newTrialUsed = (account.trial_minutes_used || 0) + durationMinutes;
      await supabase
        .from('accounts')
        .update({ trial_minutes_used: newTrialUsed })
        .eq('id', accountId);

      logInfo('Trial minutes updated', {
        ...baseLogOptions,
        accountId,
        context: { durationMinutes, newTrialUsed },
      });

      // Log usage record for trial call
      await supabase.from('usage_logs').insert({
        account_id: accountId,
        duration_seconds: durationSeconds,
        cost_cents: Math.round((call.cost || 0) * 100),
        call_metadata: call,
        is_overage: false,
      }).select('id').maybeSingle();

      return new Response(
        JSON.stringify({ success: true, minutes_used: durationMinutes, is_trial: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // ── Update plan period minutes ────────────────────────────────────────────
    const currentPeriodUsed = account.minutes_used_current_period || 0;
    const newPeriodUsed = currentPeriodUsed + durationMinutes;
    const isOverage = currentPeriodUsed >= includedMinutes;
    const newOverageMinutes = Math.max(0, newPeriodUsed - includedMinutes);

    await supabase
      .from('accounts')
      .update({
        minutes_used_current_period: newPeriodUsed,
        overage_minutes_current_period: newOverageMinutes,
        // Also keep legacy columns in sync for backwards compatibility
        monthly_minutes_used: newPeriodUsed,
        overage_minutes_used: newOverageMinutes,
      })
      .eq('id', accountId);

    // Legacy: if was on trial and ran out, update subscription_status
    const currentMonthlyUsed = account.monthly_minutes_used || 0;
    const monthlyLimit = account.monthly_minutes_limit || 150;

    // Log usage
    const { data: usageLog, error: usageLogError } = await supabase
      .from('usage_logs')
      .insert({
        account_id: accountId,
        duration_seconds: durationSeconds,
        cost_cents: Math.round((call.cost || 0) * 100),
        call_metadata: call,
        is_overage: isOverage
      })
      .select('id')
      .single();

    if (usageLogError) {
      logError('Failed to insert usage log', {
        ...baseLogOptions,
        accountId,
        error: usageLogError
      });
    }

    // Create customer lead from call (best-effort, don't block usage tracking)
    if (usageLog && call) {
      try {
        await createCustomerLead(supabase, accountId, call, usageLog.id, baseLogOptions);
      } catch (leadError) {
        logError('Failed to create customer lead (non-blocking)', {
          ...baseLogOptions,
          accountId,
          error: leadError
        });
        // Don't throw - lead creation failure shouldn't block usage tracking
      }
    }

    // ── Post-call threshold alerts ────────────────────────────────────────────
    // Fetch customer contact info for alert sending
    let customerEmail: string | null = null;
    let customerPhone: string | null = null;
    const { data: alertProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('account_id', accountId)
      .eq('is_primary', true)
      .maybeSingle();

    if (alertProfile?.id) {
      const { data: authUser } = await supabase.auth.admin.getUserById(alertProfile.id);
      customerEmail = authUser?.user?.email || null;
      customerPhone = authUser?.user?.phone || null;
    }

    const alertCtx = {
      accountId,
      customerPhone,
      customerEmail,
      planKey,
      minutesUsed: newPeriodUsed,
      minutesLimit: includedMinutes,
      functionName: FUNCTION_NAME,
      correlationId,
    };

    const usagePercentage = includedMinutes > 0 ? (newPeriodUsed / includedMinutes) * 100 : 0;

    logInfo('Usage percentage calculated', {
      ...baseLogOptions,
      accountId,
      context: { usagePercentage, newPeriodUsed, includedMinutes }
    });

    if (newPeriodUsed >= includedMinutes) {
      await sendUsageAlert(supabase, 'plan_overage_started', alertCtx);
    } else if (usagePercentage >= 90) {
      await sendUsageAlert(supabase, 'plan_90_pct', alertCtx);
    } else if (usagePercentage >= 70) {
      await sendUsageAlert(supabase, 'plan_70_pct', alertCtx);
    }

    // Also keep legacy warning_level in sync for backwards compat with UI
    const legacyLevel =
      usagePercentage >= 100 ? '100' :
      usagePercentage >= 95  ? '95'  :
      usagePercentage >= 80  ? '80'  : null;

    if (legacyLevel && account.last_usage_warning_level !== legacyLevel) {
      await supabase
        .from('accounts')
        .update({
          last_usage_warning_sent_at: new Date().toISOString(),
          last_usage_warning_level: legacyLevel,
        })
        .eq('id', accountId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        minutes_used: durationMinutes,
        is_overage: isOverage,
        total_period_minutes: newPeriodUsed,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    logError('Sync usage error', {
      ...baseLogOptions,
      error
    });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// Helper to end trial
async function endTrialNow(
  stripe: Stripe,
  subscriptionId: string,
  accountId: string,
  logOptions: any
) {
  try {
    logInfo('Ending trial due to usage limit reached', {
      ...logOptions,
      accountId,
      context: { subscriptionId }
    });

    await stripe.subscriptions.update(subscriptionId, {
      trial_end: 'now',
    });

    return true;
  } catch (err: any) {
    logError('Failed to end trial in Stripe', {
      ...logOptions,
      accountId,
      error: err,
      context: { subscriptionId }
    });
    return false;
  }
}

async function sendUsageWarning(
  account: Record<string, unknown>,
  level: string,
  percentage: number,
  used: number,
  limit: number,
  logOptions: Pick<LogOptions, 'functionName' | 'correlationId'>
) {
  logInfo('Usage warning email pending send', {
    ...logOptions,
    accountId: typeof account.id === 'string' ? account.id : null,
    context: { level, percentage, used, limit }
  });
  // TODO: Integrate with Resend or email service
  // Email content: "You've used {percentage}% ({used}/{limit} minutes) of your monthly minutes"
  // For 95%: Add upgrade CTA to avoid overage charges
}

async function sendOverageNotification(
  account: Record<string, unknown>,
  overageRateCents: number,
  logOptions: Pick<LogOptions, 'functionName' | 'correlationId'>
) {
  const overageRateDollars = (overageRateCents / 100).toFixed(2);
  logInfo('Overage notification email pending send', {
    ...logOptions,
    accountId: typeof account.id === 'string' ? account.id : null,
    context: { overageRateDollars }
  });
  // TODO: Integrate with Resend
  // Email content: "You're now in overage billing at ${overageRateDollars}/minute"
}

/**
 * Create customer lead from Vapi call
 * Extracts customer information from call metadata and creates a lead record
 */
async function createCustomerLead(
  supabase: any,
  accountId: string,
  call: any,
  usageLogId: string,
  logOptions: Pick<LogOptions, 'functionName' | 'correlationId'>
) {
  // Extract customer phone from call
  // Vapi stores customer phone in call.customer.number or call.phoneNumber
  const customerPhone = call.customer?.number || call.phoneNumber || call.phoneNumberE164;

  if (!customerPhone) {
    logInfo('No customer phone in call, skipping lead creation', {
      ...logOptions,
      accountId,
      context: { callId: call.id }
    });
    return;
  }

  // Extract customer name if available
  const customerName = call.customer?.name || null;

  // Extract call summary/transcript if available
  const callSummary = call.summary || call.transcript || null;
  const callTranscript = call.transcript || null;

  // Try to infer intent from call metadata or summary
  let intent = 'unknown';
  const summaryLower = (callSummary || '').toLowerCase();
  if (summaryLower.includes('appointment') || summaryLower.includes('schedule') || summaryLower.includes('book')) {
    intent = 'appointment';
  } else if (summaryLower.includes('quote') || summaryLower.includes('estimate') || summaryLower.includes('price')) {
    intent = 'quote';
  } else if (summaryLower.includes('question') || summaryLower.includes('ask') || summaryLower.includes('inquiry')) {
    intent = 'question';
  }

  // Determine urgency from call metadata
  let urgency = 'medium';
  if (summaryLower.includes('emergency') || summaryLower.includes('urgent') || summaryLower.includes('asap')) {
    urgency = 'emergency';
  } else if (summaryLower.includes('soon') || summaryLower.includes('today')) {
    urgency = 'high';
  }

  logInfo('Creating customer lead from call', {
    ...logOptions,
    accountId,
    context: {
      callId: call.id,
      customerPhone,
      hasName: !!customerName,
      intent,
      urgency
    }
  });

  // Insert customer lead
  const { data: lead, error: leadError } = await supabase
    .from('customer_leads')
    .insert({
      account_id: accountId,
      call_id: call.id,
      usage_log_id: usageLogId,
      customer_phone: customerPhone,
      customer_name: customerName,
      lead_source: 'phone_call',
      lead_status: 'new',
      intent: intent,
      call_summary: callSummary,
      call_transcript: callTranscript,
      call_duration_seconds: call.duration || 0,
      urgency: urgency,
      metadata: {
        vapi_call_id: call.id,
        call_type: call.type,
        ended_reason: call.endedReason,
        cost_cents: Math.round((call.cost || 0) * 100)
      }
    })
    .select('id')
    .single();

  if (leadError) {
    throw leadError;
  }

  logInfo('Customer lead created successfully', {
    ...logOptions,
    accountId,
    context: {
      lead_id: lead.id,
      callId: call.id,
      customerPhone,
      intent
    }
  });
}
