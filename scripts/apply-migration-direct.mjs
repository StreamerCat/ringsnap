#!/usr/bin/env node

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const projectRef = (() => {
  try {
    const host = new URL(SUPABASE_URL).hostname;
    return host.endsWith('.supabase.co') ? host.replace('.supabase.co', '') : 'YOUR_PROJECT';
  } catch {
    return 'YOUR_PROJECT';
  }
})();

console.log('════════════════════════════════════════════════════════');
console.log('  RINGSNAP DIRECT MIGRATION');
console.log('════════════════════════════════════════════════════════\n');

console.log('⚠️  IMPORTANT NOTICE:\n');
console.log('The Supabase REST API does not support arbitrary SQL execution');
console.log('for security reasons. You must apply migrations via:\n');
console.log('1. Supabase Dashboard SQL Editor (RECOMMENDED)');
console.log('2. Direct PostgreSQL connection (psql)');
console.log('3. Supabase CLI\n');

console.log('════════════════════════════════════════════════════════');
console.log('  MANUAL MIGRATION INSTRUCTIONS');
console.log('════════════════════════════════════════════════════════\n');

console.log('✅ Quick Manual Migration (5 minutes):\n');
console.log('1. Open: https://supabase.com/dashboard/project/${projectRef}/sql/new\n');
console.log('2. Open file: scripts/consolidated-migration.sql');
console.log('3. Copy ALL contents (Ctrl+A, Ctrl+C)');
console.log('4. Paste into SQL Editor');
console.log('5. Click "Run" button (or F5)');
console.log('6. Wait ~30-60 seconds\n');

console.log('Expected outcome:');
console.log('  ✓ 18+ tables created');
console.log('  ✓ All RLS policies applied');
console.log('  ✓ All functions and triggers installed\n');

console.log('════════════════════════════════════════════════════════\n');

const migrationFile = join(__dirname, 'consolidated-migration.sql');
const sql = readFileSync(migrationFile, 'utf-8');

console.log(`Migration file ready:`);
console.log(`  Location: ${migrationFile}`);
console.log(`  Size: ${(sql.length / 1024).toFixed(2)} KB`);
console.log(`  Lines: ${sql.split('\n').length}`);
console.log('');

process.exit(0);
