cat > env-audit.sh <<'EOF'
#!/usr/bin/env bash

echo "ENV AUDIT RUNNING"
echo

ROOT="$(pwd)"
echo "pwd: $ROOT"
echo

########################################
# 1) Local .env files
########################################
echo "==== 1) Local .env files ===="
for f in .env .env.local .env.production .env.development .env.example .env.provisioning.example; do
  if [ -f "$f" ]; then
    echo "--- $f ---"
    sed -E 's/=.*/=***redacted***/' "$f" | grep -v '^\s*$' || true
    echo
  fi
done

########################################
# 2) Variables referenced in code
########################################
echo "==== 2) Code references to env vars ===="
grep -RIn --exclude-dir=node_modules --exclude-dir=.git \
  -e 'VITE_SUPABASE_URL' \
  -e 'VITE_SUPABASE_ANON_KEY' \
  -e 'VITE_SUPABASE_PUBLISHABLE_KEY' \
  -e 'NEXT_PUBLIC_SUPABASE_URL' \
  -e 'NEXT_PUBLIC_SUPABASE_ANON_KEY' \
  -e 'SUPABASE_URL' \
  -e 'SUPABASE_SERVICE_ROLE_KEY' \
  src app supabase 2>/dev/null || echo "(no matches)"
echo

########################################
# 3) Redirects pointing to old Supabase projects
########################################
echo "==== 3) Redirects ===="
if [ -f ./public/_redirects ]; then
  echo "--- public/_redirects ---"
  cat ./public/_redirects
else
  echo "(no _redirects file found)"
fi
echo

########################################
# 4) Hardcoded Supabase project refs
########################################
echo "==== 4) Hardcoded Supabase refs in repo ===="
grep -RIn --exclude-dir=node_modules --exclude-dir=.git \
  -e '\.supabase\.co' \
  -e 'project-ref' \
  -e 'SUPABASE_URL=' \
  . 2>/dev/null || echo "(no matches)"
echo

########################################
# 5) Summary
########################################
echo "==== 5) Summary of required env vars ===="
cat <<'SUMMARY'
Frontend (Netlify / Vite bundle):
- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY

Backend (Netlify serverless + Supabase functions):
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

Notes:
- DO NOT expose service role in Vite builds.
- Ensure only ONE Supabase project exists in all code.
- Ensure redirects do not point to old projects.
SUMMARY

echo
echo "ENV AUDIT COMPLETE"
EOF

chmod +x env-audit.sh
