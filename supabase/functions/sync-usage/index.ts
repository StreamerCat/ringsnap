import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { extractCorrelationId, logError, logInfo, logWarn } from '../_shared/logging.ts';
import type { LogOptions } from '../_shared/logging.ts';

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

    // Get account details
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('*, plan_definitions!inner(*)')
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

    // Calculate call duration in minutes (round up)
    const durationSeconds = call.duration || 0;
    const durationMinutes = Math.ceil(durationSeconds / 60);

    // Determine if this is overage
    const currentMonthlyUsed = account.monthly_minutes_used || 0;
    const monthlyLimit = account.monthly_minutes_limit || 150;
    const isOverage = currentMonthlyUsed >= monthlyLimit;

    // Update appropriate counter
    if (isOverage) {
      await supabase
        .from('accounts')
        .update({
          overage_minutes_used: (account.overage_minutes_used || 0) + durationMinutes
        })
        .eq('id', accountId);
    } else {
      const newMonthlyUsed = currentMonthlyUsed + durationMinutes;
      await supabase
        .from('accounts')
        .update({
          monthly_minutes_used: newMonthlyUsed
        })
        .eq('id', accountId);
    }

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

    // Check warning thresholds and send emails
    const totalUsed = isOverage ? monthlyLimit : currentMonthlyUsed + durationMinutes;
    const usagePercentage = (totalUsed / monthlyLimit) * 100;

    logInfo('Usage percentage calculated', {
      ...baseLogOptions,
      accountId,
      context: { usagePercentage }
    });

    // 80% warning
    if (usagePercentage >= 80 && usagePercentage < 95 && account.last_usage_warning_level !== '80') {
      logInfo('Sending 80% usage warning', {
        ...baseLogOptions,
        accountId,
        context: { usagePercentage }
      });
      await sendUsageWarning(account, '80', usagePercentage, totalUsed, monthlyLimit, baseLogOptions);
      await supabase
        .from('accounts')
        .update({
          last_usage_warning_sent_at: new Date().toISOString(),
          last_usage_warning_level: '80'
        })
        .eq('id', accountId);
    }

    // 95% warning
    if (usagePercentage >= 95 && usagePercentage < 100 && account.last_usage_warning_level !== '95') {
      logInfo('Sending 95% usage warning', {
        ...baseLogOptions,
        accountId,
        context: { usagePercentage }
      });
      await sendUsageWarning(account, '95', usagePercentage, totalUsed, monthlyLimit, baseLogOptions);
      await supabase
        .from('accounts')
        .update({
          last_usage_warning_sent_at: new Date().toISOString(),
          last_usage_warning_level: '95'
        })
        .eq('id', accountId);
    }

    // 100% overage notification
    if (usagePercentage >= 100 && account.last_usage_warning_level !== '100') {
      logInfo('Sending 100% overage notification', {
        ...baseLogOptions,
        accountId,
        context: { usagePercentage }
      });
      const overageRate = account.plan_definitions?.overage_rate_cents || 0;
      await sendOverageNotification(account, overageRate, baseLogOptions);
      await supabase
        .from('accounts')
        .update({
          last_usage_warning_sent_at: new Date().toISOString(),
          last_usage_warning_level: '100'
        })
        .eq('id', accountId);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        minutes_used: durationMinutes,
        is_overage: isOverage
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
