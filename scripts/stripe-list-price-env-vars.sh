#!/usr/bin/env bash
set -euo pipefail

if ! command -v stripe >/dev/null 2>&1; then
  echo "ERROR: stripe CLI is not installed. Install from https://docs.stripe.com/stripe-cli" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required." >&2
  exit 1
fi

# Ensure CLI can auth before pulling data.
if ! stripe config --format json >/dev/null 2>&1; then
  echo "ERROR: stripe CLI is not authenticated. Run: stripe login" >&2
  exit 1
fi

plans=(night_weekend lite core pro)

prices_json="$(stripe prices list --active --limit 100 --format json)"

echo "# Stripe price IDs for new pricing env vars"
echo

for plan in "${plans[@]}"; do
  env_key="${plan^^}"

  base_price_id="$(jq -r --arg plan "$plan" '
    .data
    | map(select(.metadata.plan_key == $plan and .metadata.price_type == "base" and .recurring.usage_type != "metered"))
    | .[0].id // ""
  ' <<<"$prices_json")"

  overage_price_id="$(jq -r --arg plan "$plan" '
    .data
    | map(select(.metadata.plan_key == $plan and .metadata.price_type == "overage" and .recurring.usage_type == "metered"))
    | .[0].id // ""
  ' <<<"$prices_json")"

  if [[ -z "$base_price_id" ]]; then
    echo "WARN: missing base price for plan '$plan'" >&2
  fi

  if [[ -z "$overage_price_id" ]]; then
    echo "WARN: missing overage price for plan '$plan'" >&2
  fi

  echo "STRIPE_PRICE_ID_${env_key}=${base_price_id}"
  echo "STRIPE_OVERAGE_PRICE_ID_${env_key}=${overage_price_id}"
  echo

done
