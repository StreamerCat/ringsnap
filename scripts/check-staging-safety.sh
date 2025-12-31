#!/bin/bash
# scripts/check-staging-safety.sh
# Fails if staging build or PR environment contains production keys

echo "🛡️ Checking for production keys in build environment..."

# Check env vars (assuming they are available in the shell environment)
# If this runs in Vercel build, VERCEL_ENV might be "preview" or "production"

if [[ "$VERCEL_ENV" == "production" ]]; then
  echo "✅ Production deployment detected. Skipping safety checks."
  exit 0
fi

FAILURE=0

# Check VITE_SUPABASE_URL
if [[ "$VITE_SUPABASE_URL" == *"your-project-ref.supabase.co"* ]]; then
   # This is just a placeholder check, replace with actual production project ID logic
   # If we want to ban 'rmyvvbqnccpfeyowidrq' (prod) in staging:
   if [[ "$VITE_SUPABASE_URL" == *"rmyvvbqnccpfeyowidrq"* ]]; then
     echo "❌ DANGER: Production Supabase URL detected in non-production build!"
     FAILURE=1
   fi
fi

# Check STRIPE keys in backend vars if visible (less likely in frontend build script)
# But we can check VITE_STRIPE_PUBLISHABLE_KEY
if [[ "$VITE_STRIPE_PUBLISHABLE_KEY" == *"pk_live_"* ]]; then
  echo "❌ DANGER: Live Stripe Key detected in non-production build!"
  FAILURE=1
fi

if [[ $FAILURE -eq 1 ]]; then
  echo "⛔ Staging Safety Guardrail Failed!"
  exit 1
fi

echo "✅ Staging environment appears safe (no production keys detected)."
exit 0
