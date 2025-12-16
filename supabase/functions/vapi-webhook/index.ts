import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Vapi Webhook Handler
 * 
 * Processes Vapi server events (call-started, end-of-call-report, status-update)
 * and upserts call data into call_logs table.
 * 
 * Mapping Strategy:
 * 1. Primary: provider_phone_number_id → phone_numbers.provider_phone_number_id
 * 2. Secondary: e164 → phone_numbers.e164_number OR phone_numbers.phone_number
 * 
 * On any failure, writes to call_webhook_inbox for debugging.
 */

interface VapiCall {
    id?: string;
    type?: string;
    status?: string;
    startedAt?: string;
    endedAt?: string;
    durationSeconds?: number;
    customer?: {
        number?: string;
    };
    phoneNumber?: {
        id?: string;
        number?: string;
    };
    assistant?: {
        id?: string;
        metadata?: {
            account_id?: string;
        };
    };
    assistantId?: string;
    transcript?: string;
    recordingUrl?: string;
    cost?: number;
    analysis?: {
        summary?: string;
    };
}

interface VapiMessage {
    type: string;
    call?: VapiCall;
    transcript?: string;
    summary?: string;
}

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

    // Initialize Supabase early for inbox writes
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let body: unknown;
    let providerCallId: string | null = null;
    let providerPhoneNumberId: string | null = null;

    try {
        // ========================================
        // 1. Parse and normalize payload
        // ========================================
        body = await req.json();

        const message: VapiMessage = (body as any).message ?? body;
        const type = message.type;

        if (!type) {
            // Not a structured Vapi event, acknowledge silently
            return new Response("OK", { status: 200, headers: corsHeaders });
        }

        const call: VapiCall = message.call ?? (message as unknown as VapiCall);
        providerCallId = call.id ?? null;
        providerPhoneNumberId = call.phoneNumber?.id ?? null;

        // Structured log
        console.log(JSON.stringify({
            event: "vapi_webhook_received",
            type,
            providerCallId,
            providerPhoneNumberId,
            hasCall: !!call.id,
        }));

        // ========================================
        // 2. Validate required fields
        // ========================================
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

        // ========================================
        // 3. Security Check (optional)
        // ========================================
        const secret = req.headers.get('x-vapi-secret');
        const expectedSecret = Deno.env.get('VAPI_WEBHOOK_SECRET');

        if (expectedSecret && secret !== expectedSecret) {
            console.error(JSON.stringify({
                event: "vapi_webhook_unauthorized",
                providerCallId,
            }));
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // ========================================
        // 4. Map to account (sequential lookups)
        // ========================================
        const mappingResult = await mapToAccount(supabase, call);

        if (!mappingResult.accountId) {
            await writeToInbox(supabase, {
                provider_call_id: providerCallId,
                provider_phone_number_id: providerPhoneNumberId,
                reason: "unmapped_account",
                payload: body,
                error: `Could not map to account. Method tried: ${mappingResult.method}`,
            });
            console.log(JSON.stringify({
                event: "vapi_webhook_unmapped",
                providerCallId,
                providerPhoneNumberId,
                method: mappingResult.method,
            }));
            return new Response(JSON.stringify({ message: "Skipped: unmapped" }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // ========================================
        // 5. Build call record
        // ========================================
        const callRecord = buildCallRecord(call, message, mappingResult, body);

        // ========================================
        // 6. Upsert to call_logs
        // ========================================
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
            console.error(JSON.stringify({
                event: "vapi_webhook_upsert_failed",
                providerCallId,
                error: upsertError.message,
            }));
            // Return 200 to prevent Vapi retries (we have the data in inbox)
            return new Response(JSON.stringify({ error: "upsert_failed", stored_to_inbox: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        console.log(JSON.stringify({
            event: "vapi_webhook_success",
            type,
            providerCallId,
            accountId: mappingResult.accountId,
            mappingMethod: mappingResult.method,
        }));

        return new Response(JSON.stringify({ success: true, id: providerCallId }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);

        // Try to write to inbox on any error
        try {
            await writeToInbox(supabase, {
                provider_call_id: providerCallId,
                provider_phone_number_id: providerPhoneNumberId,
                reason: "exception",
                payload: body ?? { error: "failed to parse body" },
                error: errorMessage,
            });
        } catch (inboxErr) {
            console.error("Failed to write to inbox:", inboxErr);
        }

        console.error(JSON.stringify({
            event: "vapi_webhook_error",
            providerCallId,
            error: errorMessage,
        }));

        // Return 200 to prevent Vapi retries
        return new Response(JSON.stringify({ error: errorMessage, stored_to_inbox: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }
});

/**
 * Map call to account using sequential lookups (not OR chains)
 */
async function mapToAccount(
    supabase: ReturnType<typeof createClient>,
    call: VapiCall
): Promise<MappingResult> {
    const providerPhoneNumberId = call.phoneNumber?.id;
    const calleeE164 = call.phoneNumber?.number;

    // Method 1: Check assistant metadata (fastest if set)
    const metadataAccountId = call.assistant?.metadata?.account_id;
    if (metadataAccountId) {
        return { accountId: metadataAccountId, phoneNumberId: null, method: "metadata" };
    }

    // Method 2: Primary - by provider_phone_number_id (new canonical column)
    if (providerPhoneNumberId) {
        const { data } = await supabase
            .from('phone_numbers')
            .select('id, account_id')
            .eq('provider_phone_number_id', providerPhoneNumberId)
            .maybeSingle();

        if (data?.account_id) {
            return { accountId: data.account_id, phoneNumberId: data.id, method: "provider_phone_number_id" };
        }

        // Method 2b: Fallback to legacy vapi_phone_id column
        const { data: legacyData } = await supabase
            .from('phone_numbers')
            .select('id, account_id')
            .eq('vapi_phone_id', providerPhoneNumberId)
            .maybeSingle();

        if (legacyData?.account_id) {
            return { accountId: legacyData.account_id, phoneNumberId: legacyData.id, method: "vapi_phone_id" };
        }
    }

    // Method 3: Secondary - by e164 number
    if (calleeE164) {
        // Try new e164_number column first
        const { data: e164Data } = await supabase
            .from('phone_numbers')
            .select('id, account_id')
            .eq('e164_number', calleeE164)
            .maybeSingle();

        if (e164Data?.account_id) {
            return { accountId: e164Data.account_id, phoneNumberId: e164Data.id, method: "e164_number" };
        }

        // Fallback to legacy phone_number column
        const { data: legacyE164Data } = await supabase
            .from('phone_numbers')
            .select('id, account_id')
            .eq('phone_number', calleeE164)
            .maybeSingle();

        if (legacyE164Data?.account_id) {
            return { accountId: legacyE164Data.account_id, phoneNumberId: legacyE164Data.id, method: "phone_number" };
        }
    }

    return { accountId: null, phoneNumberId: null, method: "none" };
}

/**
 * Build call record for upsert
 */
function buildCallRecord(
    call: VapiCall,
    message: VapiMessage,
    mapping: MappingResult,
    rawPayload: unknown
): Record<string, unknown> {
    const isEndOfCall = message.type === 'end-of-call-report';

    // Calculate duration
    let durationSeconds = 0;
    if (call.durationSeconds) {
        durationSeconds = Math.round(call.durationSeconds);
    } else if (call.endedAt && call.startedAt) {
        durationSeconds = Math.round(
            (new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000
        );
    }

    // Determine status
    let status = call.status || (isEndOfCall ? 'completed' : 'in-progress');
    if (message.type === 'call-started') {
        status = 'ringing';
    } else if (isEndOfCall) {
        status = 'completed';
    }

    // Direction
    const direction = call.type === 'inboundPhoneCall' ? 'inbound' : 'outbound';

    return {
        account_id: mapping.accountId,
        vapi_call_id: call.id, // Keep using vapi_call_id as unique key
        provider: 'vapi',
        provider_call_id: call.id, // Also populate provider_call_id if column exists
        phone_number_id: mapping.phoneNumberId,
        direction,
        from_number: call.customer?.number ?? null,
        to_number: call.phoneNumber?.number ?? null,
        started_at: call.startedAt ? new Date(call.startedAt).toISOString() : null,
        ended_at: call.endedAt ? new Date(call.endedAt).toISOString() : null,
        duration_seconds: durationSeconds,
        status,
        transcript: call.transcript ?? message.transcript ?? null,
        summary: call.analysis?.summary ?? message.summary ?? null,
        recording_url: call.recordingUrl ?? null,
        cost: call.cost ?? null,
        raw_payload: rawPayload,
        updated_at: new Date().toISOString(),
    };
}

/**
 * Write failed webhook to inbox for debugging
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
    } catch (err) {
        console.error("Failed to write to call_webhook_inbox:", err);
    }
}
