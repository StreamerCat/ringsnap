import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?target=deno";
import { extractCorrelationId, logError, logInfo, logWarn } from '../_shared/logging.ts';

const FUNCTION_NAME = 'manage-phone-lifecycle';
const VAPI_BASE_URL = "https://api.vapi.ai";
const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");

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

    const now = new Date();
    const nowIso = now.toISOString();

    // 1. HANDLE TRIAL EXPIRATION (Disable Access)
    // Find numbers where trial has expired, but not yet retained/released, and subscription is NOT active.
    // We assume 'active' numbers with expired trial need to be disabled.
    const { data: expiredTrials, error: expiredError } = await supabase
      .from('phone_numbers')
      .select('id, account_id, status, trial_expires_at, accounts!inner(subscription_status)')
      .eq('status', 'active') // Only disable active numbers
      .lt('trial_expires_at', nowIso)
      .neq('accounts.subscription_status', 'active');

    if (expiredError) {
      logError('Error fetching expired trials', { ...baseLogOptions, error: expiredError });
    } else if (expiredTrials && expiredTrials.length > 0) {
      logInfo('Processing expired trials', {
        ...baseLogOptions,
        context: { count: expiredTrials.length }
      });

      for (const record of expiredTrials) {
        // Disable the number (business logic: hide from UI, block calls)
        // We set status to 'disabled'
        await supabase
          .from('phone_numbers')
          .update({ status: 'disabled' })
          .eq('id', record.id);

        logInfo('Disabled phone number due to trial expiration', {
          ...baseLogOptions,
          accountId: record.account_id,
          context: { phoneId: record.id }
        });
      }
    }

    // 2. HANDLE PHONE RETENTION EXPIRATION (Release Number)
    // Find numbers (active or disabled) where retention has expired and no active subscription
    const { data: retentionExpired, error: retentionError } = await supabase
      .from('phone_numbers')
      .select('id, account_id, status, phone_retention_expires_at, vapi_phone_id, phone_number, accounts!inner(subscription_status)')
      .in('status', ['active', 'disabled', 'suspended']) // Release from any holding state
      .lt('phone_retention_expires_at', nowIso)
      .neq('accounts.subscription_status', 'active');

    if (retentionError) {
      logError('Error fetching retention expired numbers', { ...baseLogOptions, error: retentionError });
    } else if (retentionExpired && retentionExpired.length > 0) {
      logInfo('Processing retention expirations', {
        ...baseLogOptions,
        context: { count: retentionExpired.length }
      });

      for (const record of retentionExpired) {
        // Release from Vapi
        if (record.vapi_phone_id) {
          const vapiResponse = await fetch(
            `${VAPI_BASE_URL}/phone-number/${record.vapi_phone_id}`,
            {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${VAPI_API_KEY}`,
              },
            }
          );

          if (!vapiResponse.ok) {
            const errText = await vapiResponse.text();
            logWarn('VAPI release failed (retention)', {
              ...baseLogOptions,
              accountId: record.account_id,
              context: { error: errText, vapiPhoneId: record.vapi_phone_id }
            });
            // We continue to update DB status anyway to stop trying? 
            // Or maybe we should retry? For now, we update status to 'released_failed' or just 'released' if we want to clean up DB.
            // Let's mark as 'released' to avoid infinite loops, but log the error.
          } else {
            logInfo('VAPI phone number released (retention)', {
              ...baseLogOptions,
              context: { vapiPhoneId: record.vapi_phone_id }
            });
          }
        }

        // Update DB
        await supabase
          .from('phone_numbers')
          .update({
            status: 'released',
            phone_provisioned: false, // Update flag as requested
          })
          .eq('id', record.id);
      }
    }

    // 3. HANDLE LEGACY 'HELD' STATUS (Original Logic)
    // Find phone numbers that should be released (held for X days)
    const { data: numbersToRelease, error } = await supabase
      .from('phone_numbers')
      .select('*')
      .eq('status', 'held')
      .lte('held_until', nowIso);

    if (error) {
      logError('Error fetching held phone numbers', {
        ...baseLogOptions,
        error
      });
    } else if (numbersToRelease && numbersToRelease.length > 0) {
      logInfo('Phone numbers identified for release (held status)', {
        ...baseLogOptions,
        context: { count: numbersToRelease.length }
      });

      let releasedCount = 0;

      for (const phoneNumber of numbersToRelease) {
        const phoneAccountId = phoneNumber.account_id ?? null;
        try {
          // Call VAPI API to release the phone number
          if (phoneNumber.vapi_phone_id) {
            const vapiResponse = await fetch(
              `${VAPI_BASE_URL}/phone-number/${phoneNumber.vapi_phone_id}`,
              {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${VAPI_API_KEY}`,
                },
              }
            );

            if (!vapiResponse.ok) {
              logWarn('VAPI release failed for held phone number', {
                ...baseLogOptions,
                accountId: phoneAccountId,
                context: {
                  phoneNumber: phoneNumber.phone_number,
                  response: await vapiResponse.text()
                }
              });
            } else {
              logInfo('VAPI held phone number released successfully', {
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

        } catch (phoneError) {
          logError('Error releasing held phone number', {
            ...baseLogOptions,
            accountId: phoneAccountId,
            error: phoneError,
            context: { phoneNumber: phoneNumber.phone_number }
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Lifecycle management completed"
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
