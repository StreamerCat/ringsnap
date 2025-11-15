/**
 * Centralized feature flags for auth providers.
 *
 * Google OAuth is temporarily disabled via an environment-controlled flag so
 * that it can be re-enabled without touching the UI logic.
 */
const env = import.meta.env as Record<string, string | undefined>;

const rawGoogleFlag =
  env.VITE_ENABLE_GOOGLE_OAUTH ??
  env.NEXT_PUBLIC_ENABLE_GOOGLE_OAUTH ??
  env.VITE_SUPABASE_ENABLE_GOOGLE_OAUTH; // legacy fallback just in case

const parseBoolean = (value?: string) => {
  if (!value) return false;
  return value === "1" || value.toLowerCase() === "true";
};

/**
 * Flag consumed across the app to determine whether Google OAuth should be
 * shown or invoked.
 *
 * TODO(google-oauth): Flip VITE_ENABLE_GOOGLE_OAUTH (or NEXT_PUBLIC_*) back to
 * true to re-enable the Google login option once the integration is ready.
 */
export const isGoogleOAuthEnabled = parseBoolean(rawGoogleFlag);

export const authProviderFlags = {
  google: isGoogleOAuthEnabled,
};
