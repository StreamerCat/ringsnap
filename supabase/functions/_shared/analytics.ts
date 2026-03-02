
import { createClient } from "supabase";

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
            // If it's a foreign key violation on user_id, try inserting with null user_id
            if (error.code === '23503' && error.message.includes('user_id')) {
                console.warn(`[Analytics] user_id ${userId} not found, falling back to null for ${eventType}`);
                const { error: retryError } = await supabase.from("analytics_events").insert({
                    account_id: accountId,
                    user_id: null,
                    event_type: eventType,
                    metadata: { ...metadata, original_user_id: userId },
                });
                if (retryError) {
                    console.error(`[Analytics] Retry fails:`, retryError.message);
                }
            } else {
                console.error(`[Analytics] Error tracking ${eventType}:`, error.message);
            }
        }
    } catch (err) {
        console.error(`[Analytics] Exception tracking ${eventType}:`, err);
    }
}
