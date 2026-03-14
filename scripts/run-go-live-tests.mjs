#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const checks = [
  {
    name: 'Integration/contract tests',
    cmd: 'npm',
    args: ['run', 'test:go-live:integration'],
    blockerOnFail: true,
  },
  {
    name: 'E2E smoke tests',
    cmd: 'npm',
    args: ['run', 'test:go-live:e2e'],
    blockerOnFail: true,
  },
];

const passed = [];
const failed = [];

for (const check of checks) {
  console.log(`\n▶ ${check.name}`);
  const result = spawnSync(check.cmd, check.args, { stdio: 'inherit', env: process.env });

  if (result.status === 0) {
    passed.push(check.name);
  } else {
    failed.push({
      name: check.name,
      exitCode: result.status ?? 1,
      suspectedRootCause:
        check.name === 'E2E smoke tests'
          ? 'App server/base URL unreachable, or unauthenticated redirect behavior changed.'
          : 'Edge function contracts diverged or ER relationship assumptions changed.',
      blocker: check.blockerOnFail,
    });
  }
}

const blockers = failed.filter((f) => f.blocker);

console.log('\n================ GO-LIVE READINESS REPORT ================');
console.log(`✅ Passed tests (${passed.length}):`);
for (const name of passed) console.log(`  - ${name}`);

if (failed.length) {
  console.log(`\n❌ Failed tests (${failed.length}):`);
  for (const f of failed) {
    console.log(`  - ${f.name}: exit code ${f.exitCode}`);
    console.log(`    suspected root cause: ${f.suspectedRootCause}`);
  }
}

console.log('\nBlockers:');
if (!blockers.length) {
  console.log('  - None');
} else {
  for (const b of blockers) console.log(`  - ${b.name}`);
}

process.exit(failed.length ? 1 : 0);
