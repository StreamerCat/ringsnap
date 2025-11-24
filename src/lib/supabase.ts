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

if (!isSupabaseConfigured) {
  console.error(
    "❌ Supabase environment variables are not configured!\n" +
    "Required variables:\n" +
    "  - VITE_SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)\n" +
    "  - VITE_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)\n" +
    "Current values:\n" +
    `  - supabaseUrl: ${supabaseUrl || 'undefined'}\n` +
    `  - supabaseAnonKey: ${supabaseAnonKey ? '[REDACTED - exists]' : 'undefined'}`
  );
}

const storage = typeof window === "undefined" ? undefined : window.localStorage;

// Create client with valid values or safe fallbacks
// Note: Fallback values will cause API calls to fail, but won't crash during initialization
export const supabase = createClient<Database>(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MTY3MjMyMDAsImV4cCI6MTk2NzI5OTIwMH0.placeholder",
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
