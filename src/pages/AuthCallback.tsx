/**
 * Handles Supabase OAuth callback by exchanging the authorization code for a session.
 */
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { supabase } from "@/lib/supabase";

const SUCCESS_REDIRECT = "/dashboard";
const ERROR_REDIRECT = "/signin";

export default function AuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const [message, setMessage] = useState("Signing you in...");

  const { code, next } = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return {
      code: params.get("code"),
      next: params.get("next"),
    };
  }, [location.search]);

  useEffect(() => {
    const exchange = async () => {
      if (!code) {
        navigate(`${ERROR_REDIRECT}?error=missing_code`, { replace: true });
        return;
      }

      try {
        const { error } = await supabase.auth.exchangeCodeForSession({ code });
        if (error) {
          throw error;
        }

        const normalizedNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
        navigate(normalizedNext ?? SUCCESS_REDIRECT, { replace: true });
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
  }, [code, navigate, next]);

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
