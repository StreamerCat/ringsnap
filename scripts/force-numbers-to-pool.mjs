#!/usr/bin/env node

/**
 * Force Eligible Numbers Into Pool
 *
 * This script identifies all Twilio inventory numbers and forces them into the pool
 * unless they are blacklisted or assigned to active accounts.
 *
 * Safety features:
 * - Defaults to DRY RUN mode
 * - Blacklist protection for +19704231415 and +19705168481
 * - Skips numbers assigned to active/trialing/past_due accounts
 * - Detaches Vapi phone objects safely
 * - Creates missing database rows for Twilio numbers
 * - Comprehensive logging and reporting
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... VAPI_API_KEY=... TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... \
 *   node scripts/force-numbers-to-pool.mjs [--execute]
 *
 * Options:
 *   --execute    Actually perform the changes (default is dry-run)
 */

import { createClient } from '@supabase/supabase-js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VAPI_API_KEY = process.env.VAPI_API_KEY;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

const DRY_RUN = !process.argv.includes('--execute');
const BLACKLIST = ['+19704231415', '+19705168481'];
const ACTIVE_STATUSES = ['active', 'trialing', 'past_due'];

// ============================================================================
// VALIDATION
// ============================================================================

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
  process.exit(1);
}

if (!VAPI_API_KEY) {
  console.error("❌ Error: VAPI_API_KEY required for Vapi phone deletion");
  process.exit(1);
}

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
  console.error("❌ Error: TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN required");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================================================
// REPORTING
// ============================================================================

const report = {
  twilioTotal: 0,
  skippedBlacklisted: [],
  skippedActiveAccount: [],
  pooledNow: [],
  missingDbRowCreated: [],
  vapiPhoneDeleted: [],
  errors: [],
};

// ============================================================================
// HELPERS
// ============================================================================

async function fetchTwilioNumbers() {
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers.json`;
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

  const response = await fetch(twilioUrl, {
    headers: { "Authorization": `Basic ${auth}` },
  });

  if (!response.ok) {
    throw new Error(`Twilio API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.incoming_phone_numbers || [];
}

async function deleteVapiPhone(vapiPhoneId, phoneNumber) {
  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would delete Vapi phone: ${vapiPhoneId}`);
    return true;
  }

  try {
    const response = await fetch(`https://api.vapi.ai/phone-number/${vapiPhoneId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
      },
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Vapi DELETE failed: ${response.status} ${response.statusText}`);
    }

    console.log(`  ✅ Deleted Vapi phone: ${vapiPhoneId} for ${phoneNumber}`);
    return true;
  } catch (error) {
    console.error(`  ⚠️  Failed to delete Vapi phone ${vapiPhoneId}:`, error.message);
    report.errors.push({
      phone: phoneNumber,
      operation: 'vapi_delete',
      error: error.message
    });
    return false;
  }
}

async function updatePhoneToPool(phoneRecord, phoneNumber, twilioSid) {
  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would update ${phoneNumber} to pool status`);
    return true;
  }

  try {
    const { error } = await supabase
      .from('phone_numbers')
      .update({
        lifecycle_status: 'pool',
        cooldown_until: null,
        assigned_account_id: null,
        account_id: null,
        vapi_phone_id: null,
        is_reserved: false,
        released_at: new Date().toISOString(),
        last_lifecycle_change_at: new Date().toISOString(),
      })
      .eq('id', phoneRecord.id);

    if (error) throw error;

    console.log(`  ✅ Updated ${phoneNumber} to pool`);
    return true;
  } catch (error) {
    console.error(`  ⚠️  Failed to update ${phoneNumber}:`, error.message);
    report.errors.push({
      phone: phoneNumber,
      operation: 'db_update',
      error: error.message
    });
    return false;
  }
}

