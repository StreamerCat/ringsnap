import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "supabase";
import { extractCorrelationId, logError, logInfo, logWarn } from '../_shared/logging.ts';
import { POOL_CONFIG } from '../_shared/pool-config.ts';

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

    // 1. HANDLE INACTIVE SERVICE (Release Number)
    // Find numbers where account is effectively dead:
    // - Status is 'cancelled' and hold period expired (checked via phone_number_held_until)
    // - Status is 'unpaid' (delinquent) or 'incomplete_expired'
    // - Account status is 'banned' or 'fraud'
    // - Provisioning failed (status 'failed' or similar?) -> usually 'phone_number_status' in accounts

    // We construct a query for accounts that meet these criteria.
    // Also ensuring we fetch unpaid_since for grace period check.
    const { data: inactiveServiceNumbers, error: inactiveError } = await supabase
      .from('phone_numbers')
      .select('id, account_id, status, accounts!inner(subscription_status, account_status, phone_number_held_until, phone_number_status, unpaid_since)')
      .eq('status', 'active') // Only release currently active numbers
      .or('subscription_status.eq.canceled,subscription_status.eq.unpaid,subscription_status.eq.incomplete_expired,account_status.eq.banned');

    // Filter further in JS for complex logic like "cancelled AND hold expired"
    // Also include provisioning failures if phone_number_status is 'failed'?
    // The user mentioned "provisioning failed" as a trigger.

    // Safety Blocklist: Never release these via this cron (unless banned)
    const ACTIVE_STATUSES = ['active', 'trialing', 'past_due'];
    let numbersToRelease: any[] = [];

    if (inactiveServiceNumbers) {
      numbersToRelease = inactiveServiceNumbers.filter((record: any) => {
        const acc = record.accounts;

        // 1. HARD BLOCK for Active Service
        if (ACTIVE_STATUSES.includes(acc.subscription_status) && acc.account_status !== 'banned') {
          return false;
        }

        // 2. Bans = Immediate Release
        if (acc.account_status === 'banned') return true;

        // 3. Unpaid (Delinquent) with Grace Period
        if (acc.subscription_status === 'unpaid') {
          if (!acc.unpaid_since) return false; // Safety: if no timestamp, assume new delinquency and wait
          const unpaidDate = new Date(acc.unpaid_since);
          const graceLimit = new Date();
          graceLimit.setDate(graceLimit.getDate() - POOL_CONFIG.GRACE_DAYS);

          // Only release if unpaid DATE is OLDER than grace limit
          return unpaidDate < graceLimit;
        }

        if (acc.subscription_status === 'incomplete_expired') return true;

        // 4. Cancelled with Hold Period
        if (acc.subscription_status === 'canceled') {
          if (acc.phone_number_held_until) {
            return new Date(acc.phone_number_held_until) < now;
          }
          return true; // No hold date -> safe to release
        }
        return false;
      });
    }

    if (inactiveError) {
      logError('Error fetching inactive service numbers', { ...baseLogOptions, error: inactiveError });
    } else if (numbersToRelease.length > 0) {
      logInfo('Processing inactive service releases', {
        ...baseLogOptions,
        context: { count: numbersToRelease.length }
      });

      for (const record of numbersToRelease) {
        if (POOL_CONFIG.ENABLED) {
          // New Pool Logic: Detach and Cooldown

          // 1. Detach from Vapi (Delete Phone Object)
          const { data: phoneDetails } = await supabase
            .from('phone_numbers')
            .select('provider_phone_number_id, vapi_phone_id')
            .eq('id', record.id)
            .single();

          const vapiId = phoneDetails?.vapi_phone_id || phoneDetails?.provider_phone_number_id;

          if (vapiId) {
            const vapiResponse = await fetch(
              `${VAPI_BASE_URL}/phone-number/${vapiId}`,
              {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${VAPI_API_KEY}` }
              }
            );

            if (!vapiResponse.ok) {
              const errText = await vapiResponse.text();
              logWarn('VAPI detach failed (service inactive)', {
                ...baseLogOptions,
                accountId: record.account_id,
                context: { error: errText, vapiId }
              });
              // Proceed to cooldown anyway? Yes, remove from our active assignments.
              // Ideally we mark it as "quarantine" if we can't detach?
              // Let's rely on manual cleanup if detach fails, or retry.
            } else {
              logInfo('VAPI phone detached for pool (service inactive)', { ...baseLogOptions, context: { vapiId } });
            }
          }

          // 2. Transition to Cooldown
          const { error: rpcError } = await supabase.rpc('transition_phone_to_cooldown', {
            p_phone_id: record.id,
            p_account_id: record.account_id,
            p_reason: 'service_inactive', // standardized reason
            p_cooldown_interval: `${POOL_CONFIG.MIN_COOLDOWN_DAYS} days`
          });

          if (rpcError) {
            logError('Failed to transition to cooldown', { ...baseLogOptions, error: rpcError });
          } else {
            logInfo('Phone transitioned to cooldown', { ...baseLogOptions, accountId: record.account_id });
          }

        } else {
          // Legacy Logic: Disable only (hide from UI)
          // Actually, legacy logic for canceled accounts might be to release them eventually?
          // The previous code only disabled on trial expiry. 
          // But strict "service inactive" handling is good for legacy too.
          await supabase
            .from('phone_numbers')
            .update({ status: 'disabled' })
            .eq('id', record.id);

          logInfo('Disabled phone number due to inactive service', {
            ...baseLogOptions,
            accountId: record.account_id,
            context: { phoneId: record.id }
          });
        }
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
            // Continue to update DB status anyway?
          } else {
            logInfo('VAPI phone number released (retention)', {
              ...baseLogOptions,
              context: { vapiPhoneId: record.vapi_phone_id }
            });
          }
        }

        if (POOL_CONFIG.ENABLED) {
          // If pool enabled, we use the safe transition to cooldown/pool
          // (Even if it was retention expired, we can still pool it)
          await supabase.rpc('transition_phone_to_cooldown', {
            p_phone_id: record.id,
            p_account_id: record.account_id,
            p_reason: 'retention_expired',
            p_cooldown_interval: `${POOL_CONFIG.MIN_COOLDOWN_DAYS} days`
          });
        } else {
          // Legacy: Update DB to 'released'
          await supabase
            .from('phone_numbers')
            .update({
              status: 'released',
              phone_provisioned: false,
            })
            .eq('id', record.id);
        }
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



    // 4. HANDLE COOLDOWN -> POOL TRANSITION (New)
    if (POOL_CONFIG.ENABLED) {
      const { data: cooldowns, error: cooldownError } = await supabase
        .from('phone_numbers')
        .select('id, last_call_at, account_id')
        .eq('lifecycle_status', 'cooldown')
        .lte('cooldown_until', nowIso);

      if (cooldowns && cooldowns.length > 0) {
        logInfo('Processing cooldown transitions', { ...baseLogOptions, context: { count: cooldowns.length } });

        for (const record of cooldowns) {
          const lastCall = record.last_call_at ? new Date(record.last_call_at) : null;
          const silenceLimitMs = POOL_CONFIG.MIN_SILENCE_DAYS * 24 * 60 * 60 * 1000;
          const silenceCutoff = new Date(Date.now() - silenceLimitMs);

          if (lastCall && lastCall > silenceCutoff) {
            // Had a call recently? Extend cooldown.
            const newCooldown = new Date(Date.now() + (2 * 24 * 60 * 60 * 1000)); // +2 days

            await supabase.from('phone_numbers').update({
              cooldown_until: newCooldown.toISOString()
            }).eq('id', record.id);

            logInfo('Extended cooldown due to recent activity', {
              ...baseLogOptions,
              context: { phoneId: record.id, lastCall: record.last_call_at }
            });
          } else {
            // Safe to Pool
            await supabase.from('phone_numbers').update({
              lifecycle_status: 'pool',
              cooldown_until: null,
              assigned_account_id: null,
              last_lifecycle_change_at: new Date().toISOString()
            }).eq('id', record.id);

            logInfo('Moved phone number to POOL', {
              ...baseLogOptions,
              context: { phoneId: record.id }
            });
          }
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
