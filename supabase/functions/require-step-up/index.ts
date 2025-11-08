import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import {
  requiresStepUp,
  updateStepUpTimestamp,
  logAuthEvent,
  getIpAddress,
  getUserAgent,
  createAdminClient
} from '../_shared/auth-utils.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface RequestBody {
  password?: string;
  totpCode?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createAdminClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get the authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { password, totpCode }: RequestBody = await req.json();
    const ipAddress = getIpAddress(req);
    const userAgent = getUserAgent(req);

    // Check if step-up is actually required
    const needsStepUp = await requiresStepUp(supabase, user.id, 15);

    if (!needsStepUp) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Step-up not required',
          stepUpValid: true
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, totp_enabled, requires_2fa')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify with password
    if (password) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password
      });

      if (signInError) {
        await logAuthEvent(
          supabase,
          user.id,
          null,
          'step_up_failed',
          { method: 'password', error: 'Invalid password' },
          ipAddress,
          userAgent,
          false
        );

        return new Response(
          JSON.stringify({ error: 'Invalid password' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // If 2FA is required and enabled, also need TOTP
      if (profile.requires_2fa && profile.totp_enabled && !totpCode) {
        return new Response(
          JSON.stringify({
            success: false,
            requires2FA: true,
            message: '2FA code required'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Verify TOTP if provided
    if (totpCode) {
      // In production, use a proper TOTP library like otpauth
      // For now, this is a placeholder
      const isValid = totpCode.length === 6 && /^\d+$/.test(totpCode);

      if (!isValid) {
        await logAuthEvent(
          supabase,
          user.id,
          null,
          'step_up_failed',
          { method: '2fa', error: 'Invalid TOTP code' },
          ipAddress,
          userAgent,
          false
        );

        return new Response(
          JSON.stringify({ error: 'Invalid 2FA code' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Require at least one verification method
    if (!password && !totpCode) {
      return new Response(
        JSON.stringify({ error: 'Password or 2FA code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update step-up timestamp
    await updateStepUpTimestamp(supabase, user.id);

    // Log successful step-up
    await logAuthEvent(
      supabase,
      user.id,
      null,
      'step_up_completed',
      { method: password ? 'password' : '2fa' },
      ipAddress,
      userAgent,
      true
    );

    return new Response(
      JSON.stringify({
        success: true,
        stepUpValid: true,
        message: 'Step-up authentication completed'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in require-step-up:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
