import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // 1. Security Check
        const secret = req.headers.get('x-vapi-secret');
        const expectedSecret = Deno.env.get('VAPI_WEBHOOK_SECRET');

        // Only check if env var is set (fail soft if not configured yet, or strict if required)
        // User requested: "Reject if missing"
        if (!secret || (expectedSecret && secret !== expectedSecret)) {
            console.error("Unauthorized Vapi Webhook attempt");
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const payload = await req.json();
        console.log("Vapi Event:", payload.message?.type);

        // We mostly care about 'call-ended' (end-of-call-report) to get final data
        // But we might want 'call-started' to show "Live" status later.
        // For MVP, we handle 'end-of-call-report' primarily, but let's upsert on usage.

        const message = payload.message;
        if (!message) {
            return new Response("OK", { status: 200, headers: corsHeaders });
        }

        // Identify event type
        const isEndOfCall = message.type === 'end-of-call-report';
        const isCallStart = message.type === 'call-started'; // Check exact Vapi event name
        const isStatusUpdate = message.type === 'status-update';

        // Extract core data
        const call = message.call || message; // Vapi payload structure varies slightly by event
        const vapiCallId = call.id;

        if (!vapiCallId) {
            console.log("No call ID found, ignoring");
            return new Response("OK", { status: 200, headers: corsHeaders });
        }

        // Initialize Supabase
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // 2. Account Mapping
        // Order: vapi_phone_number -> phone_numbers table -> assistant_id -> metadata
        let accountId = call.assistant?.metadata?.account_id || call.metadata?.account_id;
        let accountPhoneNumberId = null;

        // Try to resolve via phone number if account_id is missing or to confirm
        const vapiPhoneNumber = call.phoneNumber?.number || call.customer?.number?.alias; // Alias is sometimes used
        const assistantId = call.assistantId || call.assistant?.id;

        if (!accountId && vapiPhoneNumber) {
            // Look up by vapi_number
            // We need to query phone_numbers table.
            // Assuming 'phone_numbers' has 'number' or 'vapi_id'
            // Since we didn't inspect phone_numbers fully, let's try matching 'number' or 'vapi_id'
            const { data: phoneData } = await supabase
                .from('phone_numbers')
                .select('account_id, id')
                // Fix: Check vapi_phone_id (actual column) OR vapi_id (legacy)
                .or(`phone_number.eq.${vapiPhoneNumber},vapi_phone_id.eq.${call.phoneNumber?.id},vapi_id.eq.${call.phoneNumber?.id}`)
                .limit(1)
                .single();

            if (phoneData) {
                accountId = phoneData.account_id;
                accountPhoneNumberId = phoneData.id;
            }
        }

        if (!accountId && assistantId) {
            // Fallback: Check if assistant ID matches an account config?
            // Or assume unique assistant per account. 
            // For MVP, if we can't find account_id, we log and skip insert to avoid pollution.
            console.warn(`Could not map call ${vapiCallId} to account. Assistant: ${assistantId}, Phone: ${vapiPhoneNumber}`);
            // Return 200 to acknowledge receipt
            return new Response(JSON.stringify({ message: "Skipped: No Account ID" }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 3. Prepare Upsert Data
        const startedAt = call.startedAt || new Date().toISOString();
        const endedAt = call.endedAt || (isEndOfCall ? new Date().toISOString() : null);

        // Calculate duration
        let duration = 0;
        if (call.durationSeconds) {
            duration = Math.round(call.durationSeconds);
        } else if (endedAt && startedAt) {
            duration = Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000);
        }

        const direction = call.type === 'inboundPhoneCall' ? 'inbound' : 'outbound';

        // Status normalization
        let status = call.status || (isEndOfCall ? 'completed' : 'in-progress');
        if (message.type === 'call-started') status = 'ringing'; // or in-progress

        // 5. Upsert Call Record
        // ======================
        // We use vapi_call_id as the unique key for upsert
        // Map Vapi fields to call_logs schema
        const callRecord = {
            account_id: accountId,
            vapi_call_id: payload.message?.call?.id || payload.message?.vapiCallId,
            provider: 'vapi',
            provider_call_id: payload.message?.call?.id || payload.message?.vapiCallId,
            phone_number_id: accountPhoneNumberId, // Was account_phone_number_id
            direction: call.type === 'inboundPhoneCall' ? 'inbound' : 'outbound',
            from_number: call.customer?.number, // Was caller_number
            to_number: call.phoneNumber?.number,
            started_at: call.startedAt ? new Date(call.startedAt).toISOString() : null,
            ended_at: call.endedAt ? new Date(call.endedAt).toISOString() : null,
            duration_seconds: duration,
            status: mapVapiStatus(payload.message.type, call.status),
            transcript: call.transcript || payload.message?.transcript, // Full transcript
            summary: call.analysis?.summary || payload.message?.summary, // Was transcript_summary
            recording_url: call.recordingUrl,
            cost: call.cost ? call.cost : null, // Assuming cost in dollars or need conversion? Vapi sends cost. call_logs has NUMERIC(10,4).
            raw_payload: payload, // Store full payload for debugging
            updated_at: new Date().toISOString()
        };

        // Cost handling: Vapi often sends cost in USD (e.g. 0.05). call_logs.cost is numeric. 
        // If it's 0, we keep it.

        const { error: upsertError } = await supabase
            .from('call_logs')
            .upsert(callRecord, { onConflict: 'vapi_call_id' });

        if (upsertError) {
            console.error('Failed to upsert call log:', upsertError);
            return new Response(JSON.stringify({ error: upsertError.message }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500,
            });
        }

        return new Response(JSON.stringify({ success: true, id: payload.message?.call?.id }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});

function mapVapiStatus(messageType: string, vapiStatus: string | undefined): string {
    // If call ended, strict status
    if (messageType === 'end-of-call-report') return 'completed';

    // Map Vapi status to our status
    // Vapi: queued, ringing, in-progress, forwarded, ended
    // calls: completed, failed, busy, no-answer (from schema comment)
    // But we can store whatever text we want usually, unless it's an enum. Schema says TEXT.

    if (vapiStatus === 'in-progress') return 'in-progress';
    if (vapiStatus === 'ringing') return 'ringing';
    if (!vapiStatus) return 'initiated';

    return vapiStatus;
}
