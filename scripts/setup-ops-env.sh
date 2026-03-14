#!/bin/bash
# Populate ringsnap_ops_flow/.env from the root .env file.
# Run from repo root: bash scripts/setup-ops-env.sh
set -e

ROOT_ENV=".env"
OPS_ENV="ringsnap_ops_flow/.env"
OPS_EXAMPLE="ringsnap_ops_flow/.env.example"

if [ ! -f "$ROOT_ENV" ]; then
  echo "❌  $ROOT_ENV not found. Run from repo root." && exit 1
fi

# Helper: extract a value from a key=value file by key name
get_env() {
  local key="$1" file="$2"
  grep -E "^${key}=" "$file" 2>/dev/null | head -1 | cut -d= -f2- | sed "s/^['\"]//;s/['\"]$//"
}

# Helper: set a key=value line in a file
set_env() {
  local key="$1" value="$2" file="$3"
  sed -i "s|^${key}=.*|${key}=${value}|" "$file"
}

echo "✅  Loaded $ROOT_ENV"

# root_key:ops_key pairs (space-separated, one per line for readability)
MAPPINGS=(
  "SUPABASE_URL:SUPABASE_URL"
  "SUPABASE_SERVICE_ROLE_KEY:SUPABASE_SERVICE_ROLE_KEY"
  "STRIPE_SECRET_KEY:STRIPE_SECRET_KEY"
  "VAPI_API_KEY:VAPI_API_KEY"
  "TWILIO_ACCOUNT_SID:TWILIO_ACCOUNT_SID"
  "TWILIO_AUTH_TOKEN:TWILIO_AUTH_TOKEN"
  "TWILIO_PHONE_NUMBER:TWILIO_FROM_NUMBER"
  "RESEND_PROD_KEY:RESEND_API_KEY"
)

# Start from the example file so structure / comments are preserved
cp "$OPS_EXAMPLE" "$OPS_ENV"

for mapping in "${MAPPINGS[@]}"; do
  root_key="${mapping%%:*}"
  ops_key="${mapping##*:}"
  value="$(get_env "$root_key" "$ROOT_ENV")"
  if [ -n "$value" ]; then
    set_env "$ops_key" "$value" "$OPS_ENV"
    echo "  ✔  $ops_key"
  else
    echo "  ⚠  $root_key not found in root .env — $ops_key left as placeholder"
  fi
done

echo ""
echo "📋  Vars that need manual values (not in root .env):"
echo "   ANTHROPIC_API_KEY     — https://console.anthropic.com/settings/keys"
echo "   STRIPE_OPS_WEBHOOK_SECRET — from Stripe dashboard (new webhook endpoint for ops service)"
echo "   OPS_WEBHOOK_SECRET    — run: openssl rand -hex 32"
echo "   VAPI_WEBHOOK_SECRET   — from Vapi dashboard"
echo ""
echo "📝  Open $OPS_ENV and fill in the remaining ??? values above."
echo "    File is gitignored — safe to fill in real secrets."
