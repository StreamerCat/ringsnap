
// Repair Migration History Script
// Marks old migrations as 'applied' so db push doesn't fail on them.
// Usage: node scripts/repair-migrations.js

import { readdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const MIGRATIONS_DIR = './supabase/migrations';
// Target migrations that are causing conflicts (present remotely but push wants to re-insert)
// Based on output: 20251210... to 20251222...
const TARGET_PREFIXES = [
    '20251210',
    '20251211',
    '20251216',
    '20251217', // If any
    '20251222'
];

console.log("Starting Migration Repair (Phase 2)...");
console.log(`Marking intermediate conflicting migrations as APPLIED.`);

try {
    const files = readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort(); // Ensure chronological order

    let count = 0;

    for (const file of files) {
        // Extract version timestamp (first part of filename)
        const version = file.split('_')[0];

        // Check if this version matches our target list of conflicts
        const isTarget = TARGET_PREFIXES.some(prefix => version.startsWith(prefix));

        if (!isTarget) {
            // Skip non-targets (older already repaired, newer are to be pushed)
            continue;
        }

        // Also skip the 9999 debug ones if you want, or mark them applied?
        // Usually safe to mark them applied to avoid errors if they are just debug views.
        // But if they are strictly local debug, maybe ignore? 
        // Let's mark them applied to be safe and clear the queue.

        console.log(`Marking APPLIED: ${version} (${file})`);

        try {
            // Using npx supabase to rely on local install
            execSync(`npx supabase migration repair --status applied ${version}`, { stdio: 'inherit' });
            count++;
        } catch (e) {
            console.error(`Failed to repair ${version}:`, e.message);
            // Don't exit, try next? Or exit? safely exit to avoid partial state confusion?
            // Usually idempotent, so continue.
        }
    }

    console.log(`\nRepair Complete. ${count} migrations marked as applied.`);
    console.log("You can now run: npx supabase db push");

} catch (e) {
    console.error("Error reading directory:", e);
}
