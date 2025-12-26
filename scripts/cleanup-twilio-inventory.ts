
import 'dotenv/config';
import twilio from 'twilio';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Load env vars
import dotenv from 'dotenv';
const envPath = path.resolve(process.cwd(), '.env');

// Manual parser fallback (robustness)
if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            let value = match[2].trim();
            if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
            if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);

            // Set if not set
            if (!process.env[key]) {
                process.env[key] = value;
            }
        }
    });
    console.log('Manually parsed keys:', content.split('\n').map(l => l.split('=')[0].trim()).filter(k => k && !k.startsWith('#')));
    console.log('Manually parsed .env from:', envPath);
} else {
    // try dotenv as backup or just log
    dotenv.config();
}

// Configuration
const PROTECTED_NUMBERS = [
    '+19704231415',
    '+19705168481'
];

const PROTECTED_ASSISTANTS = [
    '2bb27d02-b686-4844-8534-6dfe9be5a077',
    'db066c6c-e2e3-424e-9fd1-1473f2ac3b01',
    'aae32b19-9ea0-4b31-b6f4-b98db79f5645',
    '4c7fc900-30b3-4880-9f2a-9ba4ce6633de'
];

const POOL_LIMIT = 10;
const VAPI_BASE_URL = 'https://api.vapi.ai';

// Types
type Action = 'KEEP_PROTECTED' | 'KEEP_ACTIVE' | 'CONFLICT' | 'POOL' | 'RELEASE';
type ReportItem = {
    phoneNumber: string;
    twilioSid: string;
    action: Action;
    reason?: string;
    accountId?: string;
    assistantId?: string;
    currentVapiId?: string;
};

