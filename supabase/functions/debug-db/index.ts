
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "supabase";

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
        let accountId = url.searchParams.get("account_id");
        const email = url.searchParams.get("email");

        if (!accountId && email) {
            const { data: profile } = await supabase.from("profiles").select("account_id").eq("email", email).maybeSingle();
            if (profile) accountId = profile.account_id;
        }

        const action = url.searchParams.get("action");
        if (action === "reset" && accountId) {
            await supabase.from("accounts").update({ provisioning_status: "pending", phone_number_status: "pending" }).eq("id", accountId);
            await supabase.from("provisioning_jobs").update({ status: "queued", attempts: 0, error: null }).eq("account_id", accountId);
            return new Response(JSON.stringify({ message: "Reset successful" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (action === "fix_phone" && accountId) {
            const phone = url.searchParams.get("phone");
            if (phone) {
                const { data: job } = await supabase.from("provisioning_jobs").select("user_id").eq("account_id", accountId).maybeSingle();
                if (job?.user_id) {
                    await supabase.from("profiles").update({ phone }).eq("id", job.user_id);
                    await supabase.from("accounts").update({ notification_sms_phone: phone }).eq("id", accountId);
                    return new Response(JSON.stringify({ message: "Phone fixed" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
                }
            }
        }

        // Return account-specific data
        const { data: account } = await supabase.from("accounts").select("*").eq("id", accountId).single();
        const { data: jobs } = await supabase.from("provisioning_jobs").select("*").eq("account_id", accountId).order('created_at', { ascending: false });
        const { data: profiles } = await supabase.from("profiles").select("*").or(`account_id.eq.${accountId},id.eq.${jobs?.[0]?.user_id}`);
        const { data: phone } = await supabase.from("phone_numbers").select("*").or(`assigned_account_id.eq.${accountId},account_id.eq.${accountId}`);
        const { data: assistant } = await supabase.from("vapi_assistants").select("*").eq("account_id", accountId);
        const { data: logs } = await supabase.from("provisioning_logs").select("*").eq("account_id", accountId).order('created_at', { ascending: false }).limit(20);

        // Also get webhook inbox errors for this phone
        const vapiPhoneId = phone?.[0]?.vapi_phone_id;
        const { data: inbox } = vapiPhoneId
            ? await supabase.from("call_webhook_inbox").select("*").eq("provider_phone_number_id", vapiPhoneId).order('received_at', { ascending: false }).limit(5)
            : { data: null };
        const { data: call_logs } = await supabase.from("call_logs").select("*").eq("account_id", accountId).order('created_at', { ascending: false }).limit(5);
        const { data: appointment_records } = await supabase.from("appointments").select("*").eq("account_id", accountId).order('created_at', { ascending: false }).limit(5);

        return new Response(JSON.stringify({ account, profiles, phone, assistant, jobs, logs, inbox, call_logs, appointment_records }, null, 2), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
});
