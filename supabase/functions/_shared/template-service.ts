
import { SupabaseClient } from "supabase";

/**
 * Get the effective template for an account and trade.
 * Prioritizes default template.
 */
export async function getAccountTemplate(
    supabase: SupabaseClient,
    accountId: string,
    trade: string
): Promise<string | null> {
    const { data, error } = await supabase
        .rpc('get_account_template', {
            _account_id: accountId,
            _trade: trade
        });

    if (error) {
        console.warn('Error fetching account template via RPC, falling back to query', error);
        // Fallback if RPC not yet available (migration race condition)
        const { data: qData, error: qError } = await supabase
            .from('assistant_templates')
            .select('template_body, is_default')
            .eq('account_id', accountId)
            .eq('trade', trade)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (qError) {
            console.error('Error fetching account template via query:', qError);
            return null;
        }
        return qData?.template_body || null;
    }
    return data;
}

/**
 * Upsert a template for an account.
 */
export async function upsertAccountTemplate(
    supabase: SupabaseClient,
    accountId: string,
    trade: string,
    templateBody: string,
    source: 'system_generated' | 'custom' = 'system_generated',
    isDefault: boolean = true
): Promise<void> {
    const { error } = await supabase
        .from('assistant_templates')
        .upsert({
            account_id: accountId,
            trade: trade,
            template_body: templateBody,
            source: source,
            is_default: isDefault
        }, {
            onConflict: 'account_id, trade, is_default'
        });

    if (error) {
        console.error('Error upserting account template:', error);
        throw error;
    }
}
