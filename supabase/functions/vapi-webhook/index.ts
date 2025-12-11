import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { CallOutcome } from "../_shared/integration-types.ts";
import { trackEvent } from "../_shared/analytics.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const payload = await req.json();
        console.log("Vapi Webhook Payload:", JSON.stringify(payload, null, 2));

        // Only process end-of-call-report
        if (payload.message?.type !== 'end-of-call-report') {
            return new Response(JSON.stringify({ message: "Ignored message type" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        const { call, transcript, recordingUrl, summary, analysis } = payload.message;

        // Calculate duration
        const durationSeconds = call.durationSeconds || (call.endedAt && call.startedAt ? Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000) : 0);

        // We need account_id. 
        // Vapi allows passing custom data in the assistant config or call setup. 
        // Assuming metadata.account_id exists in the call object (standard RingSnap pattern).
        // If not, we might need to look up via phone number or assistantId.
        const accountId = call?.assistant?.metadata?.account_id || call?.metadata?.account_id;

        if (!accountId) {
            console.error("Missing account_id in metadata");
            return new Response(JSON.stringify({ error: "Missing account_id" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            });
        }

        // Determine Outcome
        let outcome: CallOutcome = 'new_lead'; // Default

        // Simple logic based on analysis or status
        if (call.endedReason === 'customer-did-not-answer' || call.endedReason === 'ring-timeout') {
            outcome = 'missed_call';
        } else if (analysis?.successEvaluation === false) {
            // Example: logic could be more complex here
            outcome = 'missed_call';
        } else {
            // If we have contact info match, maybe 'existing_customer'. 
            // For now, default to 'new_lead' unless we find a specific tag or intent.
            if (summary?.includes("quote") || summary?.includes("estimate")) {
                outcome = 'quote_requested';
            } else if (summary?.includes("book") || summary?.includes("schedule")) {
                outcome = 'booking_created';
            }
        }

        const event = {
            account_id: accountId,
            occurred_at: call.startedAt || new Date().toISOString(),
            from_number: call.customer?.number || 'unknown',
            to_number: call.phoneNumber?.number || 'unknown',
            contact_phone: call.customer?.number || 'unknown',
            contact_name: call.customer?.name || null,
            contact_email: call.customer?.email || null,
            source: (call.type === 'inboundPhoneCall' ? 'inbound' : 'outbound') as 'inbound' | 'outbound',
            outcome: outcome,
            summary: summary || analysis?.summary || "No summary available",
            transcript_url: transcript || null,
            recording_url: recordingUrl || null,
            tags: [],
            duration_seconds: durationSeconds
        };

        // Insert into Supabase
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { error } = await supabase
            .from('call_outcome_events')
            .insert(event);

        if (error) {
            console.error("Error inserting call outcome:", error);
            throw error;
        }

        // Track Lead Created in Analytics
        if (outcome === 'new_lead' || outcome === 'quote_requested' || outcome === 'booking_created') {
            await trackEvent(supabase, accountId, null, 'lead_created', {
                call_id: call.id,
                outcome: outcome,
                summary_snippet: summary?.substring(0, 100)
            });
        }

        // Always track call completed
        await trackEvent(supabase, accountId, null, 'call_completed', {
            call_id: call.id,
            duration: durationSeconds,
            outcome: outcome,
            direction: call.type === 'inboundPhoneCall' ? 'inbound' : 'outbound'
        });

        return new Response(JSON.stringify({ message: "Success", event }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        console.error("Error processing webhook:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
