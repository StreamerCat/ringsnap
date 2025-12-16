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
    createdAt?: string; // Fallback
    endedAt?: string;
    durationSeconds?: number;
    phoneNumberId?: string; // New field seen in payload
    transport?: {
        to?: string;
        from?: string;
    };
    customer?: {
        number?: string;
        name?: string;
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
        successEvaluation?: boolean | string;
        structuredData?: Record<string, unknown>;
    };
    // Tool results for booking detection
    messages?: Array<{
        role?: string;
        toolCalls?: Array<{
            function?: {
                name?: string;
                arguments?: string;
            };
        }>;
        toolCallResult?: {
            name?: string;
            result?: string;
        };
    }>;
    toolCalls?: Array<{
        name?: string;
        arguments?: Record<string, unknown>;
        result?: unknown;
    }>;
}

interface VapiMessage {
    type: string;
    call?: VapiCall;
    transcript?: string;
    summary?: string;
    endedAt?: string; // Message-level endedAt
    recordingUrl?: string;
    cost?: number;
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

        // Robust extraction of PhoneNumberID
        providerPhoneNumberId = call.phoneNumber?.id ?? call.phoneNumberId ?? null;

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
        // 3. Security Check
        // ========================================
        const authMode = Deno.env.get('VAPI_WEBHOOK_AUTH_MODE') || 'secret';
        const expectedSecret = Deno.env.get('VAPI_WEBHOOK_SECRET');
        const incomingSecret = req.headers.get('x-vapi-secret');

