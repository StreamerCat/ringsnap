/**
 * Supabase browser client shared across the RingSnap SPA.
 * Supports both legacy anon keys and new publishable keys.
 * Safe to load in the browser - never uses secret/service_role keys.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Prefer Vite-style envs (VITE_*) but also support NEXT_PUBLIC_* for compatibility
const env = import.meta.env as Record<string, string | undefined>;

// URL must always be the project URL
export const supabaseUrl =
  env.VITE_SUPABASE_URL ??
  env.NEXT_PUBLIC_SUPABASE_URL;

// KEY: prefer new publishable key, then legacy anon variants
export const supabaseKey =
  env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  env.VITE_SUPABASE_ANON_KEY ??
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Export configuration status for components to optionally branch on
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

if (!isSupabaseConfigured) {
  console.error(
    "Supabase environment variables are not configured correctly. " +
    "Expected VITE_SUPABASE_URL and either VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY. " +
    "(NEXT_PUBLIC_* variants are also supported for compatibility.)"
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
 *   - VITE_SUPABASE_PUBLISHABLE_KEY (or legacy VITE_SUPABASE_ANON_KEY)
 */
export const supabase = createClient<Database>(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseKey || "sb-placeholder-key",
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
