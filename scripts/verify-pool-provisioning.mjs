
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import fs from "node:fs";

// Manually verify/load env vars from .env.local if not present
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
        const envFile = fs.readFileSync('.env.local', 'utf8');
        const lines = envFile.split('\n');
        for (const line of lines) {
            const match = line.match(/^([^#=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                let value = match[2].trim();
                // Remove quotes if present
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                process.env[key] = value;
            }
        }
        console.log("Loaded env vars from .env.local. Keys found:", Object.keys(process.env).filter(k => k.includes('SUPABASE')));
    } catch (e) {
        console.warn("Could not read .env.local:", e.message);
    }
}

// Fallbacks for variable names
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
    console.error("Available keys:", Object.keys(process.env).filter(k => k.includes('SUPABASE')));
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

async function main() {
    console.log("🚀 Starting E2E Pool Verification (Node.js)...");

    // 1. Seed a number into the pool
    const testId = randomUUID().split("-")[0];
    const areaCode = "303"; // Denver
    const poolPhone = `+1${areaCode}555${Math.floor(1000 + Math.random() * 9000)}`;

    console.log(`[1] Seeding pool number: ${poolPhone} (Area: ${areaCode})`);

    const { data: poolRow, error: seedError } = await supabase
        .from("phone_numbers")
        .insert({
            phone_number: poolPhone,
            e164_number: poolPhone,
            area_code: areaCode,
            status: "released",
            lifecycle_status: "available", // KEY: Must be available
            is_test_number: true,
            provider: "twilio",
            provider_id: `mock-sid-${testId}`,
            vapi_phone_id: `mock-vapi-${testId}`,
            account_id: null,
            assigned_account_id: null,
        })
        .select()
        .single();

    if (seedError) {
        console.error("❌ Failed to seed pool number:", seedError);
        // process.exit(1); // Continue? No, fail.
        // If table doesn't exist or RLS issue? Service role should be fine.
        // Continue only if key already exists (retry?)
        if (seedError.code === '23505') { // Unique violation
            console.warn("Number already exists, trying to reuse...");
        } else {
            process.exit(1);
        }
    } else {
        console.log(`✅ Seeded pool number ID: ${poolRow.id}`);
    }

    // 2. Call create-trial
    console.log("[2] Invoking create-trial...");

    const payload = {
        name: `Pool Test User ${testId}`,
        email: `pool.test.${testId}@example.com`,
        phone: "+15551234567",
        companyName: `Pool Test Co ${testId}`,
        trade: "Plumbing",
        zipCode: "80202", // 80202 -> 303 area code
        planType: "starter",
        paymentMethodId: "pm_bypass_check_deploy", // Magic PM for bypass
        bypassStripe: true, // Explicit bypass
        source: "website"
    };

    const { data: result, error: fnError } = await supabase.functions.invoke("create-trial", {
        body: payload
    });

    if (fnError) {
        console.error("❌ create-trial invocation failed:", fnError);
        console.error("Error details:", await fnError.context?.json?.() || fnError);
        // Don't exit yet, check if partial success
    }

    if (result && !result.success && !result.accountId) {
        console.error("❌ create-trial returned failure:", result);
        process.exit(1);
    }

    // result might be null if fnError
    if (!result || !result.accountId) {
        console.error("❌ create-trial response invalid or failed:", result);
        process.exit(1);
    }

    const accountId = result.accountId;
    console.log(`✅ Trial Created! Account ID: ${accountId}`);
    console.log(`   Provisioning Status from API: ${result.provisioning_status}`);

    // 3. Wait for provisioning
    console.log("[3] Waiting for provisioning (max 90s)...");

    let assignedPhone = null;
    let attempts = 0;

    // Poll until assigned OR job fails
    while (attempts < 18) { // 18 * 5s = 90s
        await new Promise(r => setTimeout(r, 5000));
        process.stdout.write(".");

        const { data: phone } = await supabase
            .from("phone_numbers")
            .select("*")
            .eq("account_id", accountId)
            .eq("is_primary", true)
            .maybeSingle();

        if (phone) {
            assignedPhone = phone;
            break;
        }

        const { data: job } = await supabase
            .from("provisioning_jobs")
            .select("status, error")
            .eq("account_id", accountId)
            .maybeSingle();

        if (job && job.status === 'failed_permanent') {
            console.error("\n❌ Provisioning job failed permanently:", job.error);
            process.exit(1);
        }

        attempts++;
    }
    console.log("\n");

    if (!assignedPhone) {
        console.error("❌ Timeout waiting for phone assignment. Check logs.");
        process.exit(1);
    }

    // 4. Assertions
    console.log(`[4] Verifying assignment. Assigned: ${assignedPhone.phone_number}`);
    console.log(`    Expected Pool Number: ${poolPhone}`);
    // console.log(`    Expected ID: ${poolRow.id}`); 
    // We can't check ID if insert failed due to duplication (which shouldn't happen with random)
    // But we check Phone Number.
    console.log(`    Actual ID:   ${assignedPhone.id}`);

    if (assignedPhone.phone_number === poolPhone) {
        console.log("✅ SUCCESS! Pooled number was correctly assigned.");
    } else {
        console.error("❌ FAILURE! A different number was assigned. Pool logic failed.");
        console.error(`Expected ${poolPhone}, got ${assignedPhone.phone_number}`);
        process.exit(1);
    }
}

main();
