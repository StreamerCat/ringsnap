import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "supabase";
import { JobberClient } from "../_shared/jobber-client.ts";
import { JobberAdapter } from "../_shared/jobber-adapter.ts";
import { CallOutcomeEvent } from "../_shared/integration-types.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Get all active Jobber connections
        const { data: connections, error: connError } = await supabase
            .from('jobber_connections')
            .select('*')
            .not('access_token', 'is', null);

        if (connError) throw connError;

        const results = [];

        // 2. Process each account
        for (const conn of connections) {
            // Fetch events that haven't been successfully synced
            // Logic: Event exists, but no "success" log entry exists for it in 'jobber_sync_logs'

            // Supabase/PostgREST doesn't support complex NOT IN subqueries easily in one go on joined tables without views.
            // Simplified approach: Fetch recent events (last 24h) and filtering in code or fetching logs too.
            // Better: Create a stored procedure or view. For MVP, fetch recent events and specific logs.

            const { data: events } = await supabase
                .from('call_outcome_events')
                .select('*')
                .eq('account_id', conn.account_id)
                .order('created_at', { ascending: false })
                .limit(50); // Batch size

            if (!events || events.length === 0) continue;

            // Fetch success logs for these events
            const eventIds = events.map((e: any) => e.id);
            const { data: logs } = await supabase
                .from('jobber_sync_logs')
                .select('call_event_id')
                .in('call_event_id', eventIds)
                .eq('status', 'success');

            const successIds = new Set(logs?.map((l: any) => l.call_event_id));
            const unsyncedEvents = events.filter((e: any) => !successIds.has(e.id));

            if (unsyncedEvents.length === 0) continue;

            console.log(`Processing ${unsyncedEvents.length} events for account ${conn.account_id}`);

            const client = new JobberClient({
                access_token: conn.access_token,
                refresh_token: conn.refresh_token
            });
            const adapter = new JobberAdapter(client, conn.account_id, supabase);

            for (const event of unsyncedEvents) {
                try {
                    await adapter.syncCallOutcome(event as CallOutcomeEvent);
                    results.push({ eventId: event.id, status: 'synced' });
                } catch (e) {
                    console.error(`Failed event ${event.id}:`, e);
                    results.push({ eventId: event.id, status: 'error', error: e.message });
                }
            }
        }

        return new Response(JSON.stringify({ message: "Sync complete", results }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        console.error("Jobber sync failed:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
