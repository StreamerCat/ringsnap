/**
 * Helper for signing a user out of Supabase and logging any errors.
 */
import { supabase } from "@/lib/supabase";

export async function signOutUser(): Promise<void> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  } catch (error) {
    console.error("Supabase sign out failed:", error);
    throw error;
  }
}
