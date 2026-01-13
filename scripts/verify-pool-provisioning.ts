
import { createClient } from "npm:@supabase/supabase-js@2";
import { randomUUID } from "node:crypto";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

async function main() {
    console.log("🚀 Starting E2E Pool Verification...");

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
        Deno.exit(1);
    }
    console.log(`✅ Seeded pool number ID: ${poolRow.id}`);

    // 2. Call create-trial
    console.log("[2] Invoking create-trial...");

    const payload = {
        name: `Pool Test User ${testId}`,
        email: `pool.test.${testId}@example.com`,
        phone: "+15551234567",
        companyName: `Pool Test Co ${testId}`,
        trade: "Plumbing",
        zipCode: "80202", // Denver Zip -> maps to 303 area code usually, or we hope the logic picks 303
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
        // Continue only if we got a response body with error
    } else {
        // Check if result indicates success
        // Deno invoke wrapper returns data as the parsed JSON body if 200 OK
        // But if it's 400/500 it might throw or return error property
    }

    // Actually analyze the response
    if (!result || !result.success) {
        console.error("❌ create-trial returned failure:", result);
        Deno.exit(1);
    }

    const accountId = result.accountId;
    console.log(`✅ Trial Created! Account ID: ${accountId}`);
    console.log(`   Provisioning Status: ${result.provisioning_status}`);

    // 3. Wait for provisioning
    console.log("[3] Waiting for provisioning (max 60s)...");

    let assignedPhone = null;
    let attempts = 0;

    while (attempts < 12) { // 12 * 5s = 60s
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

        // Also check job status for potential debugging
        const { data: job } = await supabase
            .from("provisioning_jobs")
            .select("status, error")
            .eq("account_id", accountId)
            .maybeSingle();

        if (job && job.status === 'failed_permanent') {
            console.error("\n❌ Provisioning job failed permanently:", job.error);
            Deno.exit(1);
        }

        attempts++;
    }
    console.log("\n");

    if (!assignedPhone) {
        console.error("❌ Timeout waiting for phone assignment.");
        Deno.exit(1);
    }

    // 4. Assertions
    console.log(`[4] Verifying assignment. Assigned: ${assignedPhone.phone_number}`);
    console.log(`    Expected Pool Number: ${poolPhone}`);
    console.log(`    Expected ID: ${poolRow.id}`);
    console.log(`    Actual ID:   ${assignedPhone.id}`);

    if (assignedPhone.id === poolRow.id) {
        console.log("✅ SUCCESS! Pooled number was correctly assigned.");
    } else {
        console.error("❌ FAILURE! A different number was assigned. Pool logic failed.");

        // Cleanup pool number if test failed to pick it up (optional)
        // await supabase.from('phone_numbers').delete().eq('id', poolRow.id);

        Deno.exit(1);
    }
}

main();
