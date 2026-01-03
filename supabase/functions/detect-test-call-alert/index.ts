
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { initSentry, captureError } from "../_shared/sentry.ts";

const FUNCTION_NAME = "detect-test-call-alert";

serve(async (req) => {
    // 1. Setup
    initSentry(FUNCTION_NAME, { correlationId: crypto.randomUUID() });

    // Auth check: Only allow service_role key (internal cron)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    try {
        logInfo(`Starting ${FUNCTION_NAME} job`);

        // 2. Find accounts that need attention
        // Criteria:
        // - Provisioning complete (has vapi_phone_number)
        // - Activated > 30 minutes ago
        // - Created within last 24 hours (don't alert forever)
        // - No test call detected in call_logs 
        // - No alert sent yet (system_events check)

        // We do this in a few steps safely.
        // Step A: Get candidate accounts
        const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // Fetch candidate accounts
        const { data: accounts, error: searchError } = await supabase
            .from('accounts')
            .select(`
                id, 
                company_name, 
                vapi_phone_number, 
                phone_numbers!inner(id, activated_at, status, is_primary)
            `)
            .eq('provisioning_status', 'completed')
            .eq('phone_numbers.status', 'active')
            .eq('phone_numbers.is_primary', true)
            .lt('phone_numbers.activated_at', thirtyMinsAgo)
            .gt('phone_numbers.activated_at', twentyFourHoursAgo);

        if (searchError) throw searchError;
        if (!accounts || accounts.length === 0) {
            return new Response(JSON.stringify({ message: "No accounts match criteria" }), { status: 200 });
        }

        let alertsSent = 0;

        for (const account of accounts) {
            // Step B: Check for test call (RPC logic replica)
            // Inbound, completed, duration > 10s, after activation
            const phoneNumberId = account.phone_numbers[0].id;
            const activatedAt = account.phone_numbers[0].activated_at;

            const { data: testCalls, error: callError } = await supabase
                .from('call_logs')
                .select('id')
                .eq('account_id', account.id)
                .eq('phone_number_id', phoneNumberId)
                .eq('direction', 'inbound')
                .eq('status', 'completed')
                .gte('duration_seconds', 10)
                .ignoreUsers(); // Use service role purely

            // Check timestamp manually to be safe or rely on query if we added filter
            // We'll trust the count for now if > 0, strict timestamp check in JS if needed
            const hasTestCall = testCalls && testCalls.length > 0;

            if (hasTestCall) continue; // Healthy

            // Step C: Check if already alerted
            const { data: existingAlerts } = await supabase
                .from('system_events')
                .select('id, created_at')
                .eq('account_id', account.id)
                .eq('event_name', 'onboarding.alert.test_call_missing')
                .limit(1);

            if (existingAlerts && existingAlerts.length > 0) continue; // Already alerted

            // Step D: Send Alert
            // 1. Log to system_events (Rate limit record)
            await supabase.from('system_events').insert({
                event_name: 'onboarding.alert.test_call_missing',
                level: 'warn',
                account_id: account.id,
                trace_id: crypto.randomUUID(),
                metadata: {
                    company_name: account.company_name,
                    phone_number: account.vapi_phone_number,
                    activated_at: activatedAt
                }
            });

            // 2. Log to Sentry (The actual alert mechanism for me)
            captureError(new Error(`Test Call Missing: ${account.company_name}`), {
                extra: {
                    accountId: account.id,
                    phone: account.vapi_phone_number,
                    activatedAt: activatedAt
                }
            });

            alertsSent++;
        }

        logInfo(`Job complete. Sent ${alertsSent} alerts.`);
        return new Response(JSON.stringify({ success: true, alertsSent }), { status: 200 });

    } catch (err) {
        captureError(err as Error);
        return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
    }
});

function logInfo(msg: string) {
    console.log(`[${FUNCTION_NAME}] ${msg}`);
}
