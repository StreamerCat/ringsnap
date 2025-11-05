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

    // Parse VAPI webhook payload
    const { phoneNumber, customData } = await req.json();
    const accountId = customData?.accountId;

    console.log('Authorize call request:', { phoneNumber, accountId });

    if (!accountId) {
      return new Response(
        JSON.stringify({ 
          allowed: false, 
          message: 'Account not found' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Fetch account details
    const { data: account, error } = await supabase
      .from('accounts')
      .select('id, account_status, monthly_minutes_limit, monthly_minutes_used, overage_minutes_used, overage_cap_percentage, plan_type')
      .eq('id', accountId)
      .single();

    if (error || !account) {
      console.error('Account not found:', error);
      return new Response(
        JSON.stringify({ 
          allowed: false, 
          message: 'Account not found' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Check account status
    if (['suspended', 'disabled', 'cancelled'].includes(account.account_status)) {
      console.log('Account not active:', account.account_status);
      return new Response(
        JSON.stringify({ 
          allowed: false, 
          message: `Account is ${account.account_status}. Please contact support.` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Calculate total minutes used
    const totalMinutes = (account.monthly_minutes_used || 0) + (account.overage_minutes_used || 0);

    // Calculate safety cap (200% of monthly limit by default)
    const safetyCapMinutes = Math.floor(
      account.monthly_minutes_limit * (account.overage_cap_percentage / 100)
    );

    console.log('Usage check:', {
      totalMinutes,
      monthlyLimit: account.monthly_minutes_limit,
      safetyCap: safetyCapMinutes,
      overagePercentage: account.overage_cap_percentage
    });

    // SOFT LIMIT: Only deny if safety cap reached (extreme edge case)
    if (totalMinutes >= safetyCapMinutes) {
      console.warn('Safety cap reached:', { totalMinutes, safetyCap: safetyCapMinutes });
      
      // Flag account for review
      await supabase
        .from('call_pattern_alerts')
        .insert({
          account_id: accountId,
          alert_type: 'safety_cap_reached',
          alert_details: {
            total_minutes: totalMinutes,
            safety_cap: safetyCapMinutes,
            overage_percentage: account.overage_cap_percentage
          },
          severity: 'high',
          auto_flagged: true
        });

      return new Response(
        JSON.stringify({ 
          allowed: false, 
          message: 'Account has reached usage safety limit. Please contact support to increase your limit.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Check for suspicious call patterns
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentCalls } = await supabase
      .from('usage_logs')
      .select('id, duration_seconds')
      .eq('account_id', accountId)
      .gte('created_at', oneHourAgo);

    if (recentCalls && recentCalls.length > 50) {
      console.warn('High call volume detected:', recentCalls.length);
      
      await supabase
        .from('call_pattern_alerts')
        .insert({
          account_id: accountId,
          alert_type: 'high_call_volume',
          alert_details: {
            calls_last_hour: recentCalls.length,
            threshold: 50
          },
          severity: 'medium',
          auto_flagged: true
        });

      await supabase
        .from('accounts')
        .update({
          is_flagged_for_review: true,
          flagged_reason: 'High call volume detected'
        })
        .eq('id', accountId);
    }

    // Check for short call abuse pattern
    if (recentCalls && recentCalls.length > 10) {
      const shortCalls = recentCalls.filter(c => c.duration_seconds && c.duration_seconds < 30);
      const shortCallPercentage = (shortCalls.length / recentCalls.length) * 100;

      if (shortCallPercentage > 80) {
        console.warn('Suspicious short call pattern:', shortCallPercentage);
        
        await supabase
          .from('call_pattern_alerts')
          .insert({
            account_id: accountId,
            alert_type: 'short_call_abuse',
            alert_details: {
              short_calls: shortCalls.length,
              total_calls: recentCalls.length,
              percentage: shortCallPercentage
            },
            severity: 'high',
            auto_flagged: true
          });

        await supabase
          .from('accounts')
          .update({
            is_flagged_for_review: true,
            flagged_reason: 'Suspicious call pattern (80%+ calls <30 seconds)'
          })
          .eq('id', accountId);
      }
    }

    // ALLOW CALL (Soft limit - calls are always allowed until safety cap)
    console.log('Call authorized');
    return new Response(
      JSON.stringify({ 
        allowed: true 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Authorization error:', error);
    return new Response(
      JSON.stringify({ 
        allowed: false, 
        message: 'Error processing request' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
});
