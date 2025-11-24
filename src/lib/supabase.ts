/**
 * Supabase browser client shared across the RingSnap SPA.
 * Uses the public anon key so it is safe to load in the browser.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const env = import.meta.env as Record<string, string | undefined>;
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const supabaseAnonKey =
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  env.VITE_SUPABASE_ANON_KEY;

// Export configuration status for components to check
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Runtime guard: throw error if anon key is missing in production
if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg =
    "❌ CRITICAL: Supabase environment variables are not configured!\n" +
    "Required variables:\n" +
    "  - VITE_SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)\n" +
    "  - VITE_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)\n" +
    "Current values:\n" +
    `  - supabaseUrl: ${supabaseUrl || 'undefined'}\n` +
    `  - supabaseAnonKey: ${supabaseAnonKey ? '[REDACTED - exists]' : 'undefined'}\n\n` +
    "Edge function calls will fail with 401 errors if anon key is not provided.";

  console.error(errorMsg);

  // Throw error to prevent initialization with invalid credentials
  // This ensures the issue is caught early rather than silent failures
  throw new Error(
    "Supabase client cannot be initialized: Missing required environment variables. " +
    "Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your deployment environment."
  );
}

const storage = typeof window === "undefined" ? undefined : window.localStorage;

// Create client with valid values (no fallbacks)
// If we reach here, both supabaseUrl and supabaseAnonKey are guaranteed to exist
export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage,
      persistSession: storage !== undefined,
      autoRefreshToken: true,
      flowType: 'pkce',
    },
  }
);

export default supabase;
