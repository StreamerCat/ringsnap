
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        const supabase = createClient(supabaseUrl, supabaseKey);

        const url = new URL(req.url);
        const accountId = url.searchParams.get("account_id");

        // If no account_id, return global jobs/logs
        if (!accountId) {
            const { data: jobs } = await supabase.from("provisioning_jobs").select("*").order('created_at', { ascending: false }).limit(5);
            const { data: logs } = await supabase.from("provisioning_logs").select("*").order('created_at', { ascending: false }).limit(20);
            return new Response(JSON.stringify({ jobs, logs }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Return account-specific data
        const { data: account } = await supabase.from("accounts").select("provisioning_status, vapi_phone_number, vapi_assistant_id").eq("id", accountId).single();
        const { data: phone } = await supabase.from("phone_numbers").select("*").eq("account_id", accountId);
        const { data: assistant } = await supabase.from("vapi_assistants").select("*").eq("account_id", accountId);
        const { data: jobs } = await supabase.from("provisioning_jobs").select("*").eq("account_id", accountId).order('created_at', { ascending: false });

        return new Response(JSON.stringify({ account, phone, assistant, jobs }, null, 2), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
});