        // Only enforce if mode is 'secret' (default) AND a secret is actually configured
        if (authMode === 'secret' && expectedSecret) {
            if (!incomingSecret || incomingSecret !== expectedSecret) {
                const errorMsg = incomingSecret ? "Secret mismatch" : "Missing secret header";

                // Write to inbox so we can debug *why* it failed (e.g. wrong config)
                await writeToInbox(supabase, {
                    provider_call_id: providerCallId,
                    provider_phone_number_id: providerPhoneNumberId,
                    reason: "unauthorized",
                    payload: body,
                    error: errorMsg,
                });

                console.error(JSON.stringify({
                    event: "vapi_webhook_unauthorized",
                    providerCallId,
                    error: errorMsg
                }));

                return new Response(JSON.stringify({ error: "Unauthorized" }), {
                    status: 401,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
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
            // ... (error handling same as before)
            // ...
            function buildCallRecord(
                call: VapiCall,
                message: VapiMessage,
                mapping: MappingResult,
                rawPayload: unknown
            ): Record<string, unknown> {
                const isEndOfCall = message.type === 'end-of-call-report';
                const isCallStarted = message.type === 'call-started';

                // Timestamp & Duration Logic
                // Vapi sometimes sends 'createdAt' instead of 'startedAt' in the call object
                // 'endedAt' might be on the message object, not the call object
                const startedAt = call.startedAt ?? call.createdAt;
                const endedAt = call.endedAt ?? message.endedAt;

                let durationSeconds = 0;
                if (call.durationSeconds) {
                    durationSeconds = Math.round(call.durationSeconds);
                } else if (endedAt && startedAt) {
                    durationSeconds = Math.round(
                        (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000
                    );
                }

                // Determine status
                let status = call.status || (isEndOfCall ? 'completed' : 'in-progress');
                // Normalize Vapi status to our DB enum
                if (status === 'ringing' || status === 'queued') status = 'in_progress'; // simplified mapping
                if (isCallStarted) status = 'in_progress';
                if (isEndOfCall) status = 'completed';

                // Direction
                const direction = call.type === 'inboundPhoneCall' ? 'inbound' : 'outbound';

                // Extract caller info
                const callerPhone = call.customer?.number ?? null;
                const callerName = extractCallerName(call, message);
                const reason = extractReason(call);

                // Detect booking from tool calls
                const bookingInfo = detectBooking(call, message);
                const booked = bookingInfo.booked;
                const appointmentStart = bookingInfo.appointmentStart;
                const appointmentEnd = bookingInfo.appointmentEnd;

                // Lead captured = has name AND phone, but only set on end-of-call
                const leadCaptured = isEndOfCall && !!callerName && !!callerPhone;

                // Determine outcome
                let outcome: string | null = null;
                if (isEndOfCall) {
                    if (booked) outcome = 'booked';
                    else if (leadCaptured) outcome = 'lead';
                    else outcome = 'other';
                }

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
                    // Always save raw_payload for debugging, but maybe lighter on non-end?
                    // Actually, saving it on 'call-started' helps debug initial state.
                    raw_payload: rawPayload,
                };

                if (isEndOfCall) {
                    record.ended_at = endedAt ? new Date(endedAt).toISOString() : null;
                    record.duration_seconds = durationSeconds;
                    record.transcript = call.transcript ?? message.transcript ?? null;
                    record.summary = call.analysis?.summary ?? message.summary ?? null;
                    record.recording_url = call.recordingUrl ?? message.recordingUrl ?? null;
                    record.cost = call.cost ?? message.cost ?? null;

                    // Metadata fields
                    record.caller_name = callerName;
                    record.reason = reason;
                    record.outcome = outcome;
                    record.booked = booked;
                    record.lead_captured = leadCaptured;
                    if (appointmentStart) record.appointment_start = appointmentStart;
                    if (appointmentEnd) record.appointment_end = appointmentEnd;
                }

                return record;
            }

            /**
             * Extract caller name with improved fallback
             */
            function extractCallerName(call: VapiCall, message: VapiMessage): string | null {
                // 1. Check customer.name
                if (call.customer?.name) return call.customer.name;

                // 2. Check analysis structured data
                // (Note: structuredData might be on message.call.analysis OR message.analysis ?? logic varies)
                const structuredData = call.analysis?.structuredData ?? (message as any).analysis?.structuredData;

                if (structuredData) {
                    if (typeof structuredData.callerName === 'string') return structuredData.callerName;
                    if (typeof structuredData.customerName === 'string') return structuredData.customerName;
                    if (typeof structuredData.name === 'string') return structuredData.name;
                }

                // 3. Check tool calls arguments
                if (call.toolCalls) {
                    for (const tc of call.toolCalls) {
                        const args = tc.arguments;
                        if (args) {
                            if (typeof args.customerName === 'string') return args.customerName;
                            if (typeof args.name === 'string') return args.name;
                        }
                    }
                }

                return null;
            }

            // ... detectBooking similar update ...

            /**
             * Extract reason for call from summary or analysis
             */
            function extractReason(call: VapiCall): string | null {
                // Check structured data first
                if (call.analysis?.structuredData) {
                    const data = call.analysis.structuredData;
                    if (typeof data.reason === 'string') return data.reason;
                    if (typeof data.callReason === 'string') return data.callReason;
                    if (typeof data.intent === 'string') return data.intent;
                }

                // If summary is short enough, use it as reason
                const summary = call.analysis?.summary;
                if (summary && summary.length <= 200) {
                    return summary;
                }

                return null;
            }

            /**
             * Detect booking from tool calls or analysis
             */
            /**
 * Detect booking from tool calls or analysis
 */
            function detectBooking(call: VapiCall, message: VapiMessage): {
                booked: boolean;
                appointmentStart: string | null;
                appointmentEnd: string | null;
            } {
                // Check structured data (location varies)
                const structuredData = call.analysis?.structuredData ?? (message as any).analysis?.structuredData;

                if (structuredData) {
                    if (structuredData.appointmentBooked === true || structuredData.booked === true) {
                        return {
                            booked: true,
                            appointmentStart: typeof structuredData.appointmentStart === 'string' ? structuredData.appointmentStart : null,
                            appointmentEnd: typeof structuredData.appointmentEnd === 'string' ? structuredData.appointmentEnd : null,
                        };
                    }
                }

                // Check success evaluation
                // If "successEvaluation" is true, it OFTEN means booked, but check carefully
                const successEval = call.analysis?.successEvaluation ?? (message as any).analysis?.successEvaluation;
                if (successEval === true || successEval === 'true') {
                    if (structuredData?.appointmentTime) {
                        return { booked: true, appointmentStart: null, appointmentEnd: null };
                    }
                }

                // Check tool calls for scheduling-related tools
                if (call.toolCalls) {
                    for (const tc of call.toolCalls) {
                        const name = tc.name?.toLowerCase() ?? '';
                        // Common scheduling tool patterns
                        if (name.includes('schedule') || name.includes('book') || name.includes('appointment') || name.includes('calendar')) {
                            const result = tc.result;
                            // If tool returned success
                            if (result && typeof result === 'object' && (result as any).success === true) {
                                const args = tc.arguments ?? {};
                                return {
                                    booked: true,
                                    appointmentStart: typeof args.startTime === 'string' ? args.startTime : null,
                                    appointmentEnd: typeof args.endTime === 'string' ? args.endTime : null,
                                };
                            }
                        }
                    }
                }

                // Check message tool call results
                if (call.messages) {
                    for (const msg of call.messages) {
                        if (msg.toolCallResult) {
                            const name = msg.toolCallResult.name?.toLowerCase() ?? '';
                            if (name.includes('schedule') || name.includes('book') || name.includes('appointment')) {
                                try {
                                    const resultData = JSON.parse(msg.toolCallResult.result ?? '{}');
                                    if (resultData.success || resultData.booked || resultData.confirmed) {
                                        return { booked: true, appointmentStart: null, appointmentEnd: null };
                                    }
                                } catch {
                                    // Ignore parse errors
                                }
                            }
                        }
                    }
                }

                return { booked: false, appointmentStart: null, appointmentEnd: null };
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
