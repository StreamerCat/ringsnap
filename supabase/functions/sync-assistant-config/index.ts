
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

const VAPI_BASE_URL = "https://api.vapi.ai";

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // 1. Verify Auth
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'No authorization header' }), { status: 401, headers: corsHeaders });
        }

        const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        if (userError || !user) {
            return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: corsHeaders });
        }

        // 2. Get User's Account & Role
        const { data: profile } = await supabase
            .from('profiles')
            .select('account_id')
            .eq('id', user.id)
            .single();

        if (!profile?.account_id) {
            return new Response(JSON.stringify({ error: 'User not associated with an account' }), { status: 403, headers: corsHeaders });
        }

        // Check Role (Owner/Admin only)
        const { data: member } = await supabase
            .from('account_members')
            .select('role')
            .eq('user_id', user.id)
            .eq('account_id', profile.account_id)
            .single();

        if (!member || !['owner', 'admin'].includes(member.role)) {
            return new Response(JSON.stringify({ error: 'Unauthorized: Requires Owner or Admin role' }), { status: 403, headers: corsHeaders });
        }

        // 3. Parse Request
        const { template_body } = await req.json();
        if (!template_body || typeof template_body !== 'string' || template_body.length < 10) {
            return new Response(JSON.stringify({ error: 'Invalid template body' }), { status: 400, headers: corsHeaders });
        }

        // 4. Update Database (assistant_templates)
        // We update the default template for this account.
        // First, find the trade (we assume single trade per account for now, or just update the active default)
        const { data: account } = await supabase
            .from('accounts')
            .select('trade, vapi_assistant_id')
            .eq('id', profile.account_id)
            .single();

        if (!account) throw new Error("Account not found");

        const trade = account.trade || 'general';

        // Upsert the template
        const { error: dbError } = await supabase
            .from('assistant_templates')
            .upsert({
                account_id: profile.account_id,
                trade: trade,
                template_body: template_body,
                is_default: true,
                source: 'custom',
                updated_at: new Date().toISOString()
            }, { onConflict: 'account_id, trade, is_default' });

        if (dbError) throw new Error(`Database update failed: ${dbError.message}`);

        // 5. Sync to Vapi (if an assistant exists)
        if (account.vapi_assistant_id) {
            const vapiApiKey = Deno.env.get("VAPI_API_KEY");
            if (!vapiApiKey) throw new Error("VAPI_API_KEY not configured");

            // Construct Webhook URL
            const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
            const serverUrl = supabaseUrl
                ? `${supabaseUrl.replace(/\/$/, "")}/functions/v1/vapi-webhook`
                : undefined;

            // Patch the assistant
            const vapiRes = await fetch(`${VAPI_BASE_URL}/assistant/${account.vapi_assistant_id}`, {
                method: "PATCH",
                headers: {
                    "Authorization": `Bearer ${vapiApiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: {
                        messages: [
                            {
                                role: "system",
                                content: template_body
                            }
                        ]
                    },
                    serverUrl: serverUrl
                })
            });

            if (!vapiRes.ok) {
                const errText = await vapiRes.text();
                console.error("Vapi Sync Error:", errText);
                throw new Error(`Failed to sync with Vapi: ${vapiRes.statusText}`);
            }
        }

        return new Response(JSON.stringify({ success: true, synced_to_vapi: !!account.vapi_assistant_id }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Sync Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }
});
