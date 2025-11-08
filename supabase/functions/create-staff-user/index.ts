import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get current user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if requester is platform owner
    const { data: requesterRole } = await supabase
      .from('staff_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'platform_owner')
      .single();

    if (!requesterRole) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Platform owner access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, name, role } = await req.json();

    // Validate input
    const validRoles = ['platform_owner', 'platform_admin', 'support', 'viewer', 'sales'];
    if (!email || !name || !validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Invalid input - email, name, and valid role required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-12) + 'A1!';

    // Create new user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { name }
    });

    if (createError) throw createError;

    // Create staff role
    const { error: roleError } = await supabase
      .from('staff_roles')
      .insert({
        user_id: newUser.user.id,
        role
      });

    if (roleError) throw roleError;

    // Create profile (no account_id for staff)
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: newUser.user.id,
        name,
        phone: '',
        account_id: null
      });

    if (profileError) throw profileError;

    // Log the change
    await supabase
      .from('role_audit_log')
      .insert({
        target_user_id: newUser.user.id,
        changed_by_user_id: user.id,
        change_type: 'staff',
        old_role: null,
        new_role: role
      });

    // Send password reset email via edge function
    try {
      await supabase.functions.invoke('send-password-reset', {
        body: { email }
      });
      console.log(`Password reset email sent to ${email}`);
    } catch (emailError) {
      console.error('Error sending password reset email:', emailError);
      // Don't fail the whole request if email fails
    }

    return new Response(
      JSON.stringify({ success: true, user_id: newUser.user.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating staff user:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
