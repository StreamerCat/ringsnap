import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "supabase";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // Config: Default to DRY RUN for safety
        const { dryRun = true, allowlist = [] } = await req.json().catch(() => ({}));

        // Safety check: Require allowlist if not dry run? Or just be careful.

        const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
        const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");

        if (!accountSid || !authToken) throw new Error("Missing Twilio credentials");

        // 1. Fetch Twilio Numbers
        let twilioNumbers: any[] = [];
        let pageUri = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json?PageSize=100`;

        while (pageUri) {
            const res = await fetch(pageUri, {
                headers: { 'Authorization': 'Basic ' + btoa(accountSid + ':' + authToken) }
            });
            const data = await res.json();
            if (data.incoming_phone_numbers) {
                twilioNumbers = [...twilioNumbers, ...data.incoming_phone_numbers];
            }
            pageUri = data.next_page_uri ? `https://api.twilio.com${data.next_page_uri}` : null;
        }

        // 2. Fetch Active Account Numbers (Cross-Reference)
        // We must NEVER pool a number that belongs to an active customer, even if phone_numbers table is out of sync.
        const { data: activeAccounts } = await supabase
            .from('accounts')
            .select('phone_number_e164')
            .in('subscription_status', ['active', 'trialing', 'past_due'])
            .not('phone_number_e164', 'is', null);

        const activeAccountNumbers = new Set(activeAccounts?.map(a => a.phone_number_e164) || []);
        console.log(`Found ${activeAccountNumbers.size} active account numbers.`);

        console.log(`Found ${twilioNumbers.length} Twilio numbers.`);
        const logs: string[] = [];
        const results = {
            added: 0,
            updated_sid: 0,
            skipped: 0,
            skipped_active_account: 0,
            skipped_assigned_db: 0,
            skipped_cooldown: 0,
            error: 0
        };

        for (const tn of twilioNumbers) {
            const e164 = tn.phone_number;

            // Filter by allowlist if provided
            if (allowlist.length > 0 && !allowlist.includes(e164)) {
                continue;
            }

            // SAFETY: Check Active Accounts Set
            if (activeAccountNumbers.has(e164)) {
                logs.push(`[SKIP-ACTIVE] ${e164} matches an active account's record.`);
                results.skipped_active_account++;
                continue;
            }

            // Check DB
            const { data: existing } = await supabase
                .from('phone_numbers')
                .select('*')
                .or(`e164_number.eq.${e164},phone_number.eq.${e164}`)
                .maybeSingle();

            if (!existing) {
                // New number found in Twilio but not DB.
                // Could be a pool candidate.
                if (dryRun) {
                    logs.push(`[DRY] Would insert ${e164} as POOL`);
                } else {
                    await supabase.from('phone_numbers').insert({
                        phone_number: e164,
                        e164_number: e164,
                        twilio_phone_number_sid: tn.sid,
                        lifecycle_status: 'pool',
                        status: 'released',
                        area_code: e164.slice(2, 5),
                        provider: 'twilio',
                        released_at: new Date().toISOString()
                    });
                    logs.push(`[ACT] Inserted ${e164} as POOL`);
                }
                results.added++;
            } else {
                // Exists in DB.
                // SAFETY: Never touch if assigned/active
                if (existing.lifecycle_status === 'assigned' || existing.status === 'active' || existing.account_id) {
                    logs.push(`[SKIP-ASSIGNED] ${e164} is ACTIVE/ASSIGNED in DB (ID: ${existing.id})`);
                    results.skipped_assigned_db++;
                    continue;
                }

                if (existing.lifecycle_status === 'cooldown') {
                    logs.push(`[SKIP] ${e164} is COOLDOWN`);
                    results.skipped++;
                    continue;
                }

                // Safe to update SID if missing
                if (!existing.twilio_phone_number_sid) {
                    if (dryRun) {
                        logs.push(`[DRY] Would update SID for ${e164}`);
                    } else {
                        await supabase.from('phone_numbers').update({
                            twilio_phone_number_sid: tn.sid
                        }).eq('id', existing.id);
                        logs.push(`[ACT] Updated SID for ${e164}`);
                    }
                    results.updated_sid++;
                }
            }
        }

        return new Response(
            JSON.stringify({ success: true, dryRun, results, logs }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
    } catch (error) {
        return new Response(
            JSON.stringify({ error: String(error) }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
    }
});
