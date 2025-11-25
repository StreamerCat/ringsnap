/**
 * Supabase browser client shared across the RingSnap SPA.
 * Supports both legacy anon keys and new publishable keys.
 * Safe to load in the browser - never uses secret/service_role keys.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const env = import.meta.env as Record<string, string | undefined>;

// URL resolution: prefer VITE_ prefix, fallback to NEXT_PUBLIC_
const supabaseUrl = env.VITE_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;

// Key resolution: prefer new publishable key format, fallback to legacy anon keys
// This supports both old (anon) and new (publishable sb_publishable_...) key formats
const supabaseKey =
  env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  env.VITE_SUPABASE_ANON_KEY ??
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Export configuration status for components to check
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

if (!isSupabaseConfigured) {
  console.error(
    "❌ Supabase environment variables are not configured!\n" +
    "Required variables:\n" +
    "  - VITE_SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)\n" +
    "  - VITE_SUPABASE_PUBLISHABLE_KEY (preferred) or VITE_SUPABASE_ANON_KEY (legacy)\n" +
    "    (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY)\n" +
    "Current values:\n" +
    `  - supabaseUrl: ${supabaseUrl || 'undefined'}\n` +
    `  - supabaseKey: ${supabaseKey ? '[REDACTED - exists]' : 'undefined'}`
  );
}

const storage = typeof window === "undefined" ? undefined : window.localStorage;

// Create client with valid values or safe fallbacks
// Note: Fallback values will cause API calls to fail, but won't crash during initialization
export const supabase = createClient<Database>(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MTY3MjMyMDAsImV4cCI6MTk2NzI5OTIwMH0.placeholder",
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
