/**
 * Supabase browser client shared across the RingSnap SPA.
 * Uses the public anon key so it is safe to load in the browser.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Prefer Vite-style envs (VITE_*) but also support NEXT_PUBLIC_* for compatibility
const env = import.meta.env as Record<string, string | undefined>;

const supabaseUrl =
  env.VITE_SUPABASE_URL ??
  env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseAnonKey =
  env.VITE_SUPABASE_ANON_KEY ??
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Export configuration status for components to optionally branch on
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.error(
    "❌ Supabase environment variables are not configured correctly!\n" +
      "Required variables (one of each pair must be set):\n" +
      "  - VITE_SUPABASE_URL           or NEXT_PUBLIC_SUPABASE_URL\n" +
      "  - VITE_SUPABASE_ANON_KEY      or NEXT_PUBLIC_SUPABASE_ANON_KEY\n" +
      "Current values:\n" +
      `  - supabaseUrl: ${supabaseUrl || "undefined"}\n` +
      `  - supabaseAnonKey: ${
        supabaseAnonKey ? "[REDACTED - exists]" : "undefined"
      }`
  );
}

// Use localStorage only in the browser
const storage =
  typeof window === "undefined" ? undefined : window.localStorage;

/**
 * Create the Supabase client.
 *
 * Note:
 * - If env vars are missing, we fall back to placeholders so the app can still
 *   render without crashing. API calls will fail against the placeholder URL/key,
 *   but the error will be clear in the console.
 * - In staging/production you should always set the real values:
 *   - VITE_SUPABASE_URL
 *   - VITE_SUPABASE_ANON_KEY
 */
export const supabase = createClient<Database>(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MTY3MjMyMDAsImV4cCI6MTk2NzI5OTIwMH0.placeholder",
  {
    auth: {
      storage,
      persistSession: storage !== undefined,
      autoRefreshToken: true,
      flowType: "pkce",
    },
  }
);

export default supabase;
