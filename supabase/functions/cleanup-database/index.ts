import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const keepUserId = '9bb89fc3-926f-4ce4-9f85-19a6269a0c85';
    const results: any = {
      step1_current_users: null,
      step2_users_to_delete: null,
      step3_cleanup: {
        role_audit_log: null,
        staff_roles: null,
        profiles: null,
        auth_users: null
      },
      step4_verify_role: null,
      step5_final_counts: null
    };

    // Step 1: Check current state
    const { data: currentUsers } = await supabase.auth.admin.listUsers();
    results.step1_current_users = currentUsers?.users.map(u => ({ id: u.id, email: u.email }));

    // Step 2: Users to delete
    results.step2_users_to_delete = currentUsers?.users
      .filter(u => u.id !== keepUserId)
      .map(u => ({ id: u.id, email: u.email }));

    // Step 3: Cleanup
    // Delete role audit logs
    const { error: auditError, count: auditCount } = await supabase
      .from('role_audit_log')
      .delete({ count: 'exact' })
      .neq('target_user_id', keepUserId);
    results.step3_cleanup.role_audit_log = { deleted: auditCount, error: auditError?.message };

    // Delete staff roles
    const { error: staffError, count: staffCount } = await supabase
      .from('staff_roles')
      .delete({ count: 'exact' })
      .neq('user_id', keepUserId);
    results.step3_cleanup.staff_roles = { deleted: staffCount, error: staffError?.message };

    // Delete profiles
    const { error: profileError, count: profileCount } = await supabase
      .from('profiles')
      .delete({ count: 'exact' })
      .neq('id', keepUserId);
    results.step3_cleanup.profiles = { deleted: profileCount, error: profileError?.message };

    // Delete auth users
    const usersToDelete = currentUsers?.users.filter(u => u.id !== keepUserId) || [];
    const authDeleteResults = [];
    for (const user of usersToDelete) {
      const { error } = await supabase.auth.admin.deleteUser(user.id);
      authDeleteResults.push({
        user_id: user.id,
        email: user.email,
        success: !error,
        error: error?.message
      });
    }
    results.step3_cleanup.auth_users = authDeleteResults;

    // Step 4: Ensure correct role
    const { error: roleUpsertError } = await supabase
      .from('staff_roles')
      .upsert({
        user_id: keepUserId,
        role: 'platform_owner'
      }, {
        onConflict: 'user_id'
      });

    const { error: profileUpsertError } = await supabase
      .from('profiles')
      .upsert({
        id: keepUserId,
        name: 'Josh',
        email: 'josh@launchedgepro.com',
        phone: '',
        account_id: null
      }, {
        onConflict: 'id'
      });

    results.step4_verify_role = {
      staff_role_upsert: roleUpsertError?.message || 'success',
      profile_upsert: profileUpsertError?.message || 'success'
    };

    // Step 5: Final verification
    const { data: finalUsers } = await supabase.auth.admin.listUsers();
    const { count: staffCount2 } = await supabase.from('staff_roles').select('*', { count: 'exact', head: true });
    const { count: profileCount2 } = await supabase.from('profiles').select('*', { count: 'exact', head: true });

    results.step5_final_counts = {
      total_users: finalUsers?.users.length || 0,
      total_staff_roles: staffCount2,
      total_profiles: profileCount2,
      remaining_user: finalUsers?.users[0]?.email
    };

    return new Response(
      JSON.stringify({ success: true, results }, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error during cleanup:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage, stack: error instanceof Error ? error.stack : undefined }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
