import { createClient } from '@supabase/supabase-js';
import process from 'process';
import { readFileSync } from 'fs';

// Load .env manually
try {
    const envFile = readFileSync('.env', 'utf8');
    envFile.split('\n').forEach(line => {
        // Skip comments and empty lines
        if (!line || line.startsWith('#')) return;
        const parts = line.split('=');
        if (parts.length >= 2) {
            // Remove 'export' prefix if present and trim
            const key = parts[0].replace(/^export\s+/, '').trim();
            const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, ''); // Remove quotes
            if (!process.env[key]) process.env[key] = val;
        }
    });
    console.log("Loaded local .env file");
} catch (e) {
    console.warn("Could not read .env file, relying on system env vars.");
}

async function main() {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
        process.exit(1);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log("Fetching legacy active numbers...");
    const { data: legacyActive, error } = await supabase
        .from('phone_numbers')
        .select('id, account_id, status, lifecycle_status')
        .eq('status', 'active')
        .is('lifecycle_status', null)
        .not('account_id', 'is', null);

    if (error) {
        console.error("Error fetching numbers:", error);
        process.exit(1);
    }

    console.log(`Found ${legacyActive?.length || 0} numbers to backfill.`);
    let updated = 0;
    let errors = 0;

    if (legacyActive) {
        for (const phone of legacyActive) {
            const { error: updateError } = await supabase
                .from('phone_numbers')
                .update({
                    lifecycle_status: 'assigned',
                    assigned_account_id: phone.account_id,
                    assigned_at: new Date().toISOString()
                })
                .eq('id', phone.id);

            if (updateError) {
                console.error(`Failed to update ${phone.id}:`, updateError.message);
                errors++;
            } else {
                updated++;
                console.log(`Updated number ${phone.id} to assigned.`);
            }
        }
    }

    console.log(`\nDone. Updated: ${updated}, Errors: ${errors}`);
}

main().catch(err => console.error(err));
