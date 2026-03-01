#!/usr/bin/env bash
set -euo pipefail

# Quick rollback utility for enhanced marketing SEO/AI discoverability changes.
# Safe scope: metadata + static crawler files only.
#
# What it does:
# 1) Disables enhanced JSON-LD via env kill switch
# 2) Restores baseline public robots/llms content
# 3) Keeps backups of current files before replacing

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p .rollback-backups
cp public/robots.txt ".rollback-backups/robots.$(date +%Y%m%d-%H%M%S).txt"
cp public/llms.txt ".rollback-backups/llms.$(date +%Y%m%d-%H%M%S).txt"

cp public/robots.baseline.txt public/robots.txt
cp public/llms.baseline.txt public/llms.txt

touch .env.production.local
if grep -q '^VITE_FEATURE_ENHANCED_MARKETING_SCHEMA=' .env.production.local; then
  sed -i 's/^VITE_FEATURE_ENHANCED_MARKETING_SCHEMA=.*/VITE_FEATURE_ENHANCED_MARKETING_SCHEMA=false/' .env.production.local
else
  echo 'VITE_FEATURE_ENHANCED_MARKETING_SCHEMA=false' >> .env.production.local
fi

echo "✅ Rollback applied: baseline robots/llms restored and enhanced marketing schema disabled."
echo "ℹ️ Rebuild/redeploy required for frontend schema toggle to take effect."
