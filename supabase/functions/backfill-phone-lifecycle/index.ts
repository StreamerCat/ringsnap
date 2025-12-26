import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?target=deno";

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

        // 1. Fetch all phone numbers that are "active" legacy style but missing lifecycle_status
        const { data: legacyActive, error } = await supabase
            .from('phone_numbers')
            .select('id, account_id, status, lifecycle_status')
            .eq('status', 'active')
            .is('lifecycle_status', null)
            .not('account_id', 'is', null);

        if (error) throw error;

        const results = { eligible: legacyActive?.length || 0, updated: 0, errors: 0 };
        const logs: string[] = [];

        if (legacyActive && legacyActive.length > 0) {
            for (const phone of legacyActive) {
                // Update to assigned
                const { error: updateError } = await supabase
                    .from('phone_numbers')
                    .update({
                        lifecycle_status: 'assigned',
                        assigned_account_id: phone.account_id,
                        assigned_at: new Date().toISOString() // approximated
                    })
                    .eq('id', phone.id);

                if (updateError) {
                    logs.push(`Failed to update ${phone.id}: ${updateError.message}`);
                    results.errors++;
                } else {
                    results.updated++;
                }
            }
        }

        return new Response(
            JSON.stringify({ success: true, results, logs }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );

    } catch (error) {
        return new Response(
            JSON.stringify({ error: String(error) }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
    }
});
