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

    // Get requester's profile and account
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if requester is account owner
    const { data: requesterRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'owner')
      .single();

    if (!requesterRole) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Account owner access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, email, name, phone, role } = await req.json();

    if (action === 'invite') {
      // Create auth user and profile
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          name,
          phone,
          company_name: profile.account_id
        }
      });

      if (createError) throw createError;

      // Profile should be auto-created by trigger, but let's ensure role is set
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({
          user_id: newUser.user.id,
          role: role || 'user'
        });

      if (roleError) throw roleError;

      // Log the change
      await supabase
        .from('role_change_audit')
        .insert({
          changed_by_user_id: user.id,
          target_user_id: newUser.user.id,
          old_role: null,
          new_role: role || 'user',
          change_type: 'added',
          context: 'customer_team',
          account_id: profile.account_id
        });

      return new Response(
        JSON.stringify({ success: true, user_id: newUser.user.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (action === 'update_role') {
      const { target_user_id, new_role } = await req.json();

      // Verify target user is in same account
      const { data: targetProfile } = await supabase
        .from('profiles')
        .select('account_id')
        .eq('id', target_user_id)
        .single();

      if (!targetProfile || targetProfile.account_id !== profile.account_id) {
        return new Response(
          JSON.stringify({ error: 'User not in your account' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get old role
      const { data: oldRoleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', target_user_id)
        .single();

      // Update role
      const { error: updateError } = await supabase
        .from('user_roles')
        .upsert({
          user_id: target_user_id,
          role: new_role
        });

      if (updateError) throw updateError;

      // Log the change
      await supabase
        .from('role_change_audit')
        .insert({
          changed_by_user_id: user.id,
          target_user_id,
          old_role: oldRoleData?.role || null,
          new_role,
          change_type: 'updated',
          context: 'customer_team',
          account_id: profile.account_id
        });

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error managing team member:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
