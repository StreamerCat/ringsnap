#!/usr/bin/env node
/**
 * lhci-summary.mjs
 *
 * Reads Lighthouse CI report files from .lighthouseci/ and prints a
 * human-readable summary to stdout. Useful for local review after
 * running `npm run test:lhci`.
 *
 * Usage:
 *   node scripts/lhci-summary.mjs [--dir .lighthouseci]
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const dir = process.argv.includes('--dir')
  ? process.argv[process.argv.indexOf('--dir') + 1]
  : '.lighthouseci';

if (!existsSync(dir)) {
  console.error(`No Lighthouse CI output found in ${dir}. Run npm run test:lhci first.`);
  process.exit(1);
}

const lhrFiles = readdirSync(dir)
  .filter((f) => f.startsWith('lhr-') && f.endsWith('.json'))
  .sort();

if (lhrFiles.length === 0) {
  console.error(`No LHR files found in ${dir}.`);
  process.exit(1);
}

// Group by URL path, keep last run (highest sort = most recent)
const reportsByUrl = {};
for (const file of lhrFiles) {
  const data = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  const urlPath = new URL(data.finalUrl).pathname || '/';
  reportsByUrl[urlPath] = data;
}

const pct = (v) => (v == null ? 'N/A  ' : String(Math.round(v * 100)).padStart(3) + ' ');
const bar = (v) => {
  if (v == null) return '░░░░░';
  const filled = Math.round(v * 5);
  return '█'.repeat(filled) + '░'.repeat(5 - filled);
};
const grade = (v) => {
  if (v == null) return ' ';
  if (v >= 0.9) return '✅';
  if (v >= 0.7) return '⚠️ ';
  return '❌';
};

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  Lighthouse CI Summary');
console.log('═══════════════════════════════════════════════════════════\n');

for (const [urlPath, lhr] of Object.entries(reportsByUrl).sort()) {
  const cats = lhr.categories;
  const perf = cats.performance?.score;
  const a11y = cats.accessibility?.score;
  const bp   = cats['best-practices']?.score;
  const seo  = cats.seo?.score;

  console.log(`  Route: ${urlPath}`);
  console.log(`  ┌────────────────┬───────┬───────┐`);
  console.log(`  │ Category       │ Score │ Grade │`);
  console.log(`  ├────────────────┼───────┼───────┤`);
  console.log(`  │ Performance    │  ${pct(perf)}│  ${grade(perf)}  │`);
  console.log(`  │ Accessibility  │  ${pct(a11y)}│  ${grade(a11y)}  │`);
  console.log(`  │ Best Practices │  ${pct(bp)}│  ${grade(bp)}  │`);
  console.log(`  │ SEO            │  ${pct(seo)}│  ${grade(seo)}  │`);
  console.log(`  └────────────────┴───────┴───────┘`);

  // Surface top performance opportunities
  const audits = lhr.audits || {};
  const opportunities = Object.values(audits)
    .filter(
      (a) =>
        a.details?.type === 'opportunity' &&
        a.numericValue > 0 &&
        a.score != null &&
        a.score < 1
    )
    .sort((a, b) => (b.numericValue || 0) - (a.numericValue || 0))
    .slice(0, 3);

  if (opportunities.length > 0) {
    console.log(`\n  Top opportunities:`);
    for (const opp of opportunities) {
      const saving = opp.numericValue ? ` (~${(opp.numericValue / 1000).toFixed(1)}s)` : '';
      console.log(`    • ${opp.title}${saving}`);
    }
  }

  console.log();
}

// Surface assertion failures if present
const assertFile = join(dir, 'assertion-results.json');
if (existsSync(assertFile)) {
  const assertions = JSON.parse(readFileSync(assertFile, 'utf8'));
  const failures = assertions.filter((a) => a.level === 'error' && !a.passed);
  if (failures.length > 0) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  ❌ ${failures.length} assertion failure(s):`);
    console.log('═══════════════════════════════════════════════════════════');
    for (const f of failures) {
      const path = new URL(f.url).pathname;
      console.log(`  • [${path}] ${f.auditId}: got ${f.actual}, expected ${f.operator} ${f.expected}`);
    }
    console.log();
    process.exit(1);
  }
}

console.log('  All assertions passed ✅\n');
