#!/usr/bin/env bash
set -euo pipefail

EXPECTED_REF="rmyvvbqnccpfeyowidrq"
EXPECTED_URL="https://${EXPECTED_REF}.supabase.co"

echo ""
echo "=============================="
echo " RingSnap Environment Audit"
echo " Expected ref:  ${EXPECTED_REF}"
echo " Expected url:  ${EXPECTED_URL}"
echo "=============================="
echo ""

echo "1) Local env files"
for f in .env .env.local .env.development .env.production .env.example .env.provisioning.example; do
  if [ -f "$f" ]; then
    echo ""
    echo "---- $f ----"
    grep -E "SUPABASE_URL|VITE_SUPABASE_URL|PUBLISHABLE_KEY|ANON_KEY|SERVICE_ROLE_KEY|PROJECT_REF" "$f" || true
  fi
done

echo ""
echo "2) Search for Supabase URLs in repo"
grep -RIn --exclude-dir=node_modules --exclude-dir=.git \
  -E "supabase\.co|SUPABASE_URL|VITE_SUPABASE_URL|PROJECT_REF" . || true

echo ""
echo "3) Search for old project refs (common drift)"
grep -RIn --exclude-dir=node_modules --exclude-dir=.git \
  -E "lytnlrkdccqmxgdmdxef|jwoprcqnvheuljjxwrbu|placeholder\.supabase\.co" . || true

echo ""
echo "4) Check Supabase CLI linked project"
if command -v supabase >/dev/null 2>&1; then
  echo "supabase status:"
  supabase status || true

  echo ""
  echo "supabase projects linked in .supabase/config.toml:"
  if [ -f ".supabase/config.toml" ]; then
    cat .supabase/config.toml
  else
    echo "No .supabase/config.toml found."
  fi
else
  echo "Supabase CLI not installed, skipping CLI checks."
fi

echo ""
echo "5) Check Netlify redirects for wrong targets"
if [ -f "public/_redirects" ]; then
  echo "public/_redirects:"
  cat public/_redirects
else
  echo "No public/_redirects found."
fi

echo ""
echo "6) Check Stripe/Vapi webhook URLs in docs and config"
grep -RIn --exclude-dir=node_modules --exclude-dir=.git \
  -E "stripe-webhook|webhook|vapi|functions\.supabase\.co" . || true

echo ""
echo "=============================="
echo " Audit complete."
echo "=============================="
echo ""
echo "If you see ANY URL or ref that is not:"
echo "  ${EXPECTED_URL}"
echo "or ref not equal to:"
echo "  ${EXPECTED_REF}"
echo "that is a live drift point."
echo ""
