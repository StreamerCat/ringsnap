
import { createClient } from '@supabase/supabase-js';
import process from 'process';
import { readFileSync } from 'fs';

// Try to load env from various sources
function loadEnv() {
    const files = ['.env', '.env.local', '.env.test'];
    for (const file of files) {
        try {
            const content = readFileSync(file, 'utf8');
            content.split('\n').forEach(line => {
                if (!line || line.startsWith('#')) return;
                const [key, ...val] = line.split('=');
                if (key && val.length) {
                    const k = key.replace(/^export\s+/, '').trim();
                    const v = val.join('=').trim().replace(/^["']|["']$/g, '');
                    if (!process.env[k]) process.env[k] = v;
                }
            });
            console.log(`Loaded env from ${file}`);
        } catch (e) { }
    }
}

loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const TARGET_ACCOUNT_ID = '1a0c5a40-e391-44f6-baf0-ea2874fd9901';

async function run() {
    console.log(`Searching for failed jobs for account: ${TARGET_ACCOUNT_ID}`);

    // 1. Get the latest failed job
    const { data: jobs, error: fetchError } = await supabase
        .from('provisioning_jobs')
        .select('*')
        .eq('account_id', TARGET_ACCOUNT_ID)
        .order('created_at', { ascending: false })
        .limit(1);

    if (fetchError) {
        console.error("Error fetching jobs:", fetchError);
        return;
    }

    if (!jobs || jobs.length === 0) {
        console.log("No jobs found for this account.");
        return;
    }

    const job = jobs[0];
    console.log("Found job:", {
        id: job.id,
        status: job.status,
        attempts: job.attempts,
        metadata: job.metadata
    });

    // 2. Fix the metadata if needed
    let metadata = { ...job.metadata };
    if (metadata.fallback_phone) {
        const original = metadata.fallback_phone;
        // Strip non-digits
        let digits = original.replace(/\D/g, '');
        // If it's 11 digits starting with 1, strip the 1
        if (digits.length === 11 && digits[0] === '1') {
            digits = digits.slice(1);
        }

        if (digits !== original) {
            console.log(`Cleaning fallback_phone: ${original} -> ${digits}`);
            metadata.fallback_phone = digits;
        }
    }

    // 3. Reset the job
    console.log("Resetting job to queued state...");
    const { error: updateError } = await supabase
        .from('provisioning_jobs')
        .update({
            status: 'queued',
            attempts: 0,
            error_details: null,
            metadata: metadata,
            updated_at: new Date().toISOString()
        })
        .eq('id', job.id);

    if (updateError) {
        console.error("Error resetting job:", updateError);
        return;
    }

    console.log("Job reset successfully.");

    // 4. Trigger the edge function
    console.log("Triggering provision-vapi edge function...");
    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/provision-vapi`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify({ triggered_by: 'manual_retry_script' })
        });

        const result = await response.text();
        console.log("Edge function response:", result);
    } catch (e) {
        console.error("Error triggering edge function:", e);
    }
}

run();
