import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { corsHeaders } from '../_shared/cors.ts';
import {
  validateAndConsumeToken,
  logAuthEvent,
  getIpAddress,
  getUserAgent,
  createAdminClient
} from '../_shared/auth-utils.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface RequestBody {
  token: string;
  deviceNonce?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createAdminClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { token, deviceNonce }: RequestBody = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ipAddress = getIpAddress(req);
    const userAgent = getUserAgent(req);

    // Validate and consume token
    const result = await validateAndConsumeToken(
      supabase,
      token,
      'magic_link',
      deviceNonce
    );

    if (!result.valid || !result.data) {
      await logAuthEvent(
        supabase,
        null,
        null,
        'magic_link_invalid',
        { error: result.error },
        ipAddress,
        userAgent,
        false
      );

      return new Response(
        JSON.stringify({ error: result.error || 'Invalid or expired magic link' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = result.data;
    const email = tokenData.email;

    // Check if user exists
    const { data: existingUser, error: userError } = await supabase
      .from('profiles')
      .select('id, account_id, email_verified')
      .eq('email', email)
      .single();

    let userId: string;
    let accountId: string | null = null;
    let isNewUser = false;

    if (userError || !existingUser) {
      // Create new user via Supabase Auth (passwordless)
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          email_verified: true
        }
      });

      if (authError || !authData.user) {
        console.error('Failed to create user:', authError);
        return new Response(
          JSON.stringify({ error: 'Failed to create user account' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userId = authData.user.id;
      isNewUser = true;

      // The trigger should create profile automatically, but let's verify
      await new Promise(resolve => setTimeout(resolve, 500));

    } else {
      userId = existingUser.id;
      accountId = existingUser.account_id;

      // Mark email as verified if not already
      if (!existingUser.email_verified) {
        await supabase
          .from('profiles')
          .update({ email_verified: true })
          .eq('id', userId);
      }
    }

    // Generate session for the user
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        data: {
          email_verified: true
        }
      }
    });

    if (sessionError || !sessionData) {
      console.error('Failed to generate session:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Failed to create session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract the session tokens from the generated link
    // The admin.generateLink returns properties with access_token and refresh_token
    const accessToken = sessionData.properties.access_token;
    const refreshToken = sessionData.properties.refresh_token;

    if (!accessToken || !refreshToken) {
      console.error('Session tokens missing from generated link');
      return new Response(
        JSON.stringify({ error: 'Failed to create session tokens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log successful login
    await logAuthEvent(
      supabase,
      userId,
      accountId,
      'magic_link_login',
      { email, is_new_user: isNewUser },
      ipAddress,
      userAgent,
      true
    );

    // Return session to client
    return new Response(
      JSON.stringify({
        success: true,
        isNewUser,
        session: {
          access_token: accessToken,
          refresh_token: refreshToken
        },
        user: {
          id: userId,
          email: email,
          accountId: accountId
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in verify-magic-link:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
