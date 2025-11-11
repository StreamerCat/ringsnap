/**
 * Supabase browser client shared across the RingSnap SPA.
 * Uses the public anon key so it is safe to load in the browser.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const env = import.meta.env as Record<string, string | undefined>;
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase environment variables are not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
}

const storage = typeof window === "undefined" ? undefined : window.localStorage;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    persistSession: storage !== undefined,
    autoRefreshToken: true,
  },
});

export default supabase;
