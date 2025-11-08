import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
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
  password: string;
  name: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createAdminClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { token, password, name }: RequestBody = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!password || password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 8 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!name || name.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ipAddress = getIpAddress(req);
    const userAgent = getUserAgent(req);

    // Validate and consume token
    const result = await validateAndConsumeToken(
      supabase,
      token,
      'invite'
    );

    if (!result.valid || !result.data) {
      await logAuthEvent(
        supabase,
        null,
        null,
        'staff_invite_invalid',
        { error: result.error },
        ipAddress,
        userAgent,
        false
      );

      return new Response(
        JSON.stringify({ error: result.error || 'Invalid or expired invitation' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = result.data;
    const email = tokenData.email;
    const role = tokenData.meta?.role;

    if (!role) {
      return new Response(
        JSON.stringify({ error: 'Invalid invitation data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;

      // Update password for existing user
      const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true
      });

      if (updateError) {
        console.error('Failed to update user password:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to set password' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update profile
      await supabase
        .from('profiles')
        .update({
          name: name.trim(),
          email_verified: true,
          requires_2fa: true // Staff requires 2FA
        })
        .eq('id', userId);

    } else {
      // Create new user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name: name.trim(),
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

      // Wait for profile creation trigger
      await new Promise(resolve => setTimeout(resolve, 500));

      // Update profile with name and 2FA requirement
      await supabase
        .from('profiles')
        .update({
          name: name.trim(),
          email_verified: true,
          requires_2fa: true // Staff requires 2FA
        })
        .eq('id', userId);
    }

    // Check if staff role already exists
    const { data: existingRole } = await supabase
      .from('staff_roles')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!existingRole) {
      // Create staff role
      const { error: roleError } = await supabase
        .from('staff_roles')
        .insert({
          user_id: userId,
          role,
          enforce_2fa: true
        });

      if (roleError) {
        console.error('Failed to create staff role:', roleError);
        return new Response(
          JSON.stringify({ error: 'Failed to assign staff role' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Create session
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.createSession({
      user_id: userId
    });

    if (sessionError || !sessionData) {
      console.error('Failed to create session:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Failed to create session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log successful invite acceptance
    await logAuthEvent(
      supabase,
      userId,
      null,
      'staff_invite_accepted',
      { email, role },
      ipAddress,
      userAgent,
      true
    );

    return new Response(
      JSON.stringify({
        success: true,
        session: sessionData.session,
        requires2FA: true,
        user: {
          id: userId,
          email,
          name: name.trim(),
          role
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in accept-staff-invite:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
