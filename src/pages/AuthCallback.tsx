/**
 * Handles Supabase OAuth callback by exchanging the authorization code for a session.
 */
import { useEffect, useMemo, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { redirectToRoleDashboard } from "@/lib/auth/redirects";
import { identify } from "@/lib/analytics";

const ERROR_REDIRECT = "/signin";
const EXCHANGE_TIMEOUT_MS = 10000; // 10 second timeout

export default function AuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const [message, setMessage] = useState("Signing you in...");
  const hasRun = useRef(false);

  const { code, next, error: urlError } = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return {
      code: params.get("code"),
      next: params.get("next"),
      error: params.get("error"),
    };
  }, [location.search]);

  useEffect(() => {
    // Prevent double execution in StrictMode
    if (hasRun.current) return;
    hasRun.current = true;

    const exchange = async () => {
      // Check for OAuth errors in URL
      if (urlError) {
        console.error("OAuth error from provider:", urlError);
        setMessage("Authentication was cancelled or failed.");
        setTimeout(() => {
          navigate(`${ERROR_REDIRECT}?error=${encodeURIComponent(urlError)}`, { replace: true });
        }, 1500);
        return;
      }

      // Check if we have a code
      if (!code) {
        console.error("No authorization code in callback URL");
        navigate(`${ERROR_REDIRECT}?error=missing_code`, { replace: true });
        return;
      }

      // Check if Supabase is configured
      if (!isSupabaseConfigured) {
        console.error("Cannot complete OAuth: Supabase is not configured");
        setMessage("Configuration error. Please contact support.");
        setTimeout(() => {
          navigate(`${ERROR_REDIRECT}?error=not_configured`, { replace: true });
        }, 2000);
        return;
      }

      try {
        // Add timeout to prevent infinite hanging
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Authentication timeout")), EXCHANGE_TIMEOUT_MS)
        );

        const exchangePromise = supabase.auth.exchangeCodeForSession(code);
        const { data, error } = await Promise.race([exchangePromise, timeoutPromise]) as Awaited<typeof exchangePromise>;

        if (error) {
          throw error;
        }

        // Get user and determine role-based redirect
        const user = data.user;
        if (!user) {
          throw new Error("User not found after OAuth exchange");
        }

        // Re-identify with confirmed Supabase user_id
        identify(user.id, {
          email: user.email,
          last_active_at: new Date().toISOString(),
        });

        // Use custom redirect if provided, otherwise use role-based redirect
        const normalizedNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
        const redirectUrl = normalizedNext ?? await redirectToRoleDashboard(user.id);

        console.log('[AuthCallback] Redirecting user to:', redirectUrl);
        navigate(redirectUrl, { replace: true });
      } catch (error: unknown) {
        console.error("Supabase OAuth callback failed:", error);
        const errorSlug = error instanceof Error ? error.message.replace(/\s+/g, "_").toLowerCase() : "exchange_failed";
        setMessage("We couldn't complete the sign-in. Redirecting you to try again...");
        setTimeout(() => {
          navigate(`${ERROR_REDIRECT}?error=${encodeURIComponent(errorSlug)}`, { replace: true });
        }, 1500);
      }
    };

    exchange();
  }, [code, navigate, next, urlError]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background to-muted px-4 text-center">
      <Loader2 className="mb-4 h-8 w-8 animate-spin text-[#D67256]" />
      <p className="text-lg font-semibold text-foreground">{message}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        You will be redirected automatically. If nothing happens, return to the sign-in page.
      </p>
    </div>
  );
}
