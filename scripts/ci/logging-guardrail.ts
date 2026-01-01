#!/usr/bin/env -S deno run --allow-read
/**
 * CI Logging Guardrail
 *
 * Ensures critical Edge Functions maintain proper logging coverage:
 * 1. No raw console.log in critical directories (except logger module)
 * 2. Changed critical Edge Function files must include step logging
 */

import * as path from "https://deno.land/std@0.208.0/path/mod.ts";

// Critical Edge Function patterns that require step logging
const CRITICAL_PATTERNS = [
  "supabase/functions/create-trial/**",
  "supabase/functions/provision-phone-number/**",
  "supabase/functions/booking-schedule/**",
  "supabase/functions/vapi-tools-appointments/**",
  "supabase/functions/provision/**",
  "supabase/functions/provision-vapi/**",
];

// Files excluded from console.log check
const CONSOLE_LOG_EXCLUSIONS = [
  "supabase/functions/_shared/logging.ts",
  "supabase/functions/_shared/observability.ts",
];

interface LintResult {
  filePath: string;
  violations: string[];
}

/**
 * Check if file path matches any critical pattern
 */
function matchesCriticalPattern(filePath: string): boolean {
  return CRITICAL_PATTERNS.some((pattern) => {
    const regexPattern = pattern
      .replace(/\*\*/g, ".*")
      .replace(/\*/g, "[^/]*")
      .replace(/\//g, "\\/");
    return new RegExp(regexPattern).test(filePath);
  });
}

/**
 * Check if file is excluded from console.log checks
 */
function isExcludedFromConsoleCheck(filePath: string): boolean {
  return CONSOLE_LOG_EXCLUSIONS.some((excluded) => filePath.includes(excluded));
}

/**
 * Lint a single file for logging violations
 */
async function lintFile(filePath: string): Promise<LintResult> {
  const violations: string[] = [];

  try {
    const content = await Deno.readTextFile(filePath);
    const lines = content.split("\n");

    const isCritical = matchesCriticalPattern(filePath);
    const isExcluded = isExcludedFromConsoleCheck(filePath);

    // Check 1: No raw console.log in critical files (unless excluded)
    if (isCritical && !isExcluded) {
      const consoleLogPattern = /(?<!\/\/\s*)console\.(log|info|warn|error)\s*\(/;

      lines.forEach((line, index) => {
        if (consoleLogPattern.test(line)) {
          // Allow console.log inside JSON.stringify or specific debug contexts
          const isInJsonStringify = /JSON\.stringify/.test(line);
          const isDebugLog = /\[.*\]/.test(line); // Allow tagged debug logs like [FUNCTION_NAME]

          if (!isInJsonStringify && !isDebugLog) {
            violations.push(
              `Line ${index + 1}: Found raw console.${line.match(/console\.(\w+)/)?.[1]} - use stepStart/stepEnd/stepError instead`
            );
          }
        }
      });
    }

    // Check 2: Critical files must have step logging imports and usage
    if (isCritical && filePath.endsWith(".ts")) {
      const hasStepImport =
        /from\s+["'].*\/logging\.ts["']/.test(content) &&
        /(stepStart|stepEnd|stepError)/.test(content);

      const hasStepUsage = /(stepStart|stepEnd|stepError)\s*\(/.test(content);

      if (!hasStepImport) {
        violations.push(
          "Missing step logging import from _shared/logging.ts (must import stepStart/stepEnd/stepError)"
        );
      }

      if (!hasStepUsage && !filePath.includes("index.ts")) {
        // Allow helper files to not have direct step usage
        // But main index.ts files must use step logging
      } else if (!hasStepUsage && filePath.includes("index.ts")) {
        violations.push(
          "No step logging usage found (must call stepStart/stepEnd at least once)"
        );
      }
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      violations.push(`File not found: ${filePath}`);
    } else {
      violations.push(`Error reading file: ${error.message}`);
    }
  }

  return { filePath, violations };
}

/**
 * Get list of changed files from git diff
 * Falls back to linting all critical files if not in a git repo
 */
async function getChangedFiles(): Promise<string[]> {
  try {
    // Try to get changed files from git
    const process = new Deno.Command("git", {
      args: ["diff", "--name-only", "--diff-filter=ACMR", "HEAD"],
      stdout: "piped",
      stderr: "piped",
    });

    const { stdout, success } = await process.output();

    if (success) {
      const output = new TextDecoder().decode(stdout);
      const files = output
        .split("\n")
        .filter((f) => f.endsWith(".ts") && matchesCriticalPattern(f));

      if (files.length > 0) {
        console.log(`📋 Found ${files.length} changed critical files to lint`);
        return files;
      }
    }

    // Fallback: lint all critical files
    console.log("⚠️  No git changes detected, linting all critical files...");
    return await getAllCriticalFiles();
  } catch {
    // Not in a git repo or git not available - lint all critical files
    console.log("⚠️  Git not available, linting all critical files...");
    return await getAllCriticalFiles();
  }
}

/**
 * Recursively find all TypeScript files matching critical patterns
 */
async function getAllCriticalFiles(): Promise<string[]> {
  const files: string[] = [];

  async function walk(dir: string) {
    try {
      for await (const entry of Deno.readDir(dir)) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory) {
          await walk(fullPath);
        } else if (entry.isFile && entry.name.endsWith(".ts")) {
          if (matchesCriticalPattern(fullPath)) {
            files.push(fullPath);
          }
        }
      }
    } catch {
      // Directory doesn't exist or not accessible
    }
  }

  await walk("supabase/functions");
  return files;
}

/**
 * Main execution
 */
async function main() {
  console.log("🔍 RingSnap Logging Guardrail Check\n");

  const files = await getChangedFiles();

  if (files.length === 0) {
    console.log("✅ No critical files to check");
    Deno.exit(0);
  }

  console.log(`Checking ${files.length} file(s)...\n`);

  const results = await Promise.all(files.map(lintFile));

  const filesWithViolations = results.filter((r) => r.violations.length > 0);

  if (filesWithViolations.length === 0) {
    console.log("✅ All files pass logging guardrails!\n");
    Deno.exit(0);
  }

  // Print violations
  console.log("❌ Logging guardrail violations found:\n");

  filesWithViolations.forEach(({ filePath, violations }) => {
    console.log(`📄 ${filePath}`);
    violations.forEach((violation) => {
      console.log(`   ❌ ${violation}`);
    });
    console.log();
  });

  console.log("📖 Logging Guidelines:");
  console.log("   • Use stepStart() at the beginning of critical operations");
  console.log("   • Use stepEnd() when operations complete successfully");
  console.log("   • Use stepError() when operations fail");
  console.log("   • Avoid raw console.log - use structured logging instead");
  console.log("   • See docs/logging.md for detailed usage\n");

  Deno.exit(1);
}

if (import.meta.main) {
  await main();
}
