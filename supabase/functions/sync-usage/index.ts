import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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

    console.log('Sync usage:', {
      accountId,
      duration: call.duration,
      cost: call.cost
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
      console.error('Account not found:', accountError);
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
    await supabase
      .from('usage_logs')
      .insert({
        account_id: accountId,
        duration_seconds: durationSeconds,
        cost_cents: Math.round((call.cost || 0) * 100),
        call_metadata: call,
        is_overage: isOverage
      });

    // Check warning thresholds and send emails
    const totalUsed = isOverage ? monthlyLimit : currentMonthlyUsed + durationMinutes;
    const usagePercentage = (totalUsed / monthlyLimit) * 100;

    console.log('Usage percentage:', usagePercentage);

    // 80% warning
    if (usagePercentage >= 80 && usagePercentage < 95 && account.last_usage_warning_level !== '80') {
      console.log('Sending 80% warning');
      await sendUsageWarning(supabase, account, '80', usagePercentage, totalUsed, monthlyLimit);
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
      console.log('Sending 95% warning');
      await sendUsageWarning(supabase, account, '95', usagePercentage, totalUsed, monthlyLimit);
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
      console.log('Sending 100% overage notification');
      const overageRate = account.plan_definitions?.overage_rate_cents || 0;
      await sendOverageNotification(supabase, account, overageRate);
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
    console.error('Sync usage error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

async function sendUsageWarning(
  supabase: any,
  account: any,
  level: string,
  percentage: number,
  used: number,
  limit: number
) {
  console.log(`Would send ${level}% warning email to account ${account.id}`);
  // TODO: Integrate with Resend or email service
  // Email content: "You've used {percentage}% ({used}/{limit} minutes) of your monthly minutes"
  // For 95%: Add upgrade CTA to avoid overage charges
}

async function sendOverageNotification(
  supabase: any,
  account: any,
  overageRateCents: number
) {
  const overageRateDollars = (overageRateCents / 100).toFixed(2);
  console.log(`Would send overage notification email to account ${account.id}`);
  console.log(`Overage rate: $${overageRateDollars}/minute`);
  // TODO: Integrate with Resend
  // Email content: "You're now in overage billing at ${overageRateDollars}/minute"
}
