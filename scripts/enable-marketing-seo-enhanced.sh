#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

cp public/robots.enhanced.txt public/robots.txt
cp public/llms.enhanced.txt public/llms.txt

touch .env.production.local
if grep -q '^VITE_FEATURE_ENHANCED_MARKETING_SCHEMA=' .env.production.local; then
  sed -i 's/^VITE_FEATURE_ENHANCED_MARKETING_SCHEMA=.*/VITE_FEATURE_ENHANCED_MARKETING_SCHEMA=true/' .env.production.local
else
  echo 'VITE_FEATURE_ENHANCED_MARKETING_SCHEMA=true' >> .env.production.local
fi

echo "✅ Enhanced marketing SEO enabled. Rebuild/redeploy required to apply frontend schema toggle."
