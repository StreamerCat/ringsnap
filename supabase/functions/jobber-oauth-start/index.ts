import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

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
        const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!; // Use ANON key to verify user JWT
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Verify User
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('No Authorization header');

        const { data: { user }, error: userError } = await supabase.auth.getUser(
            authHeader.replace('Bearer ', '')
        );
        if (userError || !user) throw new Error('Invalid user');

        // Get Account ID (Assuming 1:1 or profile has it)
        const serviceSupabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const { data: profile } = await serviceSupabase
            .from('profiles')
            .select('account_id')
            .eq('id', user.id)
            .single();

        if (!profile?.account_id) throw new Error('No account found for user');

        const clientId = Deno.env.get('JOBBER_CLIENT_ID');
        const redirectUri = Deno.env.get('JOBBER_REDIRECT_URI') || 'http://localhost:54321/functions/v1/jobber-oauth-callback'; // Fallback for local
        const state = profile.account_id; // Simple state for now
        const scopes = 'read_clients write_clients read_requests write_requests read_jobs write_jobs';

        const url = `https://api.getjobber.com/api/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${encodeURIComponent(scopes)}&response_type=code`;

        return new Response(JSON.stringify({ url }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        console.error("OAuth Start Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
