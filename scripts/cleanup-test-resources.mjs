#!/usr/bin/env node

/**
 * Cleanup Test Resources
 *
 * Identifies test accounts (flagged by is_test_account, billing_test_mode,
 * company_name ILIKE 'E2E Test%', or zip_code = '99999'), backs up their data,
 * then deletes:
 *   1. Vapi assistants via the Vapi API
 *   2. Vapi phone objects via the Vapi API
 *   3. Twilio phone numbers via the Twilio API (real numbers only)
 *   4. All associated DB records
 *
 * Safety features:
 *   - Dry-run by default (add --execute to actually delete)
 *   - Protected phone number list (never released)
 *   - Protected Vapi assistant list (never deleted)
 *   - Full JSON backup written before any deletion
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... VAPI_API_KEY=... \
 *   TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... \
 *   node scripts/cleanup-test-resources.mjs [--execute]
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VAPI_API_KEY = process.env.VAPI_API_KEY;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

const DRY_RUN = !process.argv.includes('--execute');

// Phone numbers that must NEVER be released from Twilio
const PROTECTED_PHONE_NUMBERS = new Set([
  '+19705168481',
  '+19704231413',
  '+19706106662',
]);

// Vapi assistant IDs that must NEVER be deleted
const PROTECTED_VAPI_ASSISTANTS = new Set([
  'e2329175-069b-457f-8984-0f2e62742ed8',
  'db066c6c-e2e3-424e-9fd1-1473f2ac3b01',
  '2bb27d02-b686-4844-8534-6dfe9be5a077',
  'aae32b19-9ea0-4b31-b6f4-b98db79f5645',
  'bbcba08d-604e-44e7-a8a1-019cb1c9e46c',
]);

// ============================================================================
// VALIDATION
// ============================================================================

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}

if (!VAPI_API_KEY) {
  console.error('❌ Error: VAPI_API_KEY is required');
  process.exit(1);
}

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
  console.error('❌ Error: TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ============================================================================
// REPORT
// ============================================================================

const report = {
  timestamp: new Date().toISOString(),
  dryRun: DRY_RUN,
  accountsFound: 0,
  vapiAssistantsDeleted: [],
  vapiAssistantsSkippedProtected: [],
  vapiAssistantsSkippedNotFound: [],
  vapPhoneObjectsDeleted: [],
  twilioNumbersReleased: [],
  twilioNumbersSkippedProtected: [],
  twilioNumbersSkippedTestSeed: [],
  dbRowsDeleted: {
    provisioning_jobs: 0,
    vapi_assistants: 0,
    phone_numbers: 0,
    accounts: 0,
  },
  errors: [],
};

// ============================================================================
// HELPERS
// ============================================================================

function log(msg, level = 'info') {
  const prefix = {
    info: 'ℹ️ ',
    success: '✅',
    warn: '⚠️ ',
    error: '❌',
    skip: '⏭️ ',
    dry: '💧',
  }[level] ?? 'ℹ️ ';
  console.log(`  ${prefix} ${msg}`);
}

function header(title) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

function normalize(phone) {
  // Strip spaces/dashes/parens for comparison
  return phone ? phone.replace(/[\s\-().]/g, '') : phone;
}

function isProtectedPhone(phone) {
  if (!phone) return false;
  return PROTECTED_PHONE_NUMBERS.has(normalize(phone));
}

async function deleteVapiAssistant(assistantId) {
  if (DRY_RUN) {
    log(`[DRY RUN] Would DELETE vapi assistant: ${assistantId}`, 'dry');
    return true;
  }
  try {
    const res = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${VAPI_API_KEY}` },
    });
    if (res.status === 404) {
      log(`Vapi assistant already gone (404): ${assistantId}`, 'warn');
      return true;
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HTTP ${res.status}: ${body}`);
    }
    log(`Deleted Vapi assistant: ${assistantId}`, 'success');
    return true;
  } catch (err) {
    log(`Failed to delete Vapi assistant ${assistantId}: ${err.message}`, 'error');
    report.errors.push({ type: 'vapi_assistant_delete', id: assistantId, error: err.message });
    return false;
  }
}

async function deleteVapiPhoneObject(vapiPhoneId, phoneNumber) {
  if (DRY_RUN) {
    log(`[DRY RUN] Would DELETE Vapi phone object: ${vapiPhoneId} (${phoneNumber})`, 'dry');
    return true;
  }
  try {
    const res = await fetch(`https://api.vapi.ai/phone-number/${vapiPhoneId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${VAPI_API_KEY}` },
    });
    if (res.status === 404) {
      log(`Vapi phone object already gone (404): ${vapiPhoneId}`, 'warn');
      return true;
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HTTP ${res.status}: ${body}`);
    }
    log(`Deleted Vapi phone object: ${vapiPhoneId} (${phoneNumber})`, 'success');
    return true;
  } catch (err) {
    log(`Failed to delete Vapi phone object ${vapiPhoneId}: ${err.message}`, 'error');
    report.errors.push({ type: 'vapi_phone_delete', id: vapiPhoneId, error: err.message });
    return false;
  }
}

async function fetchTwilioSidByNumber(phoneE164) {
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const encoded = encodeURIComponent(phoneE164);
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers.json?PhoneNumber=${encoded}`;
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  if (!res.ok) throw new Error(`Twilio list error ${res.status}`);
  const data = await res.json();
  return data.incoming_phone_numbers?.[0]?.sid ?? null;
}

async function releaseTwilioNumber(twilioSid, phoneNumber) {
  if (DRY_RUN) {
    log(`[DRY RUN] Would DELETE Twilio number: ${twilioSid} (${phoneNumber})`, 'dry');
    return true;
  }
  try {
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers/${twilioSid}.json`,
      { method: 'DELETE', headers: { Authorization: `Basic ${auth}` } }
    );
    if (res.status === 404) {
      log(`Twilio number already released (404): ${twilioSid}`, 'warn');
      return true;
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HTTP ${res.status}: ${body}`);
    }
    log(`Released Twilio number: ${phoneNumber} (${twilioSid})`, 'success');
    return true;
  } catch (err) {
    log(`Failed to release Twilio number ${phoneNumber}: ${err.message}`, 'error');
    report.errors.push({ type: 'twilio_release', phone: phoneNumber, sid: twilioSid, error: err.message });
    return false;
  }
}

// ============================================================================
// MAIN
// ============================================================================

header(DRY_RUN ? 'CLEANUP TEST RESOURCES (DRY RUN)' : 'CLEANUP TEST RESOURCES (EXECUTE)');
if (DRY_RUN) {
  console.log('\n  ⚠️  DRY RUN MODE — no changes will be made');
  console.log('  Run with --execute to actually delete resources\n');
}

// ============================================================================
// PHASE 0: DISCOVERY
// ============================================================================

header('Phase 0: Discovery');
console.log('\n  Querying test accounts...');

const { data: testAccounts, error: accountErr } = await supabase
  .from('accounts')
  .select('*')
  .or('is_test_account.eq.true,billing_test_mode.eq.true,company_name.ilike.E2E Test%,zip_code.eq.99999');

if (accountErr) {
  console.error('❌ Failed to query accounts:', accountErr);
  process.exit(1);
}

const testAccountIds = testAccounts.map(a => a.id);
report.accountsFound = testAccountIds.length;
log(`Found ${testAccountIds.length} test accounts`, 'info');
testAccounts.forEach(a =>
  log(`  ${a.id} — ${a.company_name} (zip=${a.zip_code}, is_test=${a.is_test_account}, billing_test=${a.billing_test_mode})`, 'info')
);

// Fetch related phone numbers (including orphans with is_test_number)
let allPhoneNumbers = [];
if (testAccountIds.length > 0) {
  const { data: linkedPhones, error: phoneErr } = await supabase
    .from('phone_numbers')
    .select('*')
    .in('account_id', testAccountIds);
  if (phoneErr) {
    console.error('❌ Failed to query phone_numbers:', phoneErr);
    process.exit(1);
  }
  allPhoneNumbers.push(...(linkedPhones ?? []));
}

// Also pick up orphaned test numbers (is_test_number = true, no account)
const { data: orphanPhones, error: orphanPhoneErr } = await supabase
  .from('phone_numbers')
  .select('*')
  .eq('is_test_number', true)
  .is('account_id', null);
if (orphanPhoneErr) {
  log(`Warning: could not query orphan phone numbers: ${orphanPhoneErr.message}`, 'warn');
} else {
  allPhoneNumbers.push(...(orphanPhones ?? []));
}
// Deduplicate by id
allPhoneNumbers = Object.values(
  Object.fromEntries(allPhoneNumbers.map(p => [p.id, p]))
);
log(`Found ${allPhoneNumbers.length} phone number records to consider`, 'info');

// Fetch related vapi_assistants
let allVapiAssistants = [];
if (testAccountIds.length > 0) {
  const { data: linkedAssistants, error: assistantErr } = await supabase
    .from('vapi_assistants')
    .select('*')
    .in('account_id', testAccountIds);
  if (assistantErr) {
    log(`Warning: could not query vapi_assistants: ${assistantErr.message}`, 'warn');
  } else {
    allVapiAssistants.push(...(linkedAssistants ?? []));
  }
}

// Orphaned test assistants
const { data: orphanAssistants, error: orphanAssistantErr } = await supabase
  .from('vapi_assistants')
  .select('*')
  .eq('is_test_assistant', true)
  .is('account_id', null);
if (orphanAssistantErr) {
  log(`Warning: could not query orphan vapi_assistants: ${orphanAssistantErr.message}`, 'warn');
} else {
  allVapiAssistants.push(...(orphanAssistants ?? []));
}
allVapiAssistants = Object.values(
  Object.fromEntries(allVapiAssistants.map(a => [a.id, a]))
);
log(`Found ${allVapiAssistants.length} vapi_assistant records to consider`, 'info');

// Also collect assistant IDs from accounts.vapi_assistant_id field
const accountAssistantIds = testAccounts
  .map(a => a.vapi_assistant_id)
  .filter(Boolean);
log(`Found ${accountAssistantIds.length} Vapi assistant IDs on accounts.vapi_assistant_id`, 'info');

// Fetch provisioning_jobs and profiles for backup
let provisioningJobs = [];
let profiles = [];
if (testAccountIds.length > 0) {
  const { data: jobs } = await supabase
    .from('provisioning_jobs')
    .select('*')
    .in('account_id', testAccountIds);
  provisioningJobs = jobs ?? [];

  const { data: profs } = await supabase
    .from('profiles')
    .select('*')
    .in('account_id', testAccountIds);
  profiles = profs ?? [];
}

log(`Found ${provisioningJobs.length} provisioning_jobs and ${profiles.length} profiles`, 'info');

// ============================================================================
// PHASE 1: BACKUP
// ============================================================================

header('Phase 1: Backup');

const ts = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = join(process.cwd(), 'backups', `cleanup-${ts}`);
mkdirSync(backupDir, { recursive: true });

const backupData = {
  accounts: testAccounts,
  phone_numbers: allPhoneNumbers,
  vapi_assistants: allVapiAssistants,
  provisioning_jobs: provisioningJobs,
  profiles,
  account_vapi_assistant_ids: accountAssistantIds,
};

for (const [name, data] of Object.entries(backupData)) {
  const filePath = join(backupDir, `${name}.json`);
  writeFileSync(filePath, JSON.stringify(data, null, 2));
  log(`Backed up ${Array.isArray(data) ? data.length : Object.keys(data).length} ${name} records → ${filePath}`, 'success');
}

log(`All backups written to ${backupDir}`, 'success');

// ============================================================================
// PHASE 2: DELETE VAPI ASSISTANTS
// ============================================================================

header('Phase 2: Delete Vapi Assistants');

// Collect all unique Vapi assistant IDs to process
const vapiAssistantIdsFromTable = new Set(
  allVapiAssistants.map(a => a.vapi_assistant_id).filter(Boolean)
);
const allVapiAssistantIds = new Set([
  ...vapiAssistantIdsFromTable,
  ...accountAssistantIds,
]);

console.log(`\n  Processing ${allVapiAssistantIds.size} unique Vapi assistant IDs...`);

for (const assistantId of allVapiAssistantIds) {
  if (PROTECTED_VAPI_ASSISTANTS.has(assistantId)) {
    log(`PROTECTED — skipping assistant: ${assistantId}`, 'skip');
    report.vapiAssistantsSkippedProtected.push(assistantId);
    continue;
  }
  const deleted = await deleteVapiAssistant(assistantId);
  if (deleted) {
    report.vapiAssistantsDeleted.push(assistantId);
  }
}

// ============================================================================
// PHASE 3: DELETE VAPI PHONE OBJECTS
// ============================================================================

header('Phase 3: Delete Vapi Phone Objects');
console.log(`\n  Processing ${allPhoneNumbers.length} phone number records...`);

for (const phone of allPhoneNumbers) {
  const phoneNum = phone.e164_number || phone.phone_number;
  if (!phone.vapi_phone_id) {
    log(`No vapi_phone_id — skipping ${phoneNum}`, 'skip');
    continue;
  }
  if (isProtectedPhone(phoneNum)) {
    log(`PROTECTED — skipping Vapi phone object for ${phoneNum}`, 'skip');
    continue;
  }
  const deleted = await deleteVapiPhoneObject(phone.vapi_phone_id, phoneNum);
  if (deleted) {
    report.vapPhoneObjectsDeleted.push({ phoneNumber: phoneNum, vapiPhoneId: phone.vapi_phone_id });
  }
}

// ============================================================================
// PHASE 4: RELEASE TWILIO NUMBERS
// ============================================================================

header('Phase 4: Release Twilio Numbers');
console.log(`\n  Processing ${allPhoneNumbers.length} phone number records...`);

for (const phone of allPhoneNumbers) {
  const phoneNum = phone.e164_number || phone.phone_number;

  if (isProtectedPhone(phoneNum)) {
    log(`PROTECTED — skipping Twilio release for ${phoneNum}`, 'skip');
    report.twilioNumbersSkippedProtected.push(phoneNum);
    continue;
  }

  if (phone.is_test_number) {
    log(`Test seed number (is_test_number=true) — no Twilio record to release: ${phoneNum}`, 'skip');
    report.twilioNumbersSkippedTestSeed.push(phoneNum);
    continue;
  }

  // Get Twilio SID
  let twilioSid = phone.provider_phone_number_id;
  if (!twilioSid) {
    log(`No provider_phone_number_id in DB — looking up Twilio SID for ${phoneNum}...`, 'info');
    try {
      twilioSid = await fetchTwilioSidByNumber(phoneNum);
    } catch (err) {
      log(`Could not look up Twilio SID for ${phoneNum}: ${err.message}`, 'error');
      report.errors.push({ type: 'twilio_sid_lookup', phone: phoneNum, error: err.message });
      continue;
    }
  }

  if (!twilioSid) {
    log(`No Twilio SID found for ${phoneNum} — may not be in Twilio inventory, skipping`, 'warn');
    continue;
  }

  const released = await releaseTwilioNumber(twilioSid, phoneNum);
  if (released) {
    report.twilioNumbersReleased.push({ phoneNumber: phoneNum, twilioSid });
  }
}

// ============================================================================
// PHASE 5: CLEAN DB RECORDS
// ============================================================================

header('Phase 5: Clean DB Records');

if (testAccountIds.length === 0) {
  log('No test accounts found — nothing to delete from DB', 'info');
} else {
  // 5a: provisioning_jobs
  console.log('\n  Deleting provisioning_jobs...');
  if (DRY_RUN) {
    log(`[DRY RUN] Would delete ${provisioningJobs.length} provisioning_jobs`, 'dry');
  } else {
    const { error, count } = await supabase
      .from('provisioning_jobs')
      .delete({ count: 'exact' })
      .in('account_id', testAccountIds);
    if (error) {
      log(`Error deleting provisioning_jobs: ${error.message}`, 'error');
      report.errors.push({ type: 'db_delete', table: 'provisioning_jobs', error: error.message });
    } else {
      report.dbRowsDeleted.provisioning_jobs = count ?? 0;
      log(`Deleted ${count ?? 0} provisioning_jobs`, 'success');
    }
  }

  // 5b: vapi_assistants table rows
  console.log('\n  Deleting vapi_assistants table rows...');
  const vapiAssistantTableIds = allVapiAssistants
    .filter(a => !PROTECTED_VAPI_ASSISTANTS.has(a.vapi_assistant_id))
    .map(a => a.id);

  if (DRY_RUN) {
    log(`[DRY RUN] Would delete ${vapiAssistantTableIds.length} vapi_assistants rows`, 'dry');
  } else if (vapiAssistantTableIds.length > 0) {
    const { error, count } = await supabase
      .from('vapi_assistants')
      .delete({ count: 'exact' })
      .in('id', vapiAssistantTableIds);
    if (error) {
      log(`Error deleting vapi_assistants: ${error.message}`, 'error');
      report.errors.push({ type: 'db_delete', table: 'vapi_assistants', error: error.message });
    } else {
      report.dbRowsDeleted.vapi_assistants = count ?? 0;
      log(`Deleted ${count ?? 0} vapi_assistants rows`, 'success');
    }
  }

  // 5c: phone_numbers
  console.log('\n  Deleting phone_numbers...');
  const phoneIdsToDelete = allPhoneNumbers
    .filter(p => !isProtectedPhone(p.e164_number || p.phone_number))
    .map(p => p.id);

  if (DRY_RUN) {
    log(`[DRY RUN] Would delete ${phoneIdsToDelete.length} phone_numbers rows`, 'dry');
  } else if (phoneIdsToDelete.length > 0) {
    const { error, count } = await supabase
      .from('phone_numbers')
      .delete({ count: 'exact' })
      .in('id', phoneIdsToDelete);
    if (error) {
      log(`Error deleting phone_numbers: ${error.message}`, 'error');
      report.errors.push({ type: 'db_delete', table: 'phone_numbers', error: error.message });
    } else {
      report.dbRowsDeleted.phone_numbers = count ?? 0;
      log(`Deleted ${count ?? 0} phone_numbers rows`, 'success');
    }
  }

  // 5d: accounts (cascades to profiles, phone_number_assignments)
  console.log('\n  Deleting accounts (cascade → profiles, phone_number_assignments)...');
  if (DRY_RUN) {
    log(`[DRY RUN] Would delete ${testAccountIds.length} accounts`, 'dry');
  } else {
    const { error, count } = await supabase
      .from('accounts')
      .delete({ count: 'exact' })
      .in('id', testAccountIds);
    if (error) {
      log(`Error deleting accounts: ${error.message}`, 'error');
      report.errors.push({ type: 'db_delete', table: 'accounts', error: error.message });
    } else {
      report.dbRowsDeleted.accounts = count ?? 0;
      log(`Deleted ${count ?? 0} accounts (cascade cleaned profiles + assignments)`, 'success');
    }
  }
}

// Note: auth.users are NOT deleted here — requires Supabase Admin API
log(
  'Note: auth.users records were NOT deleted (requires Supabase Admin API — out of scope)',
  'warn'
);

// ============================================================================
// FINAL REPORT
// ============================================================================

header('Final Report');

console.log(`
  Test accounts found:              ${report.accountsFound}
  Vapi assistants deleted:          ${report.vapiAssistantsDeleted.length}
  Vapi assistants skipped (prot.):  ${report.vapiAssistantsSkippedProtected.length}
  Vapi phone objects deleted:       ${report.vapPhoneObjectsDeleted.length}
  Twilio numbers released:          ${report.twilioNumbersReleased.length}
  Twilio skipped (protected):       ${report.twilioNumbersSkippedProtected.length}
  Twilio skipped (test seeds):      ${report.twilioNumbersSkippedTestSeed.length}
  DB: provisioning_jobs deleted:    ${report.dbRowsDeleted.provisioning_jobs}
  DB: vapi_assistants deleted:      ${report.dbRowsDeleted.vapi_assistants}
  DB: phone_numbers deleted:        ${report.dbRowsDeleted.phone_numbers}
  DB: accounts deleted:             ${report.dbRowsDeleted.accounts}
  Errors:                           ${report.errors.length}
`);

if (report.vapiAssistantsSkippedProtected.length > 0) {
  console.log('  🛡️  Protected Vapi assistants (preserved):');
  report.vapiAssistantsSkippedProtected.forEach(id => console.log(`    - ${id}`));
}

if (report.twilioNumbersSkippedProtected.length > 0) {
  console.log('\n  🛡️  Protected Twilio numbers (preserved):');
  report.twilioNumbersSkippedProtected.forEach(n => console.log(`    - ${n}`));
}

if (report.errors.length > 0) {
  console.log('\n  ❌ Errors:');
  report.errors.forEach(e => console.log(`    - [${e.type}] ${JSON.stringify(e)}`));
}

// Write report JSON
const reportPath = join(backupDir, 'report.json');
writeFileSync(reportPath, JSON.stringify(report, null, 2));
log(`Detailed report saved to ${reportPath}`, 'success');

if (DRY_RUN) {
  console.log('\n  ⚠️  This was a DRY RUN — no changes were made');
  console.log('  Run with --execute to actually delete resources');
}

console.log(`\n${'═'.repeat(60)}\n`);