async function createMissingPhoneRecord(phoneNumber, twilioSid, areaCode) {
  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would create DB row for ${phoneNumber}`);
    return true;
  }

  try {
    const { data, error } = await supabase
      .from('phone_numbers')
      .insert({
        phone_number: phoneNumber,
        e164_number: phoneNumber,
        provider: 'twilio',
        provider_phone_number_id: twilioSid,
        area_code: areaCode,
        lifecycle_status: 'pool',
        status: 'released',
        is_primary: false,
        is_reserved: false,
        released_at: new Date().toISOString(),
        last_lifecycle_change_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`  ✅ Created DB row for ${phoneNumber}`);
    return data;
  } catch (error) {
    console.error(`  ⚠️  Failed to create DB row for ${phoneNumber}:`, error.message);
    report.errors.push({
      phone: phoneNumber,
      operation: 'db_insert',
      error: error.message
    });
    return null;
  }
}

// ============================================================================
// MAIN PROCESS
// ============================================================================

console.log("═══════════════════════════════════════════════════════════");
console.log(`FORCE ELIGIBLE NUMBERS TO POOL ${DRY_RUN ? '(DRY RUN)' : '(EXECUTE MODE)'}`);
console.log("═══════════════════════════════════════════════════════════\n");

if (DRY_RUN) {
  console.log("⚠️  DRY RUN MODE: No changes will be made");
  console.log("   Run with --execute to actually perform changes\n");
}

// Step 1: Fetch Twilio inventory
console.log("📞 Fetching Twilio inventory...\n");
const twilioNumbers = await fetchTwilioNumbers();
report.twilioTotal = twilioNumbers.length;
console.log(`  Found ${twilioNumbers.length} Twilio numbers\n`);

// Step 2: Fetch all accounts with active subscriptions
console.log("👤 Fetching active accounts...\n");
const { data: activeAccounts, error: accountsError } = await supabase
  .from('accounts')
  .select('id, phone_number_e164, subscription_status')
  .in('subscription_status', ACTIVE_STATUSES);

if (accountsError) {
  console.error("❌ Error fetching accounts:", accountsError);
  process.exit(1);
}

const activeAccountPhones = new Set(
  activeAccounts
    .map(a => a.phone_number_e164)
    .filter(Boolean)
);

console.log(`  Found ${activeAccounts.length} active accounts with ${activeAccountPhones.size} assigned numbers\n`);

// Step 3: Fetch all phone_numbers from DB
console.log("📊 Fetching phone_numbers from database...\n");
const { data: dbPhones, error: dbError } = await supabase
  .from('phone_numbers')
  .select('*');

if (dbError) {
  console.error("❌ Error fetching phone_numbers:", dbError);
  process.exit(1);
}

// Create lookup maps
const dbPhoneMap = new Map();
dbPhones.forEach(p => {
  const e164 = p.e164_number || p.phone_number;
  if (e164) dbPhoneMap.set(e164, p);
});

console.log(`  Found ${dbPhones.length} phone records in database\n`);

// Step 4: Process each Twilio number
console.log("🔄 Processing Twilio numbers...\n");

for (const twilioNum of twilioNumbers) {
  const phoneNumber = twilioNum.phone_number;
  const twilioSid = twilioNum.sid;
  const areaCode = phoneNumber.slice(2, 5);

  console.log(`\nProcessing ${phoneNumber}...`);

  // Check 1: Blacklist
  if (BLACKLIST.includes(phoneNumber)) {
    console.log(`  🚫 SKIPPED: Blacklisted`);
    report.skippedBlacklisted.push(phoneNumber);
    continue;
  }

  // Check 2: Active account
  if (activeAccountPhones.has(phoneNumber)) {
    console.log(`  🚫 SKIPPED: Assigned to active account`);
    report.skippedActiveAccount.push(phoneNumber);
    continue;
  }

  // Check 3: Exists in DB?
  let phoneRecord = dbPhoneMap.get(phoneNumber);

  if (!phoneRecord) {
    console.log(`  ⚠️  Not in database, creating...`);
    phoneRecord = await createMissingPhoneRecord(phoneNumber, twilioSid, areaCode);
    if (phoneRecord) {
      report.missingDbRowCreated.push(phoneNumber);
      dbPhoneMap.set(phoneNumber, phoneRecord); // Add to map for next step
    } else {
      continue; // Failed to create, skip
    }
  }

  // Check 4: Detach from Vapi if needed
  if (phoneRecord.vapi_phone_id) {
    console.log(`  🗑️  Detaching from Vapi (phone_id: ${phoneRecord.vapi_phone_id})...`);
    const deleted = await deleteVapiPhone(phoneRecord.vapi_phone_id, phoneNumber);
    if (deleted) {
      report.vapiPhoneDeleted.push({
        phone: phoneNumber,
        vapiPhoneId: phoneRecord.vapi_phone_id
      });
    }
  }

  // Check 5: Update to pool
  console.log(`  🏊 Forcing to pool...`);
  const updated = await updatePhoneToPool(phoneRecord, phoneNumber, twilioSid);
  if (updated) {
    report.pooledNow.push(phoneNumber);
  }
}

// ============================================================================
// FINAL REPORT
// ============================================================================

console.log("\n═══════════════════════════════════════════════════════════");
console.log("FINAL REPORT");
console.log("═══════════════════════════════════════════════════════════\n");

console.log(`Total Twilio Numbers:           ${report.twilioTotal}`);
console.log(`Skipped (Blacklisted):          ${report.skippedBlacklisted.length}`);
console.log(`Skipped (Active Account):       ${report.skippedActiveAccount.length}`);
console.log(`Missing DB Rows Created:        ${report.missingDbRowCreated.length}`);
console.log(`Vapi Phones Deleted:            ${report.vapiPhoneDeleted.length}`);
console.log(`Forced to Pool:                 ${report.pooledNow.length}`);
console.log(`Errors:                         ${report.errors.length}`);

if (report.skippedBlacklisted.length > 0) {
  console.log("\n🚫 Blacklisted Numbers:");
  report.skippedBlacklisted.forEach(p => console.log(`  - ${p}`));
}

if (report.skippedActiveAccount.length > 0) {
  console.log("\n👤 Active Account Numbers (first 10):");
  report.skippedActiveAccount.slice(0, 10).forEach(p => console.log(`  - ${p}`));
  if (report.skippedActiveAccount.length > 10) {
    console.log(`  ... and ${report.skippedActiveAccount.length - 10} more`);
  }
}

if (report.missingDbRowCreated.length > 0) {
  console.log("\n✨ Created DB Rows (first 10):");
  report.missingDbRowCreated.slice(0, 10).forEach(p => console.log(`  - ${p}`));
  if (report.missingDbRowCreated.length > 10) {
    console.log(`  ... and ${report.missingDbRowCreated.length - 10} more`);
  }
}

if (report.vapiPhoneDeleted.length > 0) {
  console.log("\n🗑️  Deleted Vapi Phones (first 10):");
  report.vapiPhoneDeleted.slice(0, 10).forEach(item => {
    console.log(`  - ${item.phone} (${item.vapiPhoneId})`);
  });
  if (report.vapiPhoneDeleted.length > 10) {
    console.log(`  ... and ${report.vapiPhoneDeleted.length - 10} more`);
  }
}

if (report.pooledNow.length > 0) {
  console.log("\n🏊 Forced to Pool (first 10):");
  report.pooledNow.slice(0, 10).forEach(p => console.log(`  - ${p}`));
  if (report.pooledNow.length > 10) {
    console.log(`  ... and ${report.pooledNow.length - 10} more`);
  }
}

if (report.errors.length > 0) {
  console.log("\n❌ Errors:");
  report.errors.forEach(e => {
    console.log(`  - ${e.phone} (${e.operation}): ${e.error}`);
  });
}

console.log("\n═══════════════════════════════════════════════════════════");

if (DRY_RUN) {
  console.log("\n⚠️  This was a DRY RUN - no changes were made");
  console.log("   Run with --execute to actually perform changes");
} else {
  console.log("\n✅ EXECUTION COMPLETE");
}

console.log("\n═══════════════════════════════════════════════════════════");

// Write detailed JSON report
const reportPath = `./force-pool-report-${new Date().toISOString().replace(/:/g, '-')}.json`;
await import('fs').then(fs =>
  fs.promises.writeFile(reportPath, JSON.stringify(report, null, 2))
);
console.log(`\n📄 Detailed report saved to: ${reportPath}`);
