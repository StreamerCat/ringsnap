import { corsHeaders } from './cors.ts';

// Keep this helper free of runtime imports so authorization can be tested locally.
export interface StaffAuthClient {
  auth: {
    getUser(token: string): Promise<{
      data: { user: { id: string } | null };
      error: unknown;
    }>;
  };
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): PromiseLike<{ data: { role: string } | null; error: unknown }>;
      };
    };
  };
}

/** Verify a real user JWT and a current, server-owned staff role. Fail closed. */
export async function authorizePlatformStaff(
  req: Request,
  client: StaffAuthClient,
): Promise<Response | null> {
  const deny = (status: number) => new Response(
    JSON.stringify({ error: status === 401 ? 'Authentication required' : 'Platform staff access required' }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
  const match = req.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i);
  if (!match) return deny(401);

  try {
    // getUser verifies with Auth; decoding the JWT locally is insufficient.
    const { data, error } = await client.auth.getUser(match[1]);
    if (error || !data?.user) return deny(401);

    const { data: staff, error: roleError } = await client
      .from('staff_roles').select('role').eq('user_id', data.user.id).maybeSingle();
    if (roleError || !staff || !['platform_admin', 'platform_owner'].includes(staff.role)) {
      return deny(403);
    }
    return null;
  } catch {
    return deny(403);
  }
}
