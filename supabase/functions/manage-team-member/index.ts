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

    // Get user's account and verify owner role
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('id', user.id)
      .single();

    if (!profile?.account_id) {
      return new Response(
        JSON.stringify({ error: 'User not associated with an account' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: ownerCheck } = await supabase
      .from('account_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('account_id', profile.account_id)
      .eq('role', 'owner')
      .single();

    if (!ownerCheck) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Account owner access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, email, name, phone, new_role, target_user_id } = await req.json();

    if (action === 'invite') {
      // Create new user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { name, phone }
      });

      if (createError) throw createError;

      // Create profile
      await supabase
        .from('profiles')
        .insert({
          id: newUser.user.id,
          account_id: profile.account_id,
          name,
          phone,
          is_primary: false
        });

      // Create account member role
      await supabase
        .from('account_members')
        .insert({
          user_id: newUser.user.id,
          account_id: profile.account_id,
          role: new_role || 'member'
        });

      // Log the change
      await supabase
        .from('role_audit_log')
        .insert({
          user_id: newUser.user.id,
          changed_by: user.id,
          role_type: 'account',
          old_role: null,
          new_role: new_role || 'member',
          account_id: profile.account_id
        });

      return new Response(
        JSON.stringify({ success: true, user_id: newUser.user.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (action === 'update_role') {
      // Verify target user is in same account
      const { data: targetProfile } = await supabase
        .from('profiles')
        .select('account_id')
        .eq('id', target_user_id)
        .single();

      if (targetProfile?.account_id !== profile.account_id) {
        return new Response(
          JSON.stringify({ error: 'Target user not in same account' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get old role
      const { data: oldRoleData } = await supabase
        .from('account_members')
        .select('role')
        .eq('user_id', target_user_id)
        .eq('account_id', profile.account_id)
        .single();

      // Update role
      const { error: updateError } = await supabase
        .from('account_members')
        .update({ role: new_role })
        .eq('user_id', target_user_id)
        .eq('account_id', profile.account_id);

      if (updateError) throw updateError;

      // Log the change
      await supabase
        .from('role_audit_log')
        .insert({
          user_id: target_user_id,
          changed_by: user.id,
          role_type: 'account',
          old_role: oldRoleData?.role || null,
          new_role,
          account_id: profile.account_id
        });

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error managing team member:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
