import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Vapi Call Reconciliation Job
 * 
 * Fetches recent calls from Vapi API and upserts any missing ones into call_logs.
 * This ensures calls appear even if the webhook failed.
 * 
 * Feature Flag: CALL_RECONCILE_ENABLED must be "true" to run
 * Schedule: Run via cron every 15 minutes
 */

const FUNCTION_NAME = "vapi-reconcile-calls";
const VAPI_BASE_URL = "https://api.vapi.ai";
const MAX_CALLS_PER_RUN = 100;
const LOOKBACK_HOURS = 2;

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const startTime = Date.now();

    try {
        // ========================================
        // 1. Check feature flag
        // ========================================
        const enabled = Deno.env.get('CALL_RECONCILE_ENABLED');
        if (enabled !== 'true') {
            console.log(JSON.stringify({
                event: "reconcile_skipped",
                reason: "feature_flag_disabled",
            }));
            return new Response(JSON.stringify({
                status: "skipped",
                reason: "CALL_RECONCILE_ENABLED is not true"
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        // ========================================
        // 2. Validate Vapi credentials
        // ========================================
        const vapiApiKey = Deno.env.get('VAPI_API_KEY');
        if (!vapiApiKey) {
            throw new Error("VAPI_API_KEY not configured");
        }

        // ========================================
        // 3. Initialize Supabase
        // ========================================
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // ========================================
        // 4. Get our phone numbers (only process calls for numbers we own)
        // ========================================
        const { data: ourNumbers, error: numbersError } = await supabase
            .from('phone_numbers')
            .select('provider_phone_number_id, vapi_phone_id, account_id, id')
            .not('account_id', 'is', null);

        if (numbersError) {
            throw new Error(`Failed to fetch phone numbers: ${numbersError.message}`);
        }

        if (!ourNumbers || ourNumbers.length === 0) {
            console.log(JSON.stringify({
                event: "reconcile_skipped",
                reason: "no_phone_numbers",
            }));
            return new Response(JSON.stringify({
                status: "skipped",
                reason: "No phone numbers in database"
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        // Build lookup map by vapi phone id
        const phoneMap = new Map<string, { accountId: string; phoneNumberId: string }>();
        for (const num of ourNumbers) {
            const vapiId = num.provider_phone_number_id || num.vapi_phone_id;
            if (vapiId) {
                phoneMap.set(vapiId, {
                    accountId: num.account_id,
                    phoneNumberId: num.id,
                });
            }
        }

        // ========================================
        // 5. Fetch recent calls from Vapi
        // ========================================
        const lookbackTime = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000);

        console.log(JSON.stringify({
            event: "reconcile_fetching",
            lookbackHours: LOOKBACK_HOURS,
            phoneCount: phoneMap.size,
        }));

        const vapiResponse = await fetch(`${VAPI_BASE_URL}/call?limit=${MAX_CALLS_PER_RUN}`, {
            headers: {
                "Authorization": `Bearer ${vapiApiKey}`,
                "Content-Type": "application/json",
            },
        });

        if (!vapiResponse.ok) {
            const errorText = await vapiResponse.text();
            throw new Error(`Vapi API error: ${vapiResponse.status} ${errorText}`);
        }

        const calls = await vapiResponse.json();

        if (!Array.isArray(calls)) {
            console.log(JSON.stringify({
                event: "reconcile_unexpected_response",
                response: typeof calls,
            }));
            return new Response(JSON.stringify({
                status: "error",
                reason: "Unexpected Vapi response format"
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500,
            });
        }

        // ========================================
        // 6. Process calls
        // ========================================
        let processed = 0;
        let skipped = 0;
        let upserted = 0;
        let errors = 0;

        for (const call of calls) {
            processed++;

            // Rate limit guard
            if (processed > MAX_CALLS_PER_RUN) {
                console.log("Rate limit reached, stopping");
                break;
            }

            // Check if call is within lookback window
            const callTime = call.startedAt ? new Date(call.startedAt) : null;
            if (callTime && callTime < lookbackTime) {
                skipped++;
                continue;
            }

            // Check if this call is for one of our numbers
            const vapiPhoneId = call.phoneNumber?.id || call.phoneNumberId;
            const mapping = vapiPhoneId ? phoneMap.get(vapiPhoneId) : null;

            if (!mapping) {
                skipped++;
                continue;
            }

            // Build call record
            const callRecord = {
                account_id: mapping.accountId,
                vapi_call_id: call.id,
                provider: 'vapi',
                provider_call_id: call.id,
                phone_number_id: mapping.phoneNumberId,
                direction: call.type === 'inboundPhoneCall' ? 'inbound' : 'outbound',
                from_number: call.customer?.number ?? null,
                to_number: call.phoneNumber?.number ?? null,
                started_at: call.startedAt ?? null,
                ended_at: call.endedAt ?? null,
                duration_seconds: call.durationSeconds ? Math.round(call.durationSeconds) : null,
                status: call.status === 'ended' ? 'completed' : call.status,
                transcript: call.transcript ?? null,
                summary: call.analysis?.summary ?? null,
                recording_url: call.recordingUrl ?? null,
                cost: call.cost ?? null,
                updated_at: new Date().toISOString(),
            };

            // Upsert
            const { error: upsertError } = await supabase
                .from('call_logs')
                .upsert(callRecord, { onConflict: 'vapi_call_id' });

            if (upsertError) {
                errors++;
                console.error(JSON.stringify({
                    event: "reconcile_upsert_error",
                    callId: call.id,
                    error: upsertError.message,
                }));

                // Write to inbox
                await supabase.from('call_webhook_inbox').insert({
                    provider: 'vapi',
                    provider_call_id: call.id,
                    provider_phone_number_id: vapiPhoneId,
                    reason: 'reconcile_upsert_failed',
                    payload: call,
                    error: upsertError.message,
                });
            } else {
                upserted++;
            }
        }

        const duration = Date.now() - startTime;

        console.log(JSON.stringify({
            event: "reconcile_complete",
            processed,
            upserted,
            skipped,
            errors,
            durationMs: duration,
        }));

        return new Response(JSON.stringify({
            status: "completed",
            processed,
            upserted,
            skipped,
            errors,
            durationMs: duration,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(JSON.stringify({
            event: "reconcile_error",
            error: errorMessage,
        }));

        return new Response(JSON.stringify({
            status: "error",
            error: errorMessage,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
