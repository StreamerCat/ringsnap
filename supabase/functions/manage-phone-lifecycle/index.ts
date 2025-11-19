import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { extractCorrelationId, logError, logInfo, logWarn } from '../_shared/logging.ts';

const FUNCTION_NAME = 'manage-phone-lifecycle';

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

    logInfo('Running phone lifecycle management cron', {
      ...baseLogOptions
    });

    // Find phone numbers that should be released (held for 7 days)
    const now = new Date().toISOString();
    const { data: numbersToRelease, error } = await supabase
      .from('phone_numbers')
      .select('*')
      .eq('status', 'held')
      .lte('held_until', now);

    if (error) {
      logError('Error fetching phone numbers for lifecycle management', {
        ...baseLogOptions,
        error
      });
      return new Response(
        JSON.stringify({ error: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    logInfo('Phone numbers identified for release', {
      ...baseLogOptions,
      context: { count: numbersToRelease?.length || 0 }
    });

    let releasedCount = 0;
    let savedCostCents = 0;

    for (const phoneNumber of numbersToRelease || []) {
      const phoneAccountId = phoneNumber.account_id ?? null;
      try {
        logInfo('Releasing phone number', {
          ...baseLogOptions,
          accountId: phoneAccountId,
          context: { phoneNumber: phoneNumber.phone_number }
        });

        // Call VAPI API to release the phone number
        if (phoneNumber.vapi_phone_id) {
          const vapiResponse = await fetch(
            `https://api.vapi.ai/phone-number/${phoneNumber.vapi_phone_id}`,
            {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${Deno.env.get('VAPI_API_KEY')}`,
              },
            }
          );

          if (!vapiResponse.ok) {
            logWarn('VAPI release failed for phone number', {
              ...baseLogOptions,
              accountId: phoneAccountId,
              context: {
                phoneNumber: phoneNumber.phone_number,
                response: await vapiResponse.text()
              }
            });
          } else {
            logInfo('VAPI phone number released successfully', {
              ...baseLogOptions,
              accountId: phoneAccountId,
              context: { vapiPhoneId: phoneNumber.vapi_phone_id }
            });
          }
        }

        // Update database status
        await supabase
          .from('phone_numbers')
          .update({
            status: 'released',
            held_until: null
          })
          .eq('id', phoneNumber.id);

        releasedCount++;
        savedCostCents += 500; // Estimate $5/month per number

        logInfo('Phone number released successfully', {
          ...baseLogOptions,
          accountId: phoneAccountId,
          context: { phoneNumber: phoneNumber.phone_number }
        });

      } catch (phoneError) {
        logError('Error releasing phone number', {
          ...baseLogOptions,
          accountId: phoneAccountId,
          error: phoneError,
          context: { phoneNumber: phoneNumber.phone_number }
        });
      }
    }

    const savedCostDollars = (savedCostCents / 100).toFixed(2);
    logInfo('Phone lifecycle run summary', {
      ...baseLogOptions,
      context: {
        releasedCount,
        savedCostMonthlyDollars: savedCostDollars
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        released: releasedCount,
        saved_cost_monthly_cents: savedCostCents
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    logError('Phone lifecycle cron error', {
      ...baseLogOptions,
      error
    });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
