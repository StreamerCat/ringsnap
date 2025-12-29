import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from "../_shared/cors.ts";
import { extractCallDetails, VapiCall, VapiMessage } from "./call_parser.ts";
import { withSentryEdge } from "../_shared/sentry.ts";

/**
 * Vapi Webhook Handler
 * 
 * Processes Vapi server events (call-started, end-of-call-report, status-update)
 * and upserts call data into call_logs table.
 */

interface MappingResult {
    accountId: string | null;
    phoneNumberId: string | null;
    method: string;
}

Deno.serve(withSentryEdge(
    { functionName: "vapi-webhook" },
    async (req, ctx) => {
        // Handle CORS
        if (req.method === 'OPTIONS') {
            return new Response('ok', { headers: corsHeaders });
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        let body: unknown;
        let providerCallId: string | null = null;
        let providerPhoneNumberId: string | null = null;

        try {
            body = await req.json();

            // Normalize message vs body structure
            const message: VapiMessage = (body as any).message ?? body;
            const type = message.type;

            if (!type) {
                return new Response("OK", { status: 200, headers: corsHeaders });
            }

            const call: VapiCall = message.call ?? (message as unknown as VapiCall);
            providerCallId = call.id ?? null;
            providerPhoneNumberId = call.phoneNumber?.id ?? call.phoneNumberId ?? null;

            console.log(JSON.stringify({
                event: "vapi_webhook_received",
                type,
                providerCallId,
                providerPhoneNumberId,
                hasCall: !!call.id,
            }));

            // Validation
            if (!providerCallId) {
                await writeToInbox(supabase, {
                    provider_call_id: null,
                    provider_phone_number_id: providerPhoneNumberId,
                    reason: "missing_call_id",
                    payload: body,
                    error: "No call.id found in payload",
                });
                console.log(JSON.stringify({ event: "vapi_webhook_skipped", reason: "missing_call_id" }));
                return new Response("OK", { status: 200, headers: corsHeaders });
            }

            // Security Check
            const authMode = Deno.env.get('VAPI_WEBHOOK_AUTH_MODE') || 'secret';
            const expectedSecret = Deno.env.get('VAPI_WEBHOOK_SECRET');
            const incomingSecret = req.headers.get('x-vapi-secret');

            if (authMode === 'secret' && expectedSecret) {
                if (!incomingSecret || incomingSecret !== expectedSecret) {
                    const errorMsg = incomingSecret ? "Secret mismatch" : "Missing secret header";
                    await writeToInbox(supabase, {
                        provider_call_id: providerCallId,
                        provider_phone_number_id: providerPhoneNumberId,
                        reason: "unauthorized",
                        payload: body,
                        error: errorMsg,
                    });
                    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
                }
            }

            // --- IDENTIFICATION & METADATA UPDATE ---
            const vapiPhoneId = call.phoneNumber?.id ?? call.phoneNumberId ?? null;
            const calleeE164 = call.phoneNumber?.number ?? call.transport?.to ?? null;

            let matchedPhone: { id: any; account_id: any; assigned_account_id: any; lifecycle_status: any; vapi_phone_id: any; e164_number: any; accounts: { subscription_status: string; account_status: string } | null } | null = null;
            let matchField: string | null = null;

            // 1. Resolve Phone Record (Identifier-Safe Order)
            // During Phase 0 normalization, we need to check all legacy columns

            // Helper to detect duplicate mapping errors
            const isDuplicateError = (error: any) =>
                error?.message?.toLowerCase().includes('multiple') ||
                error?.code === 'PGRST116';

            // Primary: vapi_phone_id (CANONICAL)
            if (vapiPhoneId) {
                const { data, error } = await supabase
                    .from('phone_numbers')
                    .select('id, account_id, assigned_account_id, lifecycle_status, vapi_phone_id, e164_number, accounts(subscription_status, account_status)')
                    .eq('vapi_phone_id', vapiPhoneId)
                    .maybeSingle();

                if (error) {
                    console.error("Lookup VapiPhoneId Error:", error);
                    if (isDuplicateError(error)) {
                        await writeToInbox(supabase, {
                            provider_call_id: providerCallId,
                            provider_phone_number_id: vapiPhoneId,
                            reason: "duplicate_phone_mapping",
                            payload: { field: 'vapi_phone_id', vapiPhoneId, calleeE164 },
                            error: `Multiple rows found for vapi_phone_id: ${vapiPhoneId}`,
                        });
                        return new Response(JSON.stringify({ error: "duplicate_phone_mapping", integrity_error: true, field: 'vapi_phone_id', value: vapiPhoneId }), { status: 200, headers: corsHeaders });
                    }
                }
                if (data) {
                    matchedPhone = data;
                    matchField = 'vapi_phone_id';
                }
            }

            // Fallback 1: vapi_id (LEGACY - will be removed after normalization)
            if (!matchedPhone && vapiPhoneId) {
                const { data, error } = await supabase
                    .from('phone_numbers')
                    .select('id, account_id, assigned_account_id, lifecycle_status, vapi_phone_id, e164_number, accounts(subscription_status, account_status)')
                    .eq('vapi_id', vapiPhoneId)
                    .maybeSingle();

                if (error) {
                    console.error("Lookup VapiId (legacy) Error:", error);
                    if (isDuplicateError(error)) {
                        await writeToInbox(supabase, {
                            provider_call_id: providerCallId,
                            provider_phone_number_id: vapiPhoneId,
                            reason: "duplicate_phone_mapping",
                            payload: { field: 'vapi_id', vapiPhoneId, calleeE164 },
                            error: `Multiple rows found for vapi_id: ${vapiPhoneId}`,
                        });
                        return new Response(JSON.stringify({ error: "duplicate_phone_mapping", integrity_error: true, field: 'vapi_id', value: vapiPhoneId }), { status: 200, headers: corsHeaders });
                    }
                }
                if (data) {
                    matchedPhone = data;
                    matchField = 'vapi_id';
                }
            }

            // Fallback 2: provider_phone_number_id (LEGACY - will be removed after normalization)
            if (!matchedPhone && vapiPhoneId) {
                const { data, error } = await supabase
                    .from('phone_numbers')
                    .select('id, account_id, assigned_account_id, lifecycle_status, vapi_phone_id, e164_number, accounts(subscription_status, account_status)')
                    .eq('provider_phone_number_id', vapiPhoneId)
                    .maybeSingle();

                if (error) {
                    console.error("Lookup ProviderPhoneNumberId (legacy) Error:", error);
                    if (isDuplicateError(error)) {
                        await writeToInbox(supabase, {
                            provider_call_id: providerCallId,
                            provider_phone_number_id: vapiPhoneId,
                            reason: "duplicate_phone_mapping",
                            payload: { field: 'provider_phone_number_id', vapiPhoneId, calleeE164 },
                            error: `Multiple rows found for provider_phone_number_id: ${vapiPhoneId}`,
                        });
                        return new Response(JSON.stringify({ error: "duplicate_phone_mapping", integrity_error: true, field: 'provider_phone_number_id', value: vapiPhoneId }), { status: 200, headers: corsHeaders });
                    }
                }
                if (data) {
                    matchedPhone = data;
                    matchField = 'provider_phone_number_id';
                }
            }

            // Fallback 3: E164
            if (!matchedPhone && calleeE164) {
                const { data, error } = await supabase
                    .from('phone_numbers')
                    .select('id, account_id, assigned_account_id, lifecycle_status, vapi_phone_id, e164_number, accounts(subscription_status, account_status)')
                    .eq('e164_number', calleeE164)
                    .maybeSingle();

                if (error) {
                    console.error("Lookup E164 Error:", error);
                    if (isDuplicateError(error)) {
                        await writeToInbox(supabase, {
                            provider_call_id: providerCallId,
                            provider_phone_number_id: vapiPhoneId,
                            reason: "duplicate_phone_mapping",
                            payload: { field: 'e164_number', vapiPhoneId, calleeE164 },
                            error: `Multiple rows found for e164_number: ${calleeE164}`,
                        });
                        return new Response(JSON.stringify({ error: "duplicate_phone_mapping", integrity_error: true, field: 'e164_number', value: calleeE164 }), { status: 200, headers: corsHeaders });
                    }
                }
                if (data) {
                    matchedPhone = data;
                    matchField = 'e164_number';
                }
            }

            // Fallback 4: phone_number (legacy data or null e164 matches)
            if (!matchedPhone && calleeE164) {
                const { data, error } = await supabase
                    .from('phone_numbers')
                    .select('id, account_id, assigned_account_id, lifecycle_status, vapi_phone_id, e164_number, accounts(subscription_status, account_status)')
                    .eq('phone_number', calleeE164)
                    .maybeSingle();

                if (error) {
                    console.error("Lookup PhoneNumber Error:", error);
                    if (isDuplicateError(error)) {
                        await writeToInbox(supabase, {
                            provider_call_id: providerCallId,
                            provider_phone_number_id: vapiPhoneId,
                            reason: "duplicate_phone_mapping",
                            payload: { field: 'phone_number', vapiPhoneId, calleeE164 },
                            error: `Multiple rows found for phone_number: ${calleeE164}`,
                        });
                        return new Response(JSON.stringify({ error: "duplicate_phone_mapping", integrity_error: true, field: 'phone_number', value: calleeE164 }), { status: 200, headers: corsHeaders });
                    }
                }
                if (data) {
                    matchedPhone = data;
                    matchField = 'phone_number';
                }
            }

            // 2. Always Update last_call_at (Critical for Pool Silence)
            if (matchedPhone) {
                await supabase.from('phone_numbers')
                    .update({ last_call_at: new Date().toISOString() })
                    .eq('id', matchedPhone.id);

                console.log(JSON.stringify({
                    event: "debug_mapping_resolution",
                    vapiPhoneId,
                    calleeE164,
                    matchedDbField: matchField,
                    lifecycleStatus: matchedPhone.lifecycle_status,
                    phoneId: matchedPhone.id
                }));
            } else {
                console.log(JSON.stringify({
                    event: "debug_mapping_resolution_failed",
                    vapiPhoneId,
                    calleeE164
                }));
            }

            // 3. Account Mapping (Strict Safety)
            const mappingResult = await resolveMapping(supabase, call, matchedPhone);

            if (!mappingResult.accountId) {
                // Only write to inbox if it's an unexpected failure.
                // Expected Blocked (Pool/Cooldown) -> SKIP INBOX (Spam reduction)
                if (mappingResult.method === 'blocked_lifecycle') {
                    console.log(JSON.stringify({
                        event: "vapi_webhook_blocked_lifecycle",
                        phoneId: matchedPhone?.id,
                        reason: "pool_logic"
                    }));
                    return new Response(JSON.stringify({ message: "Skipped: pool/cooldown blocked" }), { status: 200, headers: corsHeaders });
                }

                await writeToInbox(supabase, {
                    provider_call_id: providerCallId,
                    provider_phone_number_id: vapiPhoneId,
                    reason: "unmapped_account",
                    payload: body,
                    error: `Could not map to account. Method: ${mappingResult.method}, PhoneStatus: ${matchedPhone?.lifecycle_status}`,
                });
                return new Response(JSON.stringify({ message: "Skipped: unmapped" }), { status: 200, headers: corsHeaders });
            }

            // Extraction & Build Record
            const callRecord = buildCallRecord(call, message, mappingResult, body);

            // Upsert
            const { error: upsertError } = await supabase
                .from('call_logs')
                .upsert(callRecord, { onConflict: 'vapi_call_id' });

            if (upsertError) {
                await writeToInbox(supabase, {
                    provider_call_id: providerCallId,
                    provider_phone_number_id: providerPhoneNumberId,
                    reason: "upsert_failed",
                    payload: body,
                    error: upsertError.message,
                });
                console.error("Upsert failed:", upsertError);
                throw upsertError; // Re-throw for Sentry
            }

            console.log(JSON.stringify({
                event: "vapi_webhook_success",
                type,
                providerCallId
            }));

            return new Response(JSON.stringify({ success: true, id: providerCallId }), { status: 200, headers: corsHeaders });

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            try {
                await writeToInbox(supabase, {
                    provider_call_id: providerCallId,
                    provider_phone_number_id: providerPhoneNumberId,
                    reason: "exception",
                    payload: body ?? { error: "failed to parse body" },
                    error: errorMessage,
                });
            } catch { }
            console.error("Webhook exception:", errorMessage);
            throw err; // Re-throw for Sentry
        }
    }));

/**
 * Resolve mapping with strict safety
 */
async function resolveMapping(
    supabase: ReturnType<typeof createClient>,
    call: VapiCall,
    matchedPhone: {
        id: any;
        account_id: any;
        assigned_account_id: any;
        lifecycle_status: any;
        accounts: { subscription_status: string; account_status: string } | any
    } | null
): Promise<MappingResult> {

    if (!matchedPhone) return { accountId: null, phoneNumberId: null, method: "none" };

    // 1. SAFETY FIRST: Block Pool/Cooldown (Overrides Metadata)
    if (['pool', 'cooldown', 'quarantine'].includes(matchedPhone.lifecycle_status)) {
        return { accountId: null, phoneNumberId: matchedPhone.id, method: "blocked_lifecycle" };
    }

    // 2. Strict Assignment (Canonical Truth)
    if (matchedPhone.lifecycle_status === 'assigned') {
        const canonicalId = matchedPhone.assigned_account_id ?? matchedPhone.account_id;
        return { accountId: canonicalId, phoneNumberId: matchedPhone.id, method: "assigned_native" };
    }

    // 3. (REMOVED) Metadata Override
    // We strictly rely on DB state. Metadata in 'assistant' might be stale.
    // Legacy fallback (step 4) handles active legacy accounts.

    // 4. Legacy Fallback (Active Account Only)
    if (!matchedPhone.lifecycle_status && matchedPhone.account_id) {
        const acc = matchedPhone.accounts; // joined data
        // Check if active
        const isActive = acc && (
            ['active', 'trialing', 'past_due'].includes(acc.subscription_status) &&
            acc.account_status !== 'banned'
        );

        if (isActive) {
            return { accountId: matchedPhone.account_id, phoneNumberId: matchedPhone.id, method: "legacy_active_fallback" };
        } else {
            console.log("Blocking legacy call to inactive account");
            // Treat as blocked or unmapped? Blocked prevents spam.
            return { accountId: null, phoneNumberId: matchedPhone.id, method: "blocked_legacy_inactive" };
        }
    }

    return { accountId: null, phoneNumberId: matchedPhone.id, method: "no_valid_assignment" };
}

/**
 * Build call record
 */
function buildCallRecord(
    call: VapiCall,
    message: VapiMessage,
    mapping: MappingResult,
    rawPayload: unknown
): Record<string, unknown> {
    const isEndOfCall = message.type === 'end-of-call-report';
    const isCallStarted = message.type === 'call-started';

    // Normalize Timestamps
    const startedAt = call.startedAt ?? call.createdAt;
    const endedAt = call.endedAt ?? message.endedAt;

    let durationSeconds = 0;
    if (call.durationSeconds) {
        durationSeconds = Math.round(call.durationSeconds);
    } else if (endedAt && startedAt) {
        durationSeconds = Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000);
    }

    // Status
    let status = call.status || (isEndOfCall ? 'completed' : 'in-progress');
    if (status === 'ringing' || status === 'queued') status = 'in_progress';
    if (isCallStarted) status = 'in_progress';
    if (isEndOfCall) status = 'completed';

    // Info
    const direction = call.type === 'inboundPhoneCall' ? 'inbound' : 'outbound';
    const callerPhone = call.customer?.number ?? null;

    // Use Enahnced Parser
    const details = extractCallDetails(call, message);

    // Only capture outcome details on end-of-call to avoid overwrites
    // BUT we still want to calculate them to see what we WOULD save

    const record: Record<string, unknown> = {
        account_id: mapping.accountId,
        vapi_call_id: call.id,
        provider: 'vapi',
        provider_call_id: call.id,
        phone_number_id: mapping.phoneNumberId,
        direction,
        from_number: callerPhone,
        to_number: call.phoneNumber?.number ?? call.transport?.to ?? null,
        started_at: startedAt ? new Date(startedAt).toISOString() : new Date().toISOString(),
        status,
        updated_at: new Date().toISOString(),
        raw_payload: rawPayload,
    };

    if (isEndOfCall) {
        record.ended_at = endedAt ? new Date(endedAt).toISOString() : null;
        record.duration_seconds = durationSeconds;
        record.transcript = call.transcript ?? message.transcript ?? null;
        record.summary = call.analysis?.summary ?? message.summary ?? null;
        record.recording_url = call.recordingUrl ?? message.recordingUrl ?? null;
        record.cost = call.cost ?? message.cost ?? null;

        // Rich Details from Parser
        record.caller_name = details.callerName;
        record.reason = details.reason;
        record.outcome = details.outcome;
        record.booked = details.booked;
        record.lead_captured = details.leadCaptured;

        if (details.appointmentStart) record.appointment_start = details.appointmentStart;
        if (details.appointmentEnd) record.appointment_end = details.appointmentEnd;
        if (details.appointmentWindow) record.appointment_window = details.appointmentWindow;
    }

    return record;
}

/**
 * Write to Inbox
 */
async function writeToInbox(
    supabase: ReturnType<typeof createClient>,
    data: {
        provider_call_id: string | null;
        provider_phone_number_id: string | null;
        reason: string;
        payload: unknown;
        error: string | null;
    }
): Promise<void> {
    try {
        await supabase.from('call_webhook_inbox').insert({
            provider: 'vapi',
            provider_call_id: data.provider_call_id,
            provider_phone_number_id: data.provider_phone_number_id,
            reason: data.reason,
            payload: data.payload,
            error: data.error,
        });
    } catch (e) {
        console.error("Inbox write failed", e);
    }
}
