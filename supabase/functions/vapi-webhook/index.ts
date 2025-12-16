import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from "../_shared/cors.ts";
import { extractCallDetails, VapiCall, VapiMessage } from "./call_parser.ts";

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

Deno.serve(async (req) => {
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

        // Account Mapping
        const mappingResult = await mapToAccount(supabase, call);

        if (!mappingResult.accountId) {
            await writeToInbox(supabase, {
                provider_call_id: providerCallId,
                provider_phone_number_id: providerPhoneNumberId,
                reason: "unmapped_account",
                payload: body,
                error: `Could not map to account. Method tried: ${mappingResult.method}`,
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
            return new Response(JSON.stringify({ error: "upsert_failed" }), { status: 200, headers: corsHeaders });
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
        return new Response(JSON.stringify({ error: errorMessage }), { status: 200, headers: corsHeaders });
    }
});

/**
 * Map call to account
 */
async function mapToAccount(
    supabase: ReturnType<typeof createClient>,
    call: VapiCall
): Promise<MappingResult> {
    const providerPhoneNumberId = call.phoneNumber?.id ?? call.phoneNumberId;
    const calleeE164 = call.phoneNumber?.number ?? call.transport?.to;

    // 1. Assistant Metadata
    if (call.assistant?.metadata?.account_id) {
        return { accountId: call.assistant.metadata.account_id, phoneNumberId: null, method: "metadata" };
    }

    // 2. Provider Phone Number ID
    if (providerPhoneNumberId) {
        const { data } = await supabase
            .from('phone_numbers')
            .select('id, account_id')
            .eq('provider_phone_number_id', providerPhoneNumberId)
            .maybeSingle();
        if (data?.account_id) return { accountId: data.account_id, phoneNumberId: data.id, method: "provider_phone_number_id" };

        // Legacy check
        const { data: legacy } = await supabase.from('phone_numbers').select('id, account_id').eq('vapi_phone_id', providerPhoneNumberId).maybeSingle();
        if (legacy?.account_id) return { accountId: legacy.account_id, phoneNumberId: legacy.id, method: "vapi_phone_id" };
    }

    // 3. E164 Number
    if (calleeE164) {
        const { data } = await supabase.from('phone_numbers').select('id, account_id').eq('e164_number', calleeE164).maybeSingle();
        if (data?.account_id) return { accountId: data.account_id, phoneNumberId: data.id, method: "e164_number" };

        const { data: legacy } = await supabase.from('phone_numbers').select('id, account_id').eq('phone_number', calleeE164).maybeSingle();
        if (legacy?.account_id) return { accountId: legacy.account_id, phoneNumberId: legacy.id, method: "phone_number" };
    }

    return { accountId: null, phoneNumberId: null, method: "none" };
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
