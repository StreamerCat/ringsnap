cat > env-audit.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

echo "ENV AUDIT RUNNING"
echo

ROOT="$(pwd)"
echo "pwd: $ROOT"
echo

echo "==== 1) Local .env files ===="
for f in .env .env.local .env.production .env.development .env.example .env.provisioning.example; do
  if [ -f "$f" ]; then
    echo "--- $f ---"
    # show keys only, not values
    sed -E 's/=.*/=***redacted***/' "$f" | grep -v '^\s*$' || true
    echo
  fi
done

echo "==== 2) Vite/Next public vars referenced in code ===="
echo "Looking for VITE_ and NEXT_PUBLIC_ usage..."
grep -RIn --exclude-dir=node_modules --exclude-dir=.git \
  -e 'VITE_SUPABASE_URL' \
  -e 'VITE_SUPABASE_ANON_KEY' \
  -e 'VITE_SUPABASE_PUBLISHABLE_KEY' \
  -e 'NEXT_PUBLIC_SUPABASE_URL' \
  -e 'NEXT_PUBLIC_SUPABASE_ANON_KEY' \
  -e 'SUPABASE_URL' \
  -e 'SUPABASE_SERVICE_ROLE_KEY' \
  src app supabase || true
echo

echo "==== 3) Netlify redirects pointing to old projects ===="
if [ -f ./public/_redirects ]; then
  echo "--- public/_redirects ---"
  cat ./public/_redirects
  echo
fi

echo "==== 4) Supabase project refs hardcoded ===="
grep -RIn --exclude-dir=node_modules --exclude-dir=.git \
  -e '\.supabase\.co' \
  -e 'project-ref' \
  -e 'SUPABASE_URL=' \
  -e 'VITE_SUPABASE_URL=' \
  . || true
echo

echo "==== 5) Summary of what SHOULD exist ===="
cat <<'SUMMARY'
Frontend (Netlify + client bundle):
- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY   (this IS the anon/public key)
Optional if you use Next instead of Vite:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY

Server-only (Netlify functions, Supabase Edge Functions, scripts):
- SUPABASE_URL                    (same value as VITE_SUPABASE_URL, but server side)
- SUPABASE_SERVICE_ROLE_KEY       (NEVER prefixed with VITE_ or NEXT_PUBLIC_)
SUMMARY

echo
echo "ENV AUDIT COMPLETE"
EOF

chmod +x env-audit.sh
