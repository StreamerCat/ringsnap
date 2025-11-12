import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { randomBytes } from 'node:crypto';
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
    console.log('[verify-magic-link] Starting verification', {
      hasUrl: !!SUPABASE_URL,
      hasKey: !!SUPABASE_SERVICE_ROLE_KEY,
      urlPrefix: SUPABASE_URL?.substring(0, 8)
    });

    const supabase = createAdminClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { token, deviceNonce }: RequestBody = await req.json();

    console.log('[verify-magic-link] Request data', {
      hasToken: !!token,
      tokenPrefix: token?.substring(0, 10),
      hasDeviceNonce: !!deviceNonce,
      deviceNoncePrefix: deviceNonce?.substring(0, 10)
    });

    if (!token) {
      console.error('[verify-magic-link] No token provided');
      return new Response(
        JSON.stringify({ error: 'Token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ipAddress = getIpAddress(req);
    const userAgent = getUserAgent(req);

    // Validate and consume token
    console.log('[verify-magic-link] Validating token...');
    const result = await validateAndConsumeToken(
      supabase,
      token,
      'magic_link',
      deviceNonce
    );

    console.log('[verify-magic-link] Validation result', {
      valid: result.valid,
      hasData: !!result.data,
      error: result.error
    });

    if (!result.valid || !result.data) {
      console.error('[verify-magic-link] Token validation failed', { error: result.error });
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

    console.log('[verify-magic-link] Token valid, checking user', { email });

    // Check if auth user exists via admin lookup
    const { data: usersData, error: authLookupError } = await supabase.auth.admin.listUsers();

    if (authLookupError) {
      console.error('[verify-magic-link] Failed to lookup auth users', authLookupError);
      return new Response(
        JSON.stringify({
          error: 'Failed to verify user account',
          details: authLookupError.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const existingAuthUser = usersData?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    ) ?? null;

    console.log('[verify-magic-link] Auth lookup result', {
      found: !!existingAuthUser
    });

    let userId: string;
    let accountId: string | null = null;
    let isNewUser = false;

    if (!existingAuthUser) {
      // Create new user via Supabase Auth (passwordless)
      console.log('[verify-magic-link] Creating new user for email:', email);
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          email_verified: true
        }
      });

      if (authError || !authData.user) {
        console.error('[verify-magic-link] Failed to create user:', authError);
        return new Response(
          JSON.stringify({
            error: 'Failed to create user account',
            details: authError?.message
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userId = authData.user.id;
      isNewUser = true;
      console.log('[verify-magic-link] New user created:', userId);

      // The trigger should create profile automatically, but let's verify
      await new Promise(resolve => setTimeout(resolve, 500));

    } else {
      userId = existingAuthUser.id;

      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, account_id, email_verified')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.warn('[verify-magic-link] Failed to fetch profile for existing user', {
          userId,
          error: profileError.message,
          errorCode: profileError.code
        });
      }

      accountId = existingProfile?.account_id ?? null;
      console.log('[verify-magic-link] Existing user found:', { userId, accountId });

      // Mark email as verified if not already
      if (existingProfile && !existingProfile.email_verified) {
        await supabase
          .from('profiles')
          .update({ email_verified: true })
          .eq('id', userId);
        console.log('[verify-magic-link] Marked email as verified');
      }
    }

    // Generate a temporary password to create a session
    console.log('[verify-magic-link] Creating session for user:', userId);
    const tempPassword = randomBytes(32).toString('base64url');

    const { error: setPasswordError } = await supabase.auth.admin.updateUserById(userId, {
      password: tempPassword
    });

    if (setPasswordError) {
      console.error('[verify-magic-link] Failed to set temporary password:', setPasswordError);
      return new Response(
        JSON.stringify({
          error: 'Failed to create session',
          details: setPasswordError.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
      email,
      password: tempPassword
    });

    if (sessionError || !sessionData.session) {
      console.error('[verify-magic-link] Failed to create session:', sessionError);
      return new Response(
        JSON.stringify({
          error: 'Failed to create session',
          details: sessionError?.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = sessionData.session.access_token;
    const refreshToken = sessionData.session.refresh_token;

    console.log('[verify-magic-link] Session generated successfully');

    setTimeout(async () => {
      const newRandomPassword = randomBytes(32).toString('base64url');
      await supabase.auth.admin.updateUserById(userId, { password: newRandomPassword });
    }, 100);

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
    console.error('[verify-magic-link] Uncaught error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
