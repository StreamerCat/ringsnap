#!/bin/bash
set -euo pipefail

# Only run in Claude Code remote sessions
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# ── 1. Install Node dependencies ─────────────────────────────────────────────
echo "[session-start] Installing npm dependencies..."
cd "${CLAUDE_PROJECT_DIR:-.}"
# Skip puppeteer browser download — Playwright is used for E2E tests instead
PUPPETEER_SKIP_DOWNLOAD=true npm install

# ── 2. Set up .env from template ─────────────────────────────────────────────
if [ ! -f .env ] && [ -f .env.example ]; then
  echo "[session-start] Creating .env from .env.example..."
  cp .env.example .env

  # Patch placeholder values so CI-style scripts and edge function tests work
  sed -i 's/sk_test_your_secret_key_here/sk_test_dummy_key/g'        .env
  sed -i 's/price_starter_plan_id/price_test_starter/g'              .env
  sed -i 's/price_professional_plan_id/price_test_prof/g'            .env
  sed -i 's/price_premium_plan_id/price_test_prem/g'                 .env
  sed -i 's/your-vapi-api-key/dummy_vapi_key/g'                      .env

  # Point SUPABASE_URL / VITE_ vars at the invariant local Supabase address so
  # unit tests and the dev server connect to the local stack without manual edits.
  # Keys below are the well-known Supabase CLI local-dev defaults (safe to commit).
  LOCAL_URL="http://127.0.0.1:54321"
  LOCAL_ANON="${VITE_SUPABASE_PUBLISHABLE_KEY:-local-anon-key}"
  LOCAL_SRK="${SUPABASE_SERVICE_ROLE_KEY:-local-service-role-key}"

  sed -i "s|SUPABASE_URL=.*|SUPABASE_URL=\"$LOCAL_URL\"|"                   .env
  sed -i "s|VITE_SUPABASE_URL=.*|VITE_SUPABASE_URL=\"$LOCAL_URL\"|"         .env
  sed -i "s|VITE_SUPABASE_PUBLISHABLE_KEY=.*|VITE_SUPABASE_PUBLISHABLE_KEY=\"$LOCAL_ANON\"|" .env
  sed -i "s|SUPABASE_SERVICE_ROLE_KEY=.*|SUPABASE_SERVICE_ROLE_KEY=\"$LOCAL_SRK\"|" .env
fi

# ── 3. Lint migrations (fast, no network — catches SQL errors before dev work) ─
echo "[session-start] Linting migrations..."
bash .github/scripts/lint-migrations.sh

# ── 4. Install Playwright browsers (chromium only, for smoke tests) ───────────
echo "[session-start] Installing Playwright chromium browser..."
npx playwright install chromium || true

echo "[session-start] Setup complete."
