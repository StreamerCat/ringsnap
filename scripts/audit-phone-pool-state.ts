#!/usr/bin/env -S deno run --allow-env --allow-net

/**
 * Phone Number Pool State Audit
 *
 * Investigates the current state of phone numbers in the pool system:
 * - Counts by lifecycle_status
 * - Numbers in cooldown
 * - Numbers in pool
 * - Missing Twilio inventory
 * - Active account assignments
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log("═══════════════════════════════════════════════════════════");
console.log("PHONE NUMBER POOL STATE AUDIT");
console.log("═══════════════════════════════════════════════════════════\n");

// ============================================================================
// 1. LIFECYCLE STATUS COUNTS
// ============================================================================
console.log("📊 LIFECYCLE STATUS DISTRIBUTION:\n");

const { data: statusCounts, error: statusError } = await supabase
  .from("phone_numbers")
  .select("lifecycle_status")
  .order("lifecycle_status");

if (statusError) {
  console.error("Error fetching status counts:", statusError);
} else {
  const counts = statusCounts.reduce((acc: Record<string, number>, row: any) => {
    const status = row.lifecycle_status || "NULL";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  for (const [status, count] of Object.entries(counts)) {
    console.log(`  ${status.padEnd(15)} : ${count}`);
  }
  console.log(`  ${"TOTAL".padEnd(15)} : ${statusCounts.length}\n`);
}

// ============================================================================
// 2. NUMBERS IN COOLDOWN
// ============================================================================
console.log("❄️  NUMBERS IN COOLDOWN:\n");

const { data: cooldownNumbers, error: cooldownError } = await supabase
  .from("phone_numbers")
  .select("id, phone_number, e164_number, lifecycle_status, cooldown_until, released_at")
  .eq("lifecycle_status", "cooldown")
  .order("cooldown_until")
  .limit(10);

if (cooldownError) {
  console.error("Error fetching cooldown numbers:", cooldownError);
} else if (cooldownNumbers.length === 0) {
  console.log("  No numbers in cooldown\n");
} else {
  console.log(`  Found ${cooldownNumbers.length} numbers (showing first 10):`);
  for (const num of cooldownNumbers) {
    const phone = num.e164_number || num.phone_number;
    const cooldownUntil = num.cooldown_until ? new Date(num.cooldown_until).toISOString() : "NULL";
    const releasedAt = num.released_at ? new Date(num.released_at).toISOString() : "NULL";
    console.log(`    ${phone.padEnd(15)} cooldown_until=${cooldownUntil.slice(0, 10)} released_at=${releasedAt.slice(0, 10)}`);
  }
  console.log();
}

// ============================================================================
// 3. NUMBERS IN POOL
// ============================================================================
console.log("🏊 NUMBERS IN POOL:\n");

const { data: poolNumbers, error: poolError } = await supabase
  .from("phone_numbers")
  .select("id, phone_number, e164_number, lifecycle_status, cooldown_until, last_call_at, released_at, is_reserved")
  .eq("lifecycle_status", "pool")
  .order("released_at")
  .limit(10);

if (poolError) {
  console.error("Error fetching pool numbers:", poolError);
} else if (poolNumbers.length === 0) {
  console.log("  ⚠️  No numbers in pool (THIS IS THE PROBLEM!)\n");
} else {
  console.log(`  Found ${poolNumbers.length} numbers (showing first 10):`);
  for (const num of poolNumbers) {
    const phone = num.e164_number || num.phone_number;
    const cooldownUntil = num.cooldown_until ? new Date(num.cooldown_until).toISOString() : "NULL";
    const lastCallAt = num.last_call_at ? new Date(num.last_call_at).toISOString() : "NULL";
    const isReserved = num.is_reserved ? "RESERVED" : "available";
    console.log(`    ${phone.padEnd(15)} last_call=${lastCallAt.slice(0, 10)} is_reserved=${isReserved}`);
  }
  console.log();
}

// ============================================================================
// 4. NUMBERS IN RELEASED STATE
// ============================================================================
console.log("📤 NUMBERS IN RELEASED STATE:\n");

const { data: releasedNumbers, error: releasedError } = await supabase
  .from("phone_numbers")
  .select("id, phone_number, e164_number, lifecycle_status, released_at")
  .eq("lifecycle_status", "released")
  .order("released_at")
  .limit(10);

if (releasedError) {
  console.error("Error fetching released numbers:", releasedError);
} else if (releasedNumbers.length === 0) {
  console.log("  No numbers in released state\n");
} else {
  console.log(`  Found ${releasedNumbers.length} numbers (showing first 10):`);
  for (const num of releasedNumbers) {
    const phone = num.e164_number || num.phone_number;
    const releasedAt = num.released_at ? new Date(num.released_at).toISOString() : "NULL";
    console.log(`    ${phone.padEnd(15)} released_at=${releasedAt.slice(0, 10)}`);
  }
  console.log();
}

// ============================================================================
// 5. ACTIVE ACCOUNT ASSIGNMENTS
// ============================================================================
console.log("👤 ACTIVE ACCOUNT ASSIGNMENTS:\n");

const { data: assignedNumbers, error: assignedError } = await supabase
  .from("phone_numbers")
  .select(`
    id,
    phone_number,
    e164_number,
    lifecycle_status,
    assigned_account_id,
    assigned_at,
    accounts!phone_numbers_account_id_fkey (
      id,
      subscription_status,
      phone_number_e164
    )
  `)
  .eq("lifecycle_status", "assigned")
  .limit(10);

if (assignedError) {
  console.error("Error fetching assigned numbers:", assignedError);
} else if (assignedNumbers.length === 0) {
  console.log("  No numbers currently assigned\n");
} else {
  console.log(`  Found ${assignedNumbers.length} assigned numbers (showing first 10):`);
  for (const num of assignedNumbers) {
    const phone = num.e164_number || num.phone_number;
    const account = Array.isArray(num.accounts) ? num.accounts[0] : num.accounts;
    const accountStatus = account?.subscription_status || "unknown";
    const accountId = num.assigned_account_id?.slice(0, 8) || "NULL";
    console.log(`    ${phone.padEnd(15)} account=${accountId}... status=${accountStatus}`);
  }
  console.log();
}

// ============================================================================
// 6. CHECK SPECIFIC NUMBER: +19705074433
// ============================================================================
console.log("🔍 CHECKING SPECIFIC NUMBER: +19705074433 (recently purchased):\n");

const { data: specificNumber, error: specificError } = await supabase
  .from("phone_numbers")
  .select("*")
  .or("phone_number.eq.+19705074433,e164_number.eq.+19705074433")
  .maybeSingle();

if (specificError) {
  console.error("Error fetching specific number:", specificError);
} else if (!specificNumber) {
  console.log("  ⚠️  Number NOT found in database!\n");
} else {
  console.log("  Found in database:");
  console.log(`    Phone: ${specificNumber.e164_number || specificNumber.phone_number}`);
  console.log(`    Lifecycle Status: ${specificNumber.lifecycle_status || "NULL"}`);
  console.log(`    Assigned Account ID: ${specificNumber.assigned_account_id || "NULL"}`);
  console.log(`    Vapi Phone ID: ${specificNumber.vapi_phone_id || "NULL"}`);
  console.log(`    Created At: ${specificNumber.created_at}`);
  console.log(`    Assigned At: ${specificNumber.assigned_at || "NULL"}`);
  console.log();
}

// ============================================================================
// 7. FETCH TWILIO INVENTORY
// ============================================================================
console.log("📞 TWILIO INVENTORY (IncomingPhoneNumbers):\n");

try {
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers.json`;
  const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

  const response = await fetch(twilioUrl, {
    headers: {
      "Authorization": `Basic ${auth}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Twilio API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const twilioNumbers = data.incoming_phone_numbers || [];

  console.log(`  Total Twilio Numbers: ${twilioNumbers.length}\n`);

  // Check which Twilio numbers are NOT in our database
  const { data: dbNumbers } = await supabase
    .from("phone_numbers")
    .select("phone_number, e164_number");

  const dbE164Set = new Set(
    dbNumbers?.flatMap((n: any) => [n.phone_number, n.e164_number].filter(Boolean)) || []
  );

  const missingNumbers = twilioNumbers.filter(
    (tn: any) => !dbE164Set.has(tn.phone_number)
  );

  if (missingNumbers.length > 0) {
    console.log(`  ⚠️  ${missingNumbers.length} Twilio numbers NOT in database (showing first 10):`);
    for (const tn of missingNumbers.slice(0, 10)) {
      console.log(`    ${tn.phone_number.padEnd(15)} SID=${tn.sid}`);
    }
    console.log();
  } else {
    console.log("  ✅ All Twilio numbers are in database\n");
  }

  // Show first 10 Twilio numbers
  console.log("  Sample Twilio Numbers (first 10):");
  for (const tn of twilioNumbers.slice(0, 10)) {
    const inDb = dbE164Set.has(tn.phone_number) ? "✅ in DB" : "❌ missing";
    console.log(`    ${tn.phone_number.padEnd(15)} ${inDb}`);
  }
  console.log();

} catch (error) {
  console.error("Error fetching Twilio inventory:", error);
}

// ============================================================================
// 8. ALLOCATOR TEST SIMULATION
// ============================================================================
console.log("🧪 ALLOCATOR SIMULATION (10-day silence check):\n");

const { data: eligibleNumbers, error: eligibleError } = await supabase
  .from("phone_numbers")
  .select("id, phone_number, e164_number, lifecycle_status, cooldown_until, last_call_at")
  .eq("lifecycle_status", "pool")
  .is("is_reserved", false);

if (eligibleError) {
  console.error("Error simulating allocator:", eligibleError);
} else {
  const now = new Date();
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

  const fullyEligible = eligibleNumbers.filter((n: any) => {
    const cooldownOk = !n.cooldown_until || new Date(n.cooldown_until) <= now;
    const silenceOk = !n.last_call_at || new Date(n.last_call_at) < tenDaysAgo;
    return cooldownOk && silenceOk;
  });

  console.log(`  Total pool numbers: ${eligibleNumbers.length}`);
  console.log(`  Eligible for allocation (after cooldown + 10-day silence): ${fullyEligible.length}`);

  if (fullyEligible.length === 0) {
    console.log("\n  ⚠️  NO NUMBERS ELIGIBLE FOR ALLOCATION!");
    console.log("  This explains why the allocator returned NULL.\n");
  } else {
    console.log("\n  ✅ Eligible numbers found:");
    for (const num of fullyEligible.slice(0, 5)) {
      const phone = num.e164_number || num.phone_number;
      console.log(`    ${phone}`);
    }
    console.log();
  }
}

console.log("═══════════════════════════════════════════════════════════");
console.log("END OF AUDIT");
console.log("═══════════════════════════════════════════════════════════");
