#!/usr/bin/env node

/**
 * Integration test for capture-signup-lead Edge Function
 *
 * This script validates that the capture-signup-lead function is publicly accessible
 * and does not require JWT authentication.
 *
 * Usage:
 *   SUPABASE_URL=<url> SUPABASE_ANON_KEY=<key> node scripts/test-capture-signup-lead.mjs
 */

import { exit } from 'process';

// Read environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
  console.error('❌ Error: SUPABASE_URL environment variable is required');
  exit(1);
}

if (!SUPABASE_ANON_KEY) {
  console.error('❌ Error: SUPABASE_ANON_KEY environment variable is required');
  exit(1);
}

// Construct endpoint URL
const endpoint = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/capture-signup-lead`;

console.log('🧪 Testing capture-signup-lead function...');
console.log(`📍 Endpoint: ${endpoint}`);
console.log('');

// Test payload
const payload = {
  email: `ci-test-${Date.now()}@example.com`,
  full_name: 'CI Test User',
  source: 'ci-test',
  signup_flow: 'integration-test',
};

try {
  // Make request with ONLY apikey header (no Authorization)
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(payload),
  });

  console.log(`📊 Response Status: ${response.status} ${response.statusText}`);

  // Check if response is 2xx
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unable to read error body');
    console.error('❌ Test Failed: Non-2xx status code received');
    console.error(`Error details: ${errorText}`);
    exit(1);
  }

  // Try to parse response body
  let body;
  try {
    body = await response.json();
    console.log('📄 Response Body:', JSON.stringify(body, null, 2));
  } catch (e) {
    console.log('⚠️  Response body is not JSON (this may be OK)');
  }

  console.log('');
  console.log('✅ Test Passed: capture-signup-lead is publicly accessible');
  console.log('✅ JWT verification is correctly disabled');
  exit(0);

} catch (error) {
  console.error('❌ Test Failed: Request error');
  console.error(error.message);
  exit(1);
}
