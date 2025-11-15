interface EnvLookupResult {
  value?: string;
  source?: string;
}

function lookupEnv(...keys: string[]): EnvLookupResult {
  for (const key of keys) {
    const value = Deno.env.get(key);
    if (value) {
      return { value, source: key };
    }
  }
  return { value: undefined, source: undefined };
}

export function getSupabaseUrl(): EnvLookupResult {
  return lookupEnv('SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
}

export function getSupabaseServiceRoleKey(): EnvLookupResult {
  return lookupEnv('SUPABASE_SERVICE_ROLE_KEY', 'SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY');
}

export function getResendApiKey(): EnvLookupResult {
  return lookupEnv('RESEND_PROD_KEY', 'RESEND_API_KEY', 'RESEND_KEY');
}