// Main
async function main() {
    const modeArg = process.argv.find(arg => arg.startsWith('--mode='));
    const allowlistArg = process.argv.find(arg => arg.startsWith('--allowlist='));

    const mode = modeArg ? modeArg.split('=')[1] : 'dry-run';
    const allowlistPath = allowlistArg ? allowlistArg.split('=')[1] : null;

    if (mode === 'execute' && !allowlistPath) {
        console.error('Error: --allowlist is required for execute mode');
        process.exit(1);
    }

    console.log(`Running in ${mode} mode...`);

    // Clients
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    console.log('Debug Env:');
    console.log('CWD:', process.cwd());
    console.log('SUPABASE_URL present:', !!supabaseUrl);
    console.log('SUPABASE_KEY present:', !!supabaseKey);
    console.log('TWILIO_SID present:', !!process.env.TWILIO_ACCOUNT_SID);

    if (!supabaseUrl || !supabaseKey) {
        console.error('Error: Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
        // Try to load explicitly from root if not found
        const rootEnvPath = path.resolve(process.cwd(), '.env');
        console.log('Trying to load from:', rootEnvPath);
        // process.exit(1); 
    }

    const supabase = createClient(supabaseUrl!, supabaseKey!);
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const vapiKey = process.env.VAPI_PRIVATE_API_KEY || process.env.VAPI_API_KEY;

    const missingKeys = [];
    if (!twilioAccountSid) missingKeys.push('TWILIO_ACCOUNT_SID');
    if (!twilioAuthToken) missingKeys.push('TWILIO_AUTH_TOKEN');
    // if (!vapiKey) missingKeys.push('VAPI_PRIVATE_API_KEY (or VAPI_API_KEY)'); 
    // Vapi key is optional for list fetch but needed for cleanup. Active/Protected checks don't need it.
    // But Conflict check needs it.
    if (!vapiKey) console.warn('Warning: VAPI_API_KEY missing. Conflict checks will fail or be skipped.');

    if (missingKeys.length > 0) {
        console.error('Error: Missing required env vars:', missingKeys.join(', '));
        process.exit(1);
    }

    const twilioClient = twilio(twilioAccountSid, twilioAuthToken);

    // 1. Fetch Twilio Numbers
    console.log('Fetching Twilio numbers...');
    const twilioNumbers = await twilioClient.incomingPhoneNumbers.list({ limit: 1000 });
    console.log(`Found ${twilioNumbers.length} numbers in Twilio.`);

    const report: ReportItem[] = [];
    let poolCount = 0;

    // READ ALLOWLIST IF EXECUTE
    let allowlist: { pool: string[], release: string[] } = { pool: [], release: [] };
    if (mode === 'execute' && allowlistPath) {
        const rawIds = fs.readFileSync(path.resolve(allowlistPath), 'utf-8');
        allowlist = JSON.parse(rawIds);
        console.log(`Allowlist loaded: ${allowlist.pool.length} pool, ${allowlist.release.length} release`);
    }

    // 2. Process Loop
    for (const num of twilioNumbers) {
        const e164 = num.phoneNumber;

        // A. Protected Check
        if (PROTECTED_NUMBERS.includes(e164)) {
            report.push({ phoneNumber: e164, twilioSid: num.sid, action: 'KEEP_PROTECTED' });

            // Ensure reserved in DB (Phase 2 or even Dry Run logic? Plan said "Ensure... assigned/internal")
            // In dry run we just report. In execute, we enforce.
            // Wait, user request for Logic Step 3: "Ensure protected numbers exist in DB and mark is_reserved=true"
            // I will do this update ONLY in execute mode to be safe, OR I can do it now if safe? 
            // User said "Protected phone numbers (must keep...)" - ensuring is_reserved=true is always safe.
            // But let's stick to "Execute" mode for ANY mutation to be strict.
            // Actually, if I don't mark them reserved now, Allocator might grab them? No, they are assigned to accounts usually.

            if (mode === 'execute') {
                // Enforce protection in DB
                const { error } = await supabase
                    .from('phone_numbers')
                    .update({
                        is_reserved: true,
                        lifecycle_status: 'assigned', // Keep as assigned so pool doesn't grab it
                        // We rely on current account assignment or just manual assignment
                    })
                    .eq('e164_number', e164);
                if (error) console.error(`Failed to reserve ${e164}:`, error);
            }
            continue;
        }

        // B. Active Customer Check
        const { data: accounts } = await supabase
            .from('accounts')
            .select('id, subscription_status')
            .eq('phone_number_e164', e164)
            .in('subscription_status', ['active', 'trial', 'past_due'])
            .limit(1);

        if (accounts && accounts.length > 0) {
            report.push({
                phoneNumber: e164,
                twilioSid: num.sid,
                action: 'KEEP_ACTIVE',
                accountId: accounts[0].id
            });
            continue;
        }

        // C. Conflict Check (Vapi)
        // We need to check if this number exists in Vapi and points to a protected assistant
        let vapiPhone = null;
        let vapiError = null;
        try {
            // Vapi API doesn't have a direct "get by number" easily documented publicly without filtering
            // But usually we list and find, or query. 
            // We can rely on our DB 'vapi_phone_id' OR try to fetch from Vapi.
            // Let's check our DB first for the ID, then fetch from Vapi to be sure.
            const { data: dbPhone } = await supabase
                .from('phone_numbers')
                .select('vapi_phone_id')
                .eq('e164_number', e164)
                .single();

            if (dbPhone?.vapi_phone_id) {
                try {
                    const res = await axios.get(`${VAPI_BASE_URL}/phone-number/${dbPhone.vapi_phone_id}`, {
                        headers: { Authorization: `Bearer ${process.env.VAPI_PRIVATE_API_KEY}` }
                    });
                    vapiPhone = res.data;
                } catch (e) {
                    // If 404, it's gone
                    if (axios.isAxiosError(e) && e.response?.status === 404) {
                        vapiPhone = null;
                    }
                }
            }
        } catch (err) {
            // console.error(`Error checking Vapi for ${e164}`, err);
        }

        if (vapiPhone && vapiPhone.assistantId && PROTECTED_ASSISTANTS.includes(vapiPhone.assistantId)) {
            report.push({
                phoneNumber: e164,
                twilioSid: num.sid,
                action: 'CONFLICT',
                reason: 'conflict_protected_assistant_on_non_protected_number',
                assistantId: vapiPhone.assistantId,
                currentVapiId: vapiPhone.id
            });
            continue;
        }

        // D. Pool vs Release
        // In execute mode, we only act if explicitly in allowlist
        if (mode === 'execute') {
            if (allowlist.pool.includes(e164)) {
                console.log(`Pooling: ${e164}`);
                // 1. Delete Vapi Phone
                if (vapiPhone && vapiPhone.id) {
                    await axios.delete(`${VAPI_BASE_URL}/phone-number/${vapiPhone.id}`, {
                        headers: { Authorization: `Bearer ${process.env.VAPI_PRIVATE_API_KEY}` }
                    });
                }
                // 2. Update DB
                await supabase.from('phone_numbers').update({
                    lifecycle_status: 'pool',
                    assigned_account_id: null,
                    vapi_phone_id: null,
                    is_reserved: false,
                    released_at: new Date().toISOString() // Marked as just released into pool
                }).eq('e164_number', e164);

                report.push({ phoneNumber: e164, twilioSid: num.sid, action: 'POOL' });
            } else if (allowlist.release.includes(e164)) {
                console.log(`Releasing: ${e164}`);
                // 1. Delete from Twilio
                await twilioClient.incomingPhoneNumbers(num.sid).remove();

                // 2. Update DB
                await supabase.from('phone_numbers').update({
                    lifecycle_status: 'released',
                    status: 'released',
                    assigned_account_id: null,
                    vapi_phone_id: null
                }).eq('e164_number', e164);

                report.push({ phoneNumber: e164, twilioSid: num.sid, action: 'RELEASE' });
            } else {
                console.log(`Skipping ${e164} (not in allowlist)`);
            }
        } else {
            // DRY RUN Logic
            // We simulate filling the pool
            if (poolCount < POOL_LIMIT) {
                report.push({ phoneNumber: e164, twilioSid: num.sid, action: 'POOL' });
                poolCount++;
            } else {
                report.push({ phoneNumber: e164, twilioSid: num.sid, action: 'RELEASE' });
            }
        }
    }

    // Generate Report JSON
    const summary = {
        total_twilio: twilioNumbers.length,
        protected: report.filter(r => r.action === 'KEEP_PROTECTED').length,
        active_customer: report.filter(r => r.action === 'KEEP_ACTIVE').length,
        conflict: report.filter(r => r.action === 'CONFLICT').length,
        pool_candidate: report.filter(r => r.action === 'POOL').length,
        release_candidate: report.filter(r => r.action === 'RELEASE').length,
    };

    const allocations = {
        protected: report.filter(r => r.action === 'KEEP_PROTECTED').map(r => r.phoneNumber),
        active_customer: report.filter(r => r.action === 'KEEP_ACTIVE').map(r => ({ phoneNumber: r.phoneNumber, accountId: r.accountId })),
        conflicts: report.filter(r => r.action === 'CONFLICT').map(r => ({
            phoneNumber: r.phoneNumber,
            vapiPhoneId: r.currentVapiId,
            assistantId: r.assistantId,
            reason: r.reason
        })),
        pool_candidates: report.filter(r => r.action === 'POOL').map(r => r.phoneNumber),
        release_candidates: report.filter(r => r.action === 'RELEASE').map(r => r.phoneNumber)
    };

    const finalOutput = {
        timestamp: new Date().toISOString(),
        summary,
        allocations
    };

    const reportPath = path.resolve('twilio_cleanup_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(finalOutput, null, 2));
    console.log(`Report written to ${reportPath}`);
}

main().catch(console.error);
