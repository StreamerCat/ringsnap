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

    const { target_user_id, new_role, action } = await req.json();

    // Validate input
    const validRoles = ['platform_owner', 'platform_admin', 'support', 'viewer'];
    if (!target_user_id || (action !== 'remove' && !validRoles.includes(new_role))) {
      return new Response(
        JSON.stringify({ error: 'Invalid input' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get old role
    const { data: oldRoleData } = await supabase
      .from('staff_roles')
      .select('role')
      .eq('user_id', target_user_id)
      .single();

    let result;
    let changeType;

    if (action === 'remove') {
      // Remove role
      const { error: deleteError } = await supabase
        .from('staff_roles')
        .delete()
        .eq('user_id', target_user_id);

      if (deleteError) throw deleteError;
      changeType = 'removed';
      result = { success: true };
    } else if (oldRoleData) {
      // Update existing role
      const { error: updateError } = await supabase
        .from('staff_roles')
        .update({ role: new_role })
        .eq('user_id', target_user_id);

      if (updateError) throw updateError;
      changeType = 'updated';
      result = { success: true };
    } else {
      // Insert new role
      const { error: insertError } = await supabase
        .from('staff_roles')
        .insert({ user_id: target_user_id, role: new_role });

      if (insertError) throw insertError;
      changeType = 'added';
      result = { success: true };
    }

    // Log the change
    await supabase
      .from('role_audit_log')
      .insert({
        user_id: target_user_id,
        changed_by: user.id,
        role_type: 'staff',
        old_role: oldRoleData?.role || null,
        new_role: action === 'remove' ? null : new_role
      });

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error managing staff role:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
