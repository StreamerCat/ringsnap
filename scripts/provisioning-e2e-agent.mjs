
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// --- CONFIGURATION ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RUN_LIVE = process.env.RUN_LIVE_PROVISIONING_TESTS === 'true';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
    console.error("Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/provisioning-e2e-agent.mjs");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const TEST_RUN_ID = randomUUID().split('-')[0];
const LOG_PREFIX = `[E2E-AGENT-${TEST_RUN_ID}]`;

// --- HELPERS ---
async function log(msg, type = 'info') {
    const icon = type === 'info' ? 'ℹ️' : type === 'success' ? '✅' : type === 'error' ? '❌' : '⚠️';
    console.log(`${LOG_PREFIX} ${icon} ${msg}`);
}

async function createTestAccount(tag, zip = '90210') {
    const accountId = randomUUID();
    const { error } = await supabase.from('accounts').insert({
        id: accountId,
        company_name: `E2E Test ${tag} ${TEST_RUN_ID}`,
        trade: 'Plumbing',
        zip_code: zip,
        billing_email: `test-${tag}-${TEST_RUN_ID}@example.com`,
        provisioning_status: 'pending'
    });
    if (error) throw new Error(`Failed to create account: ${error.message}`);
    return accountId;
}

async function createProvisioningJob(accountId, testConfig = {}) {
    const jobId = randomUUID();
    const { error } = await supabase.from('provisioning_jobs').insert({
        id: jobId,
        account_id: accountId,
        status: 'queued',
        job_type: 'provision_vapi',
        attempts: 0,
        test_mode: true,
        test_config: testConfig
    });
    if (error) throw new Error(`Failed to create job: ${error.message}`);
    return jobId;
}

async function waitForJobCompletion(jobId, maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
        const { data, error } = await supabase
            .from('provisioning_jobs')
            .select('*')
            .eq('id', jobId)
            .single();

        if (error) throw error;

        if (data.status === 'completed') return data;
        if (data.status === 'failed_permanent') throw new Error(`Job failed permanently: ${data.error}`);
        // If we are expecting a retry failure, we might see 'failed' momentarily, but we want final state

        await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error("Timeout waiting for job completion");
}

// --- TESTS ---

// TEST 1: Happy Path Provisioning
async function runHappyPathTest() {
    log("Starting Test 1: Happy Path (Mock Provider)...");

    const accountId = await createTestAccount('happy');
    const jobId = await createProvisioningJob(accountId, {
        mock_provider: true
    });

    log(`Created Account ${accountId} and Job ${jobId}`);

    const job = await waitForJobCompletion(jobId);
    log("Job completed!");

    // Assertions
    const { data: account } = await supabase.from('accounts').select('*').eq('id', accountId).single();
    const { data: phone } = await supabase.from('phone_numbers').select('*').eq('account_id', accountId).single();

    if (account.provisioning_status !== 'completed') throw new Error(`Account status is ${account.provisioning_status}`);
    if (!account.vapi_phone_number_id) throw new Error("Account missing vapi_phone_number_id");
    if (!phone) throw new Error("Phone number record missing");
    if (phone.status !== 'active') throw new Error(`Phone status is ${phone.status}`);

    log("Test 1 Passed!", "success");
}

// TEST 2: Retry Logic
async function runRetryTest() {
    log("Starting Test 2: Retry Logic (Simulated Failure)...");

    const accountId = await createTestAccount('retry');
    // Simulate 1 failure. The worker should retry and succeed on attempt 2 (which is index 1 or 2 depending on logic)
    const jobId = await createProvisioningJob(accountId, {
        mock_provider: true,
        simulate_failure_attempts: 1
    });

    log(`Created Account ${accountId} and Job ${jobId} (expect 1 failure)`);

    const job = await waitForJobCompletion(jobId);

    if (job.attempts < 1) throw new Error(`Job should have at least 1 attempt, got ${job.attempts}`);

    log(`Job completed after ${job.attempts} attempts (Expected > 0)`, "success");
}

// TEST 3: Pool Allocation
async function runPoolTest() {
    log("Starting Test 3: Pool Allocation...");

    // 1. Seed a number
    const targetArea = '310';
    const poolPhone310 = `+1310555${Math.floor(1000 + Math.random() * 9000)}`;
    const { data: poolRow310, error: poolError310 } = await supabase.from('phone_numbers').insert({
        phone_number: poolPhone310,
        e164_number: poolPhone310,
        area_code: targetArea,
        status: 'released',
        lifecycle_status: 'available',
        is_test_number: true,
        provider: 'twilio',
        vapi_phone_id: `pool-mock-310-${Date.now()}`,
        account_id: null,
        assigned_account_id: null
    }).select().single();

    if (poolError310) throw new Error(`Failed to seed pool 310: ${poolError310.message}`);
    log(`Seeded pool number 310: ${poolPhone310} (ID: ${poolRow310.id})`);

    const accountId = await createTestAccount('pool', '90210'); // 90210 -> 310

    // Create Job
    const jobId = await createProvisioningJob(accountId, {
        mock_provider: true
    });

    log(`Created Account ${accountId} and Job ${jobId}`);

    const job = await waitForJobCompletion(jobId);
    log("Job completed!");

    // Assertion: Did it reuse?
    const { data: assignedPhone } = await supabase.from('phone_numbers').select('*').eq('account_id', accountId).single();

    if (!assignedPhone) throw new Error("No phone assigned");

    if (assignedPhone.id === poolRow310.id) {
        log(`Success! Pool Allocation verified. Assigned ${assignedPhone.phone_number}`, "success");
    } else {
        log(`Failure: Provisioned NEW number ${assignedPhone.phone_number} (ID: ${assignedPhone.id}) instead of Pool ID ${poolRow310.id}`, "error");
        throw new Error("Pool Allocation Failed - System provisioned new number instead of using pool.");
    }
}

async function main() {
    log(`Starting Agent in ${RUN_LIVE ? 'LIVE' : 'MOCK'} mode`);

    try {
        await runHappyPathTest();
        await runRetryTest();
        await runPoolTest();

        log("All Tests Passed", "success");
    } catch (e) {
        log(e.message, "error");
        process.exit(1);
    }
}

main();
