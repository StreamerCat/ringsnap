
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import "https://deno.land/x/dotenv/load.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const accountId = '1a0c5a40-e391-44f6-baf0-ea2874fd9901';

async function debugAccount() {
    console.log(`Checking status for account: ${accountId}`);

    // 1. Check Account
    const { data: account, error: accError } = await supabase
        .from('accounts')
        .select('id, company_name, phone_number_status, provisioning_status, vapi_phone_number_id, phone_number_e164')
        .eq('id', accountId)
        .single();

    if (accError) {
        console.error('Error fetching account:', accError);
        return;
    }
    console.log('Account Status:', account);

    // 2. Check Jobs
    const { data: jobs, error: jobsError } = await supabase
        .from('provisioning_jobs')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false });

    if (jobsError) {
        console.error('Error fetching jobs:', jobsError);
        return;
    }
    console.log('Provisioning Jobs:', jobs);

    // 3. Check Phone Numbers
    const { data: phones, error: phoneError } = await supabase
        .from('phone_numbers')
        .select('*')
        .eq('account_id', accountId);

    if (phoneError) {
        console.error('Error fetching phones:', phoneError);
    } else {
        console.log('Linked Phone Numbers:', phones);
    }
}

debugAccount();
