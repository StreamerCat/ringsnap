
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export async function trackEvent(
    supabase: any,
    accountId: string | null,
    userId: string | null,
    eventType: string,
    metadata: any = {}
): Promise<void> {
    // Best effort - if no account_id, we can't track generic events attached to an account
    if (!accountId) return;

    try {
        const { error } = await supabase.from("analytics_events").insert({
            account_id: accountId,
            user_id: userId,
            event_type: eventType,
            metadata: metadata,
        });

        if (error) {
            console.error(`[Analytics] Error tracking ${eventType}:`, error.message);
        }
    } catch (err) {
        console.error(`[Analytics] Exception tracking ${eventType}:`, err);
    }
}
