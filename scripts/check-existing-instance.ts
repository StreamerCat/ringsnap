/**
 * Check Existing Supabase Instance
 *
 * This script connects to your existing Supabase instance and compares
 * its schema with what's expected from the migrations in this repo.
 *
 * Usage:
 *   1. Set environment variables:
 *      EXISTING_SUPABASE_URL=https://your-project.supabase.co
 *      EXISTING_SUPABASE_SERVICE_KEY=your-service-role-key
 *
 *   2. Run: npx tsx scripts/check-existing-instance.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Expected tables from migrations
const EXPECTED_TABLES = [
  'accounts',
  'profiles',
  'user_roles',
  'auth_tokens',
  'auth_events',
  'email_events',
  'passkeys',
  'user_sessions',
  'rate_limits',
  'staff_roles',
  'account_members',
  'account_credits',
  'phone_numbers',
  'provisioning_queue',
  'subscription_plans',
  'invoices',
  'referrals',
  'usage_records'
];

// Expected edge functions from repo
const EXPECTED_FUNCTIONS = [
  'accept-staff-invite',
  'authorize-call',
  'cleanup-database',
  'complete-onboarding',
  'create-sales-account',
  'create-staff-invite',
  'create-staff-user',
  'free-trial-signup',
  'get-available-area-codes',
  'handle-referral-signup',
  'handle-sms-inbound',
  'list-staff-users',
  'manage-phone-lifecycle',
  'manage-staff-role',
  'manage-team-member',
  'notify_number_ready',
  'provision',
  'provision-resources',
  'provision_number',
  'provision_number_retry',
  'require-step-up',
  'resend-webhook',
  'reset-monthly-usage',
  'search-vapi-numbers',
  'send-forwarding-instructions',
  'send-magic-link',
  'send-onboarding-sms',
  'send-password-reset',
  'send-sms-confirmation',
  'send-verification-code',
  'stripe-webhook',
  'sync-usage',
  'test-vapi-integration',
  'vapi-demo-call',
  'verify-code',
  'verify-magic-link'
];

interface AssessmentResult {
  summary: {
    hasProductionData: boolean;
    totalUsers: number;
    oldestUserDate: string | null;
    tableCount: number;
    matchScore: number;
  };
  tables: {
    expected: string[];
    found: string[];
    missing: string[];
    extra: string[];
  };
  data: {
    tableRowCounts: Record<string, number>;
    totalRows: number;
  };
  recommendation: 'NEW_PROJECT' | 'EXISTING_PROJECT' | 'HYBRID' | 'NEED_MORE_INFO';
  reasons: string[];
}

async function checkExistingInstance(): Promise<AssessmentResult> {
  const supabaseUrl = process.env.EXISTING_SUPABASE_URL;
  const supabaseKey = process.env.EXISTING_SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing environment variables!');
    console.error('Please set:');
    console.error('  EXISTING_SUPABASE_URL=https://your-project.supabase.co');
    console.error('  EXISTING_SUPABASE_SERVICE_KEY=your-service-role-key');
    process.exit(1);
  }

  console.log('🔍 Connecting to existing Supabase instance...');
  console.log(`   URL: ${supabaseUrl}\n`);

  const supabase = createClient(supabaseUrl, supabaseKey);

  const result: AssessmentResult = {
    summary: {
      hasProductionData: false,
      totalUsers: 0,
      oldestUserDate: null,
      tableCount: 0,
      matchScore: 0
    },
    tables: {
      expected: EXPECTED_TABLES,
      found: [],
      missing: [],
      extra: []
    },
    data: {
      tableRowCounts: {},
      totalRows: 0
    },
    recommendation: 'NEED_MORE_INFO',
    reasons: []
  };

  try {
    // Check auth.users
    console.log('📊 Checking user data...');
    const { data: users, error: usersError } = await supabase
      .from('auth.users')
      .select('created_at');

    if (!usersError && users) {
      result.summary.totalUsers = users.length;
      if (users.length > 0) {
        const dates = users.map(u => new Date(u.created_at)).sort();
        result.summary.oldestUserDate = dates[0].toISOString();

        // Check if oldest user is > 7 days old (production data indicator)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        result.summary.hasProductionData = dates[0] < sevenDaysAgo;
      }
    }

    // Check tables
    console.log('📋 Checking database schema...');
    const { data: tables, error: tablesError } = await supabase.rpc('get_tables', {});

    // If RPC doesn't exist, try querying information_schema directly
    const tablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

    const { data: tablesData, error: queryError } = await supabase.rpc('exec_sql', {
      sql: tablesQuery
    });

    if (tablesData) {
      result.tables.found = tablesData.map((t: any) => t.table_name);
      result.summary.tableCount = result.tables.found.length;
    }

    // Calculate missing and extra tables
    result.tables.missing = EXPECTED_TABLES.filter(
      t => !result.tables.found.includes(t)
    );
    result.tables.extra = result.tables.found.filter(
      t => !EXPECTED_TABLES.includes(t)
    );

    // Match score (0-100)
    const matchingTables = EXPECTED_TABLES.filter(t => result.tables.found.includes(t)).length;
    result.summary.matchScore = Math.round((matchingTables / EXPECTED_TABLES.length) * 100);

    // Get row counts for each table
    console.log('📈 Counting rows in each table...');
    for (const tableName of result.tables.found) {
      try {
        const { count } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        if (count !== null) {
          result.data.tableRowCounts[tableName] = count;
          result.data.totalRows += count;
        }
      } catch (e) {
        // Skip tables we can't access
        result.data.tableRowCounts[tableName] = -1;
      }
    }

    // Make recommendation
    console.log('\n🤔 Analyzing results...\n');

    if (result.summary.hasProductionData && result.summary.totalUsers > 10) {
      result.recommendation = 'HYBRID';
      result.reasons.push(`✓ Has ${result.summary.totalUsers} users with data older than 7 days`);
      result.reasons.push('✓ Recommend testing in new project, then migrating data');
    } else if (result.summary.matchScore > 80 && result.summary.totalUsers > 0) {
      result.recommendation = 'EXISTING_PROJECT';
      result.reasons.push(`✓ Schema matches ${result.summary.matchScore}%`);
      result.reasons.push(`✓ Has some data (${result.summary.totalUsers} users) worth preserving`);
      result.reasons.push('✓ Can reconcile differences and continue with existing project');
    } else if (result.summary.matchScore < 50) {
      result.recommendation = 'NEW_PROJECT';
      result.reasons.push(`✗ Schema match only ${result.summary.matchScore}%`);
      result.reasons.push(`✗ Significant differences detected (${result.tables.missing.length} missing, ${result.tables.extra.length} extra tables)`);
      result.reasons.push('✓ Starting fresh will be cleaner and faster');
    } else if (result.summary.totalUsers === 0 || result.summary.totalUsers < 5) {
      result.recommendation = 'NEW_PROJECT';
      result.reasons.push(`✓ No significant data to preserve (${result.summary.totalUsers} users)`);
      result.reasons.push('✓ Clean migration is better approach');
    } else {
      result.recommendation = 'NEED_MORE_INFO';
      result.reasons.push('⚠️  Inconclusive - manual review recommended');
    }

  } catch (error) {
    console.error('❌ Error checking instance:', error);
    throw error;
  }

  return result;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Existing Supabase Instance Assessment Tool');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    const result = await checkExistingInstance();

    // Display results
    console.log('═══════════════════════════════════════════════════════');
    console.log('  ASSESSMENT RESULTS');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('📊 SUMMARY');
    console.log('─────────────────────────────────────────────────────');
    console.log(`  Total Users:       ${result.summary.totalUsers}`);
    console.log(`  Production Data:   ${result.summary.hasProductionData ? 'YES ⚠️' : 'NO ✓'}`);
    console.log(`  Oldest User:       ${result.summary.oldestUserDate || 'N/A'}`);
    console.log(`  Tables Found:      ${result.summary.tableCount}`);
    console.log(`  Schema Match:      ${result.summary.matchScore}%`);
    console.log(`  Total Data Rows:   ${result.data.totalRows.toLocaleString()}\n`);

    console.log('📋 SCHEMA COMPARISON');
    console.log('─────────────────────────────────────────────────────');
    console.log(`  Expected Tables:   ${result.tables.expected.length}`);
    console.log(`  Found Tables:      ${result.tables.found.length}`);
    console.log(`  Missing Tables:    ${result.tables.missing.length}`);
    console.log(`  Extra Tables:      ${result.tables.extra.length}\n`);

    if (result.tables.missing.length > 0) {
      console.log('  Missing Tables:');
      result.tables.missing.forEach(t => console.log(`    - ${t}`));
      console.log();
    }

    if (result.tables.extra.length > 0) {
      console.log('  Extra Tables (not in migrations):');
      result.tables.extra.forEach(t => console.log(`    - ${t}`));
      console.log();
    }

    console.log('📈 DATA VOLUME');
    console.log('─────────────────────────────────────────────────────');
    const sortedTables = Object.entries(result.data.tableRowCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    console.log('  Top 10 tables by row count:');
    sortedTables.forEach(([table, count]) => {
      console.log(`    ${table.padEnd(30)} ${count.toLocaleString().padStart(10)} rows`);
    });
    console.log();

    console.log('═══════════════════════════════════════════════════════');
    console.log(`  RECOMMENDATION: ${result.recommendation}`);
    console.log('═══════════════════════════════════════════════════════\n');

    result.reasons.forEach(reason => console.log(`  ${reason}`));
    console.log();

    if (result.recommendation === 'NEW_PROJECT') {
      console.log('💡 SUGGESTED ACTION:');
      console.log('  1. Create a new Supabase project');
      console.log('  2. Apply all migrations from scratch');
      console.log('  3. Deploy all edge functions');
      console.log('  4. Start fresh with clean schema\n');
    } else if (result.recommendation === 'EXISTING_PROJECT') {
      console.log('💡 SUGGESTED ACTION:');
      console.log('  1. Link to existing project');
      console.log('  2. Create migration reconciliation script');
      console.log('  3. Apply missing migrations carefully');
      console.log('  4. Update/redeploy edge functions\n');
    } else if (result.recommendation === 'HYBRID') {
      console.log('💡 SUGGESTED ACTION:');
      console.log('  1. Create NEW project for testing');
      console.log('  2. Apply all migrations to new project');
      console.log('  3. Test thoroughly in new environment');
      console.log('  4. Export data from existing project');
      console.log('  5. Import data to new project');
      console.log('  6. Cutover to new project when ready\n');
    }

    // Save results to file
    const outputPath = path.join(process.cwd(), 'assessment-result.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`📄 Full results saved to: ${outputPath}\n`);

  } catch (error) {
    console.error('\n❌ Assessment failed:', error);
    process.exit(1);
  }
}

main();
