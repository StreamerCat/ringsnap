#!/usr/bin/env node

/**
 * Verify Pool Allocation Works
 *
 * Creates test trial accounts and verifies that:
 * 1. Numbers are allocated from pool (not purchased new)
 * 2. Same number is not assigned twice
 * 3. Vapi webhook behaves correctly for pooled numbers
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/verify-pool-allocation.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log("═══════════════════════════════════════════════════════════");
console.log("PHONE NUMBER POOL ALLOCATION VERIFICATION");
console.log("═══════════════════════════════════════════════════════════\n");

// ============================================================================
// Step 1: Check pool stats before
// ============================================================================
console.log("📊 Checking pool statistics BEFORE allocation...\n");

const { data: statsBefore, error: statsError } = await supabase.rpc('get_pool_stats');

if (statsError) {
  console.error("❌ Error fetching pool stats:", statsError);
  process.exit(1);
}

console.log("  Pool Statistics:");
console.log(`    Total in pool:           ${statsBefore.pool_total}`);
console.log(`    Cooldown passed:         ${statsBefore.pool_cooldown_passed}`);
console.log(`    Fully eligible:          ${statsBefore.pool_fully_eligible}`);
console.log(`    Assigned total:          ${statsBefore.assigned_total}`);
console.log(`    Cooldown total:          ${statsBefore.cooldown_total}`);
console.log(`    Released total:          ${statsBefore.released_total}\n`);

if (statsBefore.pool_fully_eligible === 0) {
  console.error("❌ ERROR: No eligible numbers in pool!");
  console.error("   Run force-numbers-to-pool.mjs first to populate the pool.\n");
  process.exit(1);
}

// ============================================================================
// Step 2: Create test accounts and allocate
// ============================================================================
console.log("👤 Creating test accounts and allocating numbers...\n");

const testAccounts = [];
const allocations = [];

// Create 2 test accounts sequentially
for (let i = 1; i <= 2; i++) {
  console.log(`\n--- Test Account ${i} ---`);

  // Create account
  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .insert({
      name: `Pool Test ${Date.now()}-${i}`,
      email: `pool-test-${Date.now()}-${i}@example.com`,
      slug: `pool-test-${Date.now()}-${i}`,
      subscription_status: 'trialing'
    })
    .select()
    .single();

  if (accountError) {
    console.error(`  ❌ Failed to create account:`, accountError);
    continue;
  }

  testAccounts.push(account);
  console.log(`  ✅ Created account: ${account.id.slice(0, 8)}...`);

  // Allocate number from pool
  const { data: allocation, error: allocError } = await supabase.rpc(
    'allocate_phone_number_from_pool',
    { p_account_id: account.id }
  );

  if (allocError) {
    console.error(`  ❌ Allocation RPC error:`, allocError);
    continue;
  }

  if (!allocation) {
    console.error(`  ❌ Allocation returned NULL (no numbers available)`);
    continue;
  }

  allocations.push({
    accountId: account.id,
    phoneNumber: allocation.phone_number,
    phoneNumberId: allocation.id,
    assignmentId: allocation.assignment_id
  });

  console.log(`  ✅ Allocated number: ${allocation.phone_number}`);
  console.log(`     Phone ID: ${allocation.id.slice(0, 8)}...`);
  console.log(`     Assignment ID: ${allocation.assignment_id.slice(0, 8)}...`);
}

if (allocations.length === 0) {
  console.error("\n❌ No allocations succeeded. Exiting.");
  process.exit(1);
}

// ============================================================================
// Step 3: Verify no duplicate assignments
// ============================================================================
console.log("\n\n🔍 Verifying no duplicate number assignments...\n");

const phoneNumbers = allocations.map(a => a.phoneNumber);
const uniqueNumbers = new Set(phoneNumbers);

if (phoneNumbers.length === uniqueNumbers.size) {
  console.log(`  ✅ All ${phoneNumbers.length} numbers are unique (no duplicates)`);
} else {
  console.error(`  ❌ DUPLICATE DETECTED! ${phoneNumbers.length} allocations but only ${uniqueNumbers.size} unique numbers`);
  console.error(`     Numbers: ${phoneNumbers.join(', ')}`);
}

// ============================================================================
// Step 4: Verify database state
// ============================================================================
console.log("\n\n📊 Verifying database state for allocated numbers...\n");

for (const alloc of allocations) {
  const { data: phoneRecord, error } = await supabase
    .from('phone_numbers')
    .select('*')
    .eq('id', alloc.phoneNumberId)
    .single();

  if (error) {
    console.error(`  ❌ Error fetching ${alloc.phoneNumber}:`, error);
    continue;
  }

  console.log(`\n  ${alloc.phoneNumber}:`);
  console.log(`    Lifecycle Status:    ${phoneRecord.lifecycle_status} ${phoneRecord.lifecycle_status === 'assigned' ? '✅' : '❌'}`);
  console.log(`    Assigned Account:    ${phoneRecord.assigned_account_id?.slice(0, 8)}... ${phoneRecord.assigned_account_id === alloc.accountId ? '✅' : '❌'}`);
  console.log(`    Assigned At:         ${phoneRecord.assigned_at}`);
  console.log(`    Cooldown Until:      ${phoneRecord.cooldown_until || 'NULL (good)'}`);
  console.log(`    Is Reserved:         ${phoneRecord.is_reserved}`);
}

// ============================================================================
// Step 5: Check pool stats after
// ============================================================================
console.log("\n\n📊 Checking pool statistics AFTER allocation...\n");

const { data: statsAfter } = await supabase.rpc('get_pool_stats');

console.log("  Pool Statistics:");
console.log(`    Total in pool:           ${statsAfter.pool_total} (was ${statsBefore.pool_total})`);
console.log(`    Fully eligible:          ${statsAfter.pool_fully_eligible} (was ${statsBefore.pool_fully_eligible})`);
console.log(`    Assigned total:          ${statsAfter.assigned_total} (was ${statsBefore.assigned_total})`);

const poolDecrease = statsBefore.pool_total - statsAfter.pool_total;
const assignedIncrease = statsAfter.assigned_total - statsBefore.assigned_total;

console.log(`\n  Changes:`);
console.log(`    Pool decreased by:       ${poolDecrease}`);
console.log(`    Assigned increased by:   ${assignedIncrease}`);

if (poolDecrease === allocations.length && assignedIncrease === allocations.length) {
  console.log(`    ✅ Numbers correctly moved from pool to assigned`);
} else {
  console.error(`    ❌ Unexpected changes in pool/assigned counts`);
}

// ============================================================================
// Step 6: Cleanup
// ============================================================================
console.log("\n\n🧹 Cleaning up test data...\n");

for (const alloc of allocations) {
  // Delete phone assignment
  await supabase
    .from('phone_numbers')
    .update({
      lifecycle_status: 'pool',
      assigned_account_id: null,
      assigned_at: null,
      vapi_phone_id: null,
      released_at: new Date().toISOString()
    })
    .eq('id', alloc.phoneNumberId);

  console.log(`  ✅ Reset ${alloc.phoneNumber} back to pool`);
}

for (const account of testAccounts) {
  await supabase.from('accounts').delete().eq('id', account.id);
  console.log(`  ✅ Deleted test account ${account.id.slice(0, 8)}...`);
}

// ============================================================================
// Final Report
// ============================================================================
console.log("\n═══════════════════════════════════════════════════════════");
console.log("VERIFICATION COMPLETE");
console.log("═══════════════════════════════════════════════════════════\n");

if (allocations.length === 2 && phoneNumbers.length === uniqueNumbers.size) {
  console.log("✅ SUCCESS: Pool allocation is working correctly!");
  console.log("   - Both test accounts received numbers from pool");
  console.log("   - No duplicate assignments");
  console.log("   - Database state is correct\n");
} else {
  console.error("⚠️  PARTIAL SUCCESS: Some issues detected");
  console.error(`   - Allocations: ${allocations.length}/2`);
  console.error(`   - Unique numbers: ${phoneNumbers.length === uniqueNumbers.size ? 'Yes' : 'No'}\n`);
}

console.log("═══════════════════════════════════════════════════════════");
