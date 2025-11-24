#!/usr/bin/env bash
set -euo pipefail

echo "ENV AUDIT RUNNING"
ROOT_DIR="$(pwd)"
echo "Repo root: $ROOT_DIR"
echo

# Load .env if present (WITHOUT echoing secrets)
if [ -f ".env" ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  echo "Loaded .env"
else
  echo "No .env found"
fi
echo

echo "== Required environment variables (presence only) =="
required_vars=(
  "VITE_SUPABASE_URL"
  "VITE_SUPABASE_PUBLISHABLE_KEY"
  "SUPABASE_URL"
  "SUPABASE_SERVICE_ROLE_KEY"
  "STRIPE_SECRET_KEY"
  "STRIPE_WEBHOOK_SECRET"
  "VAPI_API_KEY"
  "SITE_URL"
)
for v in "${required_vars[@]}"; do
  if [ "${!v-}" != "" ]; then
    echo "  ✅ $v is set"
  else
    echo "  ❌ $v is NOT set"
  fi
done
echo

echo "== Supabase project refs found in repo =="
# Find all supabase.co hostnames, extract project refs
refs=$(grep -RhoE "https://[a-z0-9-]+\.supabase\.co" . \
  --exclude-dir=node_modules --exclude-dir=.git --exclude=*.lock --exclude=*.png --exclude=*.jpg --exclude=*.svg \
  | sed -E 's|https://([a-z0-9-]+)\.supabase\.co|\1|' \
  | sort -u)

if [ -z "$refs" ]; then
  echo "  (none found)"
else
  echo "$refs" | awk '{print "  - " $0}'
fi
echo

echo "== Any hardcoded Supabase URLs or refs in runtime code? =="
grep -RInE "supabase\.co|PROJECT_REF|VITE_SUPABASE_URL|SUPABASE_URL" src supabase app scripts \
  --exclude-dir=node_modules --exclude-dir=.git \
  | head -n 120
echo "  (showing first 120 matches)"
echo

echo "== Check for accidental exposure of service role key to client =="
# Any VITE_/NEXT_PUBLIC_ service role keys are dangerous
grep -RInE "(VITE_|NEXT_PUBLIC_).*(SERVICE_ROLE|SERVICE_KEY)" . \
  --exclude-dir=node_modules --exclude-dir=.git \
  | head -n 50 || true
echo

echo "== Verify local Supabase CLI link (if available) =="
if command -v supabase >/dev/null 2>&1; then
  supabase status 2>/dev/null || echo "supabase status failed (not linked or not running locally)"
  echo
  supabase link --project-ref "${SUPABASE_PROJECT_REF-}" 2>/dev/null || true
else
  echo "Supabase CLI not installed in this environment."
fi
echo

echo "== Done =="
