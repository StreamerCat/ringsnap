
import { createClient } from "supabase";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const now = new Date();
        const lookbackMinutes = 15;
        const thresholdDate = new Date(now.getTime() - lookbackMinutes * 60000).toISOString();

        // 1. Check for Provisioning Failures in Analytics Events
        const { data: failedEvents, error: eventsError } = await supabase
            .from('analytics_events')
            .select('*')
            .eq('event_type', 'provisioning_failed')
            .gte('created_at', thresholdDate);

        if (eventsError) throw eventsError;

        // 2. Check for Provisioning Jobs Stuck or Failed
        const { data: failedJobs, error: jobsError } = await supabase
            .from('provisioning_jobs')
            .select('*')
            .in('status', ['failed'])
            .gte('updated_at', thresholdDate);

        if (jobsError) throw jobsError;

        const issues = [
            ...(failedEvents || []).map(e => `Provisioning Failed Event: ${JSON.stringify(e.metadata)}`),
            ...(failedJobs || []).map(j => `Provisioning Job Failed: ID ${j.id} - ${j.error}`)
        ];

        if (issues.length > 0) {
            const message = `[ALERT] System detected ${issues.length} critical issues in the last ${lookbackMinutes} minutes:\n${issues.join('\n')}`;

            console.error(message);

            // Ensure this error is visible in logs
            // Todo: Send email via Resend if configured
            // if (Deno.env.get('RESEND_API_KEY')) { ... }

            return new Response(JSON.stringify({ alert_triggered: true, issues_count: issues.length, message }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200 // Return 200 to acknowledge run, but we logged error above
            });
        }

        return new Response(JSON.stringify({ alert_triggered: false, message: "System healthy" }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        console.error("Monitor Alerts Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
