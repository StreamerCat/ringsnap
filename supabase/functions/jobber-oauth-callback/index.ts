import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

// For callback, we might return HTML or Redirect, so standard CORS might differ, 
// but usually callbacks are GET requests from the browser.

serve(async (req) => {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // account_id

    if (!code || !state) {
        return new Response("Missing code or state", { status: 400 });
    }

    try {
        const clientId = Deno.env.get('JOBBER_CLIENT_ID');
        const clientSecret = Deno.env.get('JOBBER_CLIENT_SECRET');
        const redirectUri = Deno.env.get('JOBBER_REDIRECT_URI');
        const appUrl = Deno.env.get('APP_URL') || 'http://localhost:3000'; // Fallback

        // Exchange Code
        const tokenParams = new URLSearchParams();
        tokenParams.append('client_id', clientId!);
        tokenParams.append('client_secret', clientSecret!);
        tokenParams.append('grant_type', 'authorization_code');
        tokenParams.append('code', code);
        tokenParams.append('redirect_uri', redirectUri!);

        const tokenRes = await fetch('https://api.getjobber.com/api/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: tokenParams
        });

        if (!tokenRes.ok) {
            const text = await tokenRes.text();
            throw new Error(`Failed to exchange token: ${text}`);
        }

        const tokenData = await tokenRes.json();
        // Expected: access_token, refresh_token, expires_in, etc.
        // Calculate expires_at
        const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();

        // Store in DB
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { error } = await supabase
            .from('jobber_connections')
            .upsert({
                account_id: state, // state was encoded as account_id
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token,
                expires_at: expiresAt,
                updated_at: new Date().toISOString()
            }, { onConflict: 'account_id' });

        if (error) throw error;

        // Redirect to Frontend
        return Response.redirect(`${appUrl}/settings/integrations/jobber?status=success`, 302);

    } catch (error) {
        console.error("OAuth Callback Error:", error);
        return new Response(`Error linking Jobber: ${error.message}`, { status: 500 });
    }
});
