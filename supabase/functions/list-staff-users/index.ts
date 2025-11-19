import { createClient } from "@supabase/supabase-js";
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

    // Get all staff roles with user info
    const { data: staffRoles, error: rolesError } = await supabase
      .from('staff_roles')
      .select('user_id, role, created_at');

    if (rolesError) throw rolesError;

    // Get auth users using admin API
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) throw usersError;

    // Get profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name, phone');

    if (profilesError) throw profilesError;

    // Combine the data
    const staffUsers = staffRoles?.map(sr => {
      const authUser = users.find(u => u.id === sr.user_id);
      const profile = profiles?.find(p => p.id === sr.user_id);
      
      return {
        id: sr.user_id,
        email: authUser?.email || '',
        role: sr.role,
        name: profile?.name || '',
        phone: profile?.phone || '',
        created_at: authUser?.created_at || sr.created_at
      };
    }) || [];

    return new Response(
      JSON.stringify({ users: staffUsers }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error listing staff users:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
