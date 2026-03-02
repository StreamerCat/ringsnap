import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?target=deno";
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

    // Try to create user first (optimistic approach - saves credits)
    const tempPassword = Math.random().toString(36).slice(-12) + 'A1!';
    let userId: string;
    let isNewUser = false;

    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { name }
    });

    if (createError) {
      // Check if user already exists
      if (createError.message.includes('already registered')) {
        // Fetch only this specific user (targeted query)
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(u => u.email === email);

        if (!existingUser) {
          throw new Error('User exists but could not be found');
        }

        userId = existingUser.id;
        console.log(`User ${email} already exists, updating role`);
      } else {
        throw createError;
      }
    } else {
      userId = newUser.user.id;
      isNewUser = true;
      console.log(`Created new user ${email}`);
    }

    // Create or update staff role
    const { error: roleError } = await supabase
      .from('staff_roles')
      .upsert({
        user_id: userId,
        role
      }, {
        onConflict: 'user_id'
      });

    if (roleError) throw roleError;

    // Create or update profile (no account_id for staff)
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        name,
        phone: '',
        account_id: null
      }, {
        onConflict: 'id'
      });

    if (profileError) throw profileError;

    // Log the change
    await supabase
      .from('role_audit_log')
      .insert({
        target_user_id: userId,
        changed_by_user_id: user.id,
        change_type: 'staff',
        old_role: null,
        new_role: role
      });

    // Only send password reset for newly created users (saves email credits)
    if (isNewUser) {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {});
        if (error) throw error;
        console.log(`Password reset email sent to ${email}`);
      } catch (emailError) {
        console.error('Error sending password reset email:', emailError);
        // Don't fail the whole request if email fails
      }
    }

    return new Response(
      JSON.stringify({ success: true, user_id: userId }),
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
