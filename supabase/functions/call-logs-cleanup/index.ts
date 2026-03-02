import { createClient } from "supabase";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Call Logs Cleanup Job
 * 
 * Implements data retention policy:
 * - raw_payload: null after 7 days
 * - transcript: null after 30 days
 * 
 * Schedule: Run daily via cron
 */

const FUNCTION_NAME = "call-logs-cleanup";
const RAW_PAYLOAD_RETENTION_DAYS = 7;
const TRANSCRIPT_RETENTION_DAYS = 30;

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const startTime = Date.now();

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // ========================================
        // 1. Clear raw_payload after 7 days
        // ========================================
        const rawPayloadCutoff = new Date(
            Date.now() - RAW_PAYLOAD_RETENTION_DAYS * 24 * 60 * 60 * 1000
        ).toISOString();

        const { data: rawPayloadUpdated, error: rawPayloadError } = await supabase
            .from('call_logs')
            .update({ raw_payload: null, updated_at: new Date().toISOString() })
            .lt('created_at', rawPayloadCutoff)
            .not('raw_payload', 'is', null)
            .select('id');

        if (rawPayloadError) {
            console.error(JSON.stringify({
                event: "cleanup_raw_payload_error",
                error: rawPayloadError.message,
            }));
        }

        const rawPayloadCount = rawPayloadUpdated?.length ?? 0;

        // ========================================
        // 2. Clear transcript after 30 days
        // ========================================
        const transcriptCutoff = new Date(
            Date.now() - TRANSCRIPT_RETENTION_DAYS * 24 * 60 * 60 * 1000
        ).toISOString();

        const { data: transcriptUpdated, error: transcriptError } = await supabase
            .from('call_logs')
            .update({ transcript: null, updated_at: new Date().toISOString() })
            .lt('created_at', transcriptCutoff)
            .not('transcript', 'is', null)
            .select('id');

        if (transcriptError) {
            console.error(JSON.stringify({
                event: "cleanup_transcript_error",
                error: transcriptError.message,
            }));
        }

        const transcriptCount = transcriptUpdated?.length ?? 0;

        const duration = Date.now() - startTime;

        console.log(JSON.stringify({
            event: "cleanup_complete",
            rawPayloadCleared: rawPayloadCount,
            transcriptCleared: transcriptCount,
            durationMs: duration,
        }));

        return new Response(JSON.stringify({
            status: "completed",
            rawPayloadCleared: rawPayloadCount,
            transcriptCleared: transcriptCount,
            durationMs: duration,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(JSON.stringify({
            event: "cleanup_error",
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
