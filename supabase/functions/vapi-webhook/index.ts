import { createClient } from "supabase";
import { corsHeaders } from "../_shared/cors.ts";
import { extractCallDetails, VapiCall, VapiMessage } from "./call_parser.ts";
import { withSentryEdge } from "../_shared/sentry.ts";
import { classifyCall, writeBillingLedgerEntry } from "../_shared/call-classifier.ts";

/**
 * Vapi Webhook Handler
 *
 * Processes Vapi server events (call-started, end-of-call-report, status-update)
 * and upserts call data into call_logs table.
 */

/**
 * PostHog server-side capture — best-effort, never throws.
 * Uses accountId (or callId as fallback) as PostHog distinct_id for join key consistency.
 */
async function capturePostHog(
    event: string,
    distinctId: string,
    props: Record<string, unknown>
): Promise<void> {
    const key = Deno.env.get('POSTHOG_API_KEY');
    if (!key) return; // no-op if not configured
    try {
        await fetch('https://us.i.posthog.com/capture/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: key,
                event,
                distinct_id: distinctId,
                properties: {
                    ...props,
                    $lib: 'edge-function',
                    $lib_version: '1.0.0',
                    environment: 'production',
                },
                timestamp: new Date().toISOString(),
            }),
        });
    } catch {
        // Best-effort — do not let PostHog failures affect webhook processing
    }
}

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
                    provider_phone_number_id: providerPhoneNumberId, // This is the raw ID from payload
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

            // ENHANCED LOGGING: Track extraction
            console.log(JSON.stringify({
                event: "webhook_phone_extraction",
                providerCallId,
                vapiPhoneId,
                calleeE164,
                callPhoneNumber: call.phoneNumber,
                callPhoneNumberId: call.phoneNumberId,
                callTransport: call.transport
            }));

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
                    .select('id, account_id, assigned_account_id, lifecycle_status, vapi_phone_id, e164_number, accounts!phone_numbers_account_id_fkey(subscription_status, account_status)')
                    .eq('vapi_phone_id', vapiPhoneId)
                    .maybeSingle();

                // ENHANCED LOGGING: Track lookup result
                console.log(JSON.stringify({
                    event: "webhook_phone_lookup_vapi_phone_id",
                    providerCallId,
                    vapiPhoneId,
                    found: !!data,
                    hasError: !!error,
                    errorCode: error?.code,
                    errorMessage: error?.message,
                    dataId: data?.id
                }));

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
                    .select('id, account_id, assigned_account_id, lifecycle_status, vapi_phone_id, e164_number, accounts!phone_numbers_account_id_fkey(subscription_status, account_status)')
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
                    .select('id, account_id, assigned_account_id, lifecycle_status, vapi_phone_id, e164_number, accounts!phone_numbers_account_id_fkey(subscription_status, account_status)')
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
                    .select('id, account_id, assigned_account_id, lifecycle_status, vapi_phone_id, e164_number, accounts!phone_numbers_account_id_fkey(subscription_status, account_status)')
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
                    .select('id, account_id, assigned_account_id, lifecycle_status, vapi_phone_id, e164_number, accounts!phone_numbers_account_id_fkey(subscription_status, account_status)')
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

            // Track activation call if account is in onboarding
            await trackActivationCallIfApplicable(supabase, mappingResult.accountId!, mappingResult.phoneNumberId);

            // Extraction & Build Record
            const callRecord = buildCallRecord(call, message, mappingResult, body);

            // Upsert (Robust handling for Schema Evolution)
            let upsertError: any = null;
            let savedRecord: any = null;

            try {
                const { data, error } = await supabase
                    .from('call_logs')
                    .upsert(callRecord, { onConflict: 'vapi_call_id' })
                    .select('id')
                    .single();
                upsertError = error;
                savedRecord = data;
            } catch (e) {
                upsertError = e;
            }

            // Retry without address if column missing
            if (upsertError && upsertError.message && upsertError.message.includes('address')) {
                console.warn("Schema mismatch: 'address' column missing in call_logs. Retrying without it.");
                const { address, ...safeRecord } = callRecord;
                const { data, error: retryError } = await supabase
                    .from('call_logs')
                    .upsert(safeRecord, { onConflict: 'vapi_call_id' })
                    .select('id')
                    .single();
                upsertError = retryError;
                savedRecord = data;
            }

            // Update callRecord with ID for subsequent use (e.g. appointment creation)
            if (!upsertError && savedRecord) {
                (callRecord as any).id = savedRecord.id;
            }

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

            // Create appointment if call was booked (only on end-of-call-report)
            if (type === 'end-of-call-report' && callRecord.booked && mappingResult.accountId) {
                await createAppointmentFromCall(supabase, callRecord, mappingResult.accountId, providerPhoneNumberId);
            }

            // PostHog: voice observability events (server-side, best-effort)
            // Uses accountId as distinct_id for warehouse join key consistency
            const phDistinctId = mappingResult.accountId || providerCallId || 'unknown';

            if (type === 'call-started') {
                await capturePostHog('call_received', phDistinctId, {
                    call_id: providerCallId,
                    phone_number: calleeE164,
                    account_id: mappingResult.accountId,
                });
                await capturePostHog('call_connected', phDistinctId, {
                    call_id: providerCallId,
                    account_id: mappingResult.accountId,
                });
            }

            if (type === 'end-of-call-report') {
                const durationSeconds = (callRecord as any).duration_seconds ?? 0;
                const cogsBucket = durationSeconds < 60 ? 'short' : durationSeconds < 180 ? 'medium' : 'long';

                await capturePostHog('call_ended', phDistinctId, {
                    call_id: providerCallId,
                    duration_seconds: durationSeconds,
                    outcome: (callRecord as any).outcome ?? null,
                    cogs_bucket: cogsBucket,
                    account_id: mappingResult.accountId,
                });

                // lead_qualified: when call is booked (Vapi qualified the lead)
                if (callRecord.booked) {
                    await capturePostHog('lead_qualified', phDistinctId, {
                        call_id: providerCallId,
                        qualification_reason: 'booked',
                        account_id: mappingResult.accountId,
                    });
                }

                // onboarding_test_call_completed: first valid inbound call during onboarding
                if (mappingResult.accountId && (callRecord as any).direction === 'inbound' && durationSeconds >= 10) {
                    await maybeFireOnboardingTestCallEvent(
                        supabase,
                        mappingResult.accountId,
                        mappingResult.phoneNumberId,
                        providerCallId,
                        phDistinctId,
                        callRecord as Record<string, unknown>
                    );
                }

                // ── CALL BILLING LEDGER ────────────────────────────────────────────
                // Write to billing ledger for call-based accounts (idempotent).
                if (mappingResult.accountId && providerCallId) {
                    await writeBillingLedgerForCall(
                        supabase,
                        mappingResult.accountId,
                        providerCallId,
                        (callRecord as any).id ?? null,
                        call,
                        callRecord,
                        durationSeconds,
                        phDistinctId,
                    );
                }
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
                    payload: { ...body as object, error: "failed to parse body" },
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
        address: details.address, // Add address (requires DB migration)
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
        record.reason_source = details.reasonSource;
        record.tag_source = details.tagSource;
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

/**
 * Create an appointment record from a booked call
 * 
 * This function creates appointments using call_log_id as the primary idempotency key.
 * If that fails (e.g., column missing or constraint not present), it falls back to
 * a simple insert which may create duplicates but at least captures the data.
 */
async function createAppointmentFromCall(
    supabase: ReturnType<typeof createClient>,
    callRecord: Record<string, unknown>,
    accountId: string,
    vapiPhoneId: string | null
): Promise<void> {
    try {
        const scheduledStartAt = callRecord.appointment_start as string | null;
        const appointmentWindow = callRecord.appointment_window as string | null;
        const callLogId = callRecord.id as string | null;
        const vapiCallId = callRecord.vapi_call_id as string;

        // Determine best start time
        let startTime: string;
        if (scheduledStartAt) {
            startTime = scheduledStartAt;
        } else {
            // Default to tomorrow 9am if no specific time parsed
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(9, 0, 0, 0);
            startTime = tomorrow.toISOString();
        }

        // Build appointment data with all possible columns
        const appointmentData: Record<string, unknown> = {
            account_id: accountId,
            caller_name: callRecord.caller_name as string | null,
            caller_phone: callRecord.from_number as string | null,
            scheduled_start_at: startTime,
            status: 'scheduled',
            notes: callRecord.summary as string | null,
            source: 'vapi_call'
        };

        // Add optional columns if we have the data
        if (callLogId) appointmentData.call_log_id = callLogId;
        if (appointmentWindow) appointmentData.window_description = appointmentWindow;
        if (callRecord.address) appointmentData.address = callRecord.address;
        if (vapiCallId) appointmentData.vapi_call_id = vapiCallId;

        // Try upsert with call_log_id if available
        let aptError: any = null;
        let success = false;

        // Strategy 1: Upsert with call_log_id (preferred - ensures idempotency)
        if (callLogId) {
            try {
                const { error } = await supabase
                    .from('appointments')
                    .upsert(appointmentData, { onConflict: 'call_log_id' });
                if (!error) {
                    success = true;
                    console.log('Appointment upserted via call_log_id:', vapiCallId);
                } else {
                    aptError = error;
                }
            } catch (e) {
                aptError = e;
            }
        }

        // Strategy 2: If call_log_id upsert failed, try removing problematic columns
        if (!success && aptError?.message?.includes('call_log_id')) {
            console.warn("call_log_id conflict failed, trying simple insert");
            const { call_log_id, ...insertData } = appointmentData;
            try {
                const { error } = await supabase.from('appointments').insert(insertData);
                if (!error) {
                    success = true;
                    console.log('Appointment inserted (no call_log_id link):', vapiCallId);
                } else {
                    aptError = error;
                }
            } catch (e) {
                aptError = e;
            }
        }

        // Strategy 3: Schema fallback - remove columns that might not exist
        if (!success && aptError?.message) {
            const problematicColumns = ['address', 'window_description', 'source', 'vapi_call_id', 'call_log_id'];
            let safeData = { ...appointmentData };

            for (const col of problematicColumns) {
                if (aptError.message.includes(col)) {
                    console.warn(`Schema mismatch: '${col}' column issue. Removing and retrying.`);
                    delete safeData[col];
                }
            }

            try {
                const { error } = await supabase.from('appointments').insert(safeData);
                if (!error) {
                    success = true;
                    console.log('Appointment inserted (safe fallback):', vapiCallId);
                } else {
                    aptError = error;
                }
            } catch (e) {
                aptError = e;
            }
        }

        // Log result
        if (success) {
            await writeToInbox(supabase, {
                provider_call_id: vapiCallId,
                provider_phone_number_id: vapiPhoneId || "unknown",
                reason: "appointment_created",
                payload: { appointmentData, callLogId },
                error: null
            });
        } else {
            console.error('Failed to create appointment after all strategies:', aptError);
            await writeToInbox(supabase, {
                provider_call_id: vapiCallId,
                provider_phone_number_id: vapiPhoneId || "unknown",
                reason: "appointment_creation_failed",
                payload: { error: aptError, appointmentData },
                error: aptError?.message || String(aptError)
            });
        }
    } catch (e) {
        console.error('Exception creating appointment:', e);
        await writeToInbox(supabase, {
            provider_call_id: callRecord.vapi_call_id as string,
            provider_phone_number_id: vapiPhoneId || "unknown",
            reason: "appointment_creation_exception",
            payload: { error: String(e) },
            error: String(e)
        });
    }
}

/**
 * Track activation call event if account is in onboarding window
 * This is diagnostic only - does not mark activation complete
 */
async function trackActivationCallIfApplicable(
    supabase: ReturnType<typeof createClient>,
    accountId: string,
    phoneNumberId: string | null
): Promise<void> {
    try {
        // Check if there's a recent onboarding event (within last 30 minutes)
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

        const { data: recentEvents } = await supabase
            .from('system_events')
            .select('id')
            .eq('account_id', accountId)
            .in('event_name', ['onboarding.test_call_initiated', 'onboarding.verification_started'])
            .gte('created_at', thirtyMinutesAgo)
            .limit(1);

        if (recentEvents && recentEvents.length > 0) {
            // Account is in activation window - log the call received event
            await supabase.from('system_events').insert({
                event_name: 'onboarding.activation_call_received',
                level: 'info',
                account_id: accountId,
                metadata: { phone_number_id: phoneNumberId },
                trace_id: crypto.randomUUID()
            });

            console.log(JSON.stringify({
                event: 'activation_call_tracked',
                accountId,
                phoneNumberId
            }));
        }
    } catch (e) {
        // Fail silently - this is diagnostic only
        console.warn('Failed to track activation call:', e);
    }
}

/**
 * Write to call_billing_ledger after a completed call.
 * Only runs for accounts with billing_call_based=true.
 * Idempotent: safe to call multiple times for the same call.
 * Best-effort: errors are logged but do not fail the webhook.
 */
async function writeBillingLedgerForCall(
    supabase: ReturnType<typeof createClient>,
    accountId: string,
    providerCallId: string,
    callLogId: string | null,
    call: VapiCall,
    callRecord: Record<string, unknown>,
    durationSeconds: number,
    phDistinctId: string,
): Promise<void> {
    try {
        // Fetch account state for billing context
        const { data: account } = await supabase
            .from('accounts')
            .select(
                'billing_call_based, trial_active, subscription_status, ' +
                'plan_key, plan_type, calls_used_current_period, ' +
                'trial_live_calls_used, verification_calls_used, ' +
                'overflow_behavior, current_period_start, current_period_end'
            )
            .eq('id', accountId)
            .single();

        if (!account) return;

        // Only run call-based billing logic for call-based accounts.
        // Explicit false = legacy/grandfathered account; env flag does not override.
        const useCallBased = account.billing_call_based === true ||
            (account.billing_call_based !== false && Deno.env.get('BILLING_CALL_BASED_V1') === 'true');
        if (!useCallBased) return;

        const planKey = account.plan_key || account.plan_type || 'night_weekend';
        // Stripe stores the trial period status as 'trialing' (not 'trial').
        // The subscription_status column is written verbatim from Stripe's subscription.status.
        const isTrial = account.trial_active === true ||
            account.subscription_status === 'trial' ||
            account.subscription_status === 'trialing';

        // Fetch plan snapshot
        const { data: plan } = await supabase
            .from('plans')
            .select('plan_version, billing_unit, included_calls, overage_rate_calls_cents, max_overage_calls')
            .eq('plan_key', planKey)
            .single();

        // Check if caller is on verification allowlist
        const callerNumber: string | null = call.customer?.number ?? null;
        const isVerificationNumber = await checkVerificationAllowlistForLedger(supabase, accountId, callerNumber);

        const classification = classifyCall(
            {
                accountId,
                providerCallId,
                callerNumber,
                durationSeconds,
                endedReason: (call as any).endedReason ?? null,
                callLogId,
            },
            isVerificationNumber,
            isTrial,
        );

        const planSnapshot = {
            planKey,
            planVersion: plan?.plan_version ?? 2,
            billingUnit: plan?.billing_unit ?? 'call',
            includedCalls: plan?.included_calls ?? 60,
            overageRateCents: plan?.overage_rate_calls_cents ?? 95,
            maxOverageCalls: plan?.max_overage_calls ?? 50,
            overflowMode: account.overflow_behavior || 'always_answer',
        };

        const callsUsedBefore = account.calls_used_current_period || 0;

        const { inserted, alreadyCounted, existedBefore, error: ledgerError } = await writeBillingLedgerEntry(
            supabase,
            {
                accountId,
                providerCallId,
                callLogId,
                callStartedAt: callRecord.started_at as string ?? new Date().toISOString(),
                callEndedAt: callRecord.ended_at as string ?? null,
                durationSeconds,
                classification,
                planSnapshot,
                billingPeriodStart: account.current_period_start ?? null,
                billingPeriodEnd: account.current_period_end ?? null,
                callsUsedBefore,
                // Skip calls_used_current_period increment during trial;
                // trial uses trial_live_calls_used for enforcement.
                isTrial,
            }
        );

        if (ledgerError) {
            console.error(JSON.stringify({
                event: 'billing_ledger_write_failed',
                accountId, providerCallId, error: ledgerError,
            }));
            await capturePostHog('usage_tracking_error', phDistinctId, {
                account_id: accountId, error: ledgerError, call_id: providerCallId,
            });
            return;
        }

        if (alreadyCounted) {
            console.log(JSON.stringify({
                event: 'billing_ledger_duplicate_skipped',
                accountId, providerCallId,
            }));
            return;
        }

        // Update trial-specific counters — only when ledger row is newly inserted.
        // existedBefore guards against duplicate webhook replays for non-billable
        // calls (e.g. verification) where counted_in_usage=false would otherwise
        // pass the alreadyCounted check above and re-increment on every replay.
        if (isTrial && !existedBefore) {
            if (classification.callKind === 'verification') {
                await supabase.rpc('increment_verification_calls', { p_account_id: accountId });
            } else if (classification.callKind === 'live' && classification.billable) {
                await supabase.rpc('increment_trial_live_calls', { p_account_id: accountId });
            }
        }

        // PostHog event
        const phEvent = classification.callKind === 'verification'
            ? 'trial_verification_call_recorded'
            : classification.billable
                ? (isTrial ? 'trial_live_call_recorded' : 'billable_call_recorded')
                : 'call_excluded_from_billing';

        await capturePostHog(phEvent, phDistinctId, {
            account_id: accountId,
            call_id: providerCallId,
            plan_key: planKey,
            billing_unit: 'call',
            call_kind: classification.callKind,
            billable: classification.billable,
            excluded_reason: classification.excludedReason ?? null,
            duration_seconds: durationSeconds,
            estimated_cogs_cents: classification.estimatedCogsCents ?? null,
            calls_used_after: callsUsedBefore + (classification.billable ? 1 : 0),
        });

        console.log(JSON.stringify({
            event: 'billing_ledger_written',
            accountId, providerCallId,
            callKind: classification.callKind,
            billable: classification.billable,
            durationSeconds,
        }));

    } catch (e) {
        // Never fail the webhook for billing errors
        console.error('writeBillingLedgerForCall exception:', e);
        try {
            await capturePostHog('usage_tracking_error', phDistinctId, {
                account_id: accountId, error: String(e), call_id: providerCallId,
            });
        } catch { /* best-effort */ }
    }
}

/**
 * Fire onboarding_test_call_completed PostHog event server-side when a qualifying
 * inbound call is the first valid test call for an account still in onboarding.
 *
 * Deduplication: checks accounts.test_call_verified_at IS NULL so only fires once,
 * even if the frontend RPC also sets that field later via get_onboarding_state.
 * Best-effort — never throws.
 */
async function maybeFireOnboardingTestCallEvent(
    supabase: ReturnType<typeof createClient>,
    accountId: string,
    phoneNumberId: string | null,
    callId: string | null,
    distinctId: string,
    callRecord: Record<string, unknown>
): Promise<void> {
    try {
        // Verify this is the primary active onboarding number — mirrors get_onboarding_state RPC
        // which only treats calls to is_primary=true + status='active' numbers as test calls.
        // Without this guard, calls to secondary/legacy numbers would fire the event while
        // the RPC still reports onboarding incomplete.
        if (!phoneNumberId) return; // No phone number resolved — cannot be a test call
        const { data: phone } = await supabase
            .from('phone_numbers')
            .select('activated_at')
            .eq('id', phoneNumberId)
            .eq('is_primary', true)
            .eq('status', 'active')
            .single();
        if (!phone) return; // Not the primary active number — skip
        const activatedAt: string | null = phone.activated_at ?? null;

        // Verify call is within the onboarding window — mirrors get_onboarding_state RPC logic:
        //   started_at >= COALESCE(activated_at, NOW() - INTERVAL '2 hours')
        const callStartedAt = callRecord.started_at as string | null;
        if (callStartedAt) {
            const callTime = new Date(callStartedAt).getTime();
            const windowStart = activatedAt
                ? new Date(activatedAt).getTime()
                : Date.now() - 2 * 60 * 60 * 1000;
            if (callTime < windowStart) return; // Outside onboarding window
        }

        // Atomically claim the first-fire: only the UPDATE winner fires PostHog.
        // Mirrors the get_onboarding_state RPC pattern (UPDATE WHERE IS NULL, check row count).
        // Prevents duplicate events when multiple qualifying calls arrive before the frontend polls.
        const { data: claimed } = await supabase
            .from('accounts')
            .update({ test_call_verified_at: new Date().toISOString() })
            .eq('id', accountId)
            .is('test_call_verified_at', null)
            .select('id');
        if (!claimed || claimed.length === 0) return; // Already set — another webhook or the RPC won

        await capturePostHog('onboarding_test_call_completed', distinctId, {
            account_id: accountId,
            phone_number_id: phoneNumberId,
            call_id: callId,
            duration_seconds: callRecord.duration_seconds,
            from_number: callRecord.from_number,
            ring_snap_number: callRecord.to_number,
            activated_at: activatedAt,
            source: 'server',
        });

        console.log(JSON.stringify({
            event: 'onboarding_test_call_completed_fired',
            account_id: accountId,
            call_id: callId,
        }));
    } catch {
        // Best-effort — do not let this affect webhook processing
    }
}

/**
 * Check verification allowlist (used in billing ledger writes, separate from authorize-call check).
 */
async function checkVerificationAllowlistForLedger(
    supabase: ReturnType<typeof createClient>,
    accountId: string,
    callerNumber: string | null,
): Promise<boolean> {
    if (!callerNumber) return false;
    try {
        const { data } = await supabase
            .from('verification_call_allowlist')
            .select('id')
            .eq('account_id', accountId)
            .eq('phone_number', callerNumber)
            .eq('is_active', true)
            .maybeSingle();
        return !!data;
    } catch {
        return false;
    }
}
