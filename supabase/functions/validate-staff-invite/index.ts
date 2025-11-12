import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { hashToken, createAdminClient } from '../_shared/auth-utils.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface RequestBody {
  token: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createAdminClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { token }: RequestBody = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenHash = hashToken(token);

    // Fetch the token (without consuming it)
    const { data: tokenData, error: fetchError } = await supabase
      .from('auth_tokens')
      .select('*')
      .eq('token_hash', tokenHash)
      .eq('token_type', 'invite')
      .is('used_at', null)
      .single();

    if (fetchError || !tokenData) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Invalid or expired invitation' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check expiration
    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Invitation has expired' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return validation result with invite details
    return new Response(
      JSON.stringify({
        valid: true,
        email: tokenData.email,
        role: tokenData.meta?.role || 'staff'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in validate-staff-invite:', error);
    return new Response(
      JSON.stringify({ valid: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
