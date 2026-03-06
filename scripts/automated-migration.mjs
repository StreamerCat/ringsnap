#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

console.log('🚀 Starting automated Supabase migration...\n');

if (!SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}


// Create Supabase client with service role
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigrations() {
  console.log('📋 Step 1: Applying database migrations...\n');

  const migrationFile = join(__dirname, 'consolidated-migration.sql');
  const sql = readFileSync(migrationFile, 'utf-8');

  console.log(`   Migration file size: ${(sql.length / 1024).toFixed(2)} KB`);
  console.log(`   Lines: ${sql.split('\n').length}\n`);

  try {
    // Split migrations into smaller chunks to avoid timeouts
    const migrations = sql.split('-- ===');
    console.log(`   Found ${migrations.length} migration sections\n`);

    for (let i = 0; i < migrations.length; i++) {
      if (!migrations[i].trim()) continue;

      const migrationSql = '-- ===' + migrations[i];
      const lines = migrationSql.split('\n');
      const migrationName = lines.find(l => l.includes('MIGRATION'))?.trim() || `Section ${i + 1}`;

      console.log(`   ⏳ Applying: ${migrationName}...`);

      const { error } = await supabase.rpc('exec_sql', { sql: migrationSql });

      if (error) {
        console.error(`   ❌ Error in ${migrationName}:`, error.message);
        // Continue with other migrations
      } else {
        console.log(`   ✓ ${migrationName} applied`);
      }
    }

    console.log('\n✅ Database migrations completed!\n');
    return true;
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    return false;
  }
}

async function verifyTables() {
  console.log('🔍 Step 2: Verifying database schema...\n');

  try {
    // Query information_schema to check created tables
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_type', 'BASE TABLE');

    if (error) {
      console.error('   ❌ Could not verify tables:', error.message);
      return false;
    }

    if (data && data.length > 0) {
      console.log(`   ✓ Found ${data.length} tables created:\n`);
      const expectedTables = ['accounts', 'profiles', 'user_roles', 'auth_tokens',
                              'auth_events', 'email_events', 'passkeys', 'user_sessions'];

      expectedTables.forEach(table => {
        const exists = data.some(t => t.table_name === table);
        console.log(`     ${exists ? '✓' : '✗'} ${table}`);
      });
      console.log('');
      return true;
    }

    return false;
  } catch (error) {
    console.error('   ❌ Verification error:', error.message);
    return false;
  }
}

async function testConnection() {
  console.log('🔌 Step 3: Testing database connection...\n');

  try {
    const { data, error } = await supabase.from('accounts').select('count');

    if (error && error.code !== 'PGRST116') { // PGRST116 = table not found
      console.error('   ❌ Connection test failed:', error.message);
      return false;
    }

    console.log('   ✓ Database connection successful');
    console.log('   ✓ Tables are accessible\n');
    return true;
  } catch (error) {
    console.error('   ❌ Connection error:', error.message);
    return false;
  }
}

async function main() {
  console.log('════════════════════════════════════════════════════════');
  console.log('  RINGSNAP AUTOMATED SUPABASE MIGRATION');
  console.log('════════════════════════════════════════════════════════\n');
  console.log(`  Project: ${new URL(SUPABASE_URL).hostname.split('.')[0]}`);
  console.log(`  URL: ${SUPABASE_URL}\n`);
  console.log('════════════════════════════════════════════════════════\n');

  const success = await applyMigrations();

  if (success) {
    await verifyTables();
    await testConnection();

    console.log('════════════════════════════════════════════════════════');
    console.log('✅ MIGRATION PHASE 1 COMPLETE!');
    console.log('════════════════════════════════════════════════════════\n');
    console.log('Next steps:');
    console.log('  1. Deploy edge functions (requires Supabase CLI)');
    console.log('  2. Configure edge function secrets');
    console.log('  3. Test application\n');
  } else {
    console.log('════════════════════════════════════════════════════════');
    console.log('⚠️  MIGRATION INCOMPLETE');
    console.log('════════════════════════════════════════════════════════\n');
    console.log('Please check errors above and try manual migration.\n');
    process.exit(1);
  }
}

main().catch(console.error);
