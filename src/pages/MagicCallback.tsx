import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { redirectToRoleDashboard } from "../lib/redirects";

const POLL_MAX_ATTEMPTS = 6;
const POLL_DELAY_MS = 500;

export default function MagicCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading'|'success'|'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const verifyMagicLink = async () => {
      try {
        let attempts = 0;
        let user: any = null;

        while (attempts < POLL_MAX_ATTEMPTS) {
          const { data } = await supabase.auth.getUser();
          user = data?.user;
          if (user) break;
          attempts++;
          await new Promise((res) => setTimeout(res, POLL_DELAY_MS));
        }

        if (!user) {
          throw new Error("Session not found after magic link verification. Please try signing in again.");
        }

        console.log('[MagicCallback] Session set, user:', user.id);
        setStatus("success");

        const customRedirect = searchParams.get("redirect");
        const redirectUrl = customRedirect || await redirectToRoleDashboard(user.id);
        setTimeout(() => {
          navigate(redirectUrl, { replace: true });
        }, 800);
      } catch (error: any) {
        console.error("[MagicCallback] Verification error:", error);
        setStatus("error");
        setErrorMessage(error?.message || "Failed to verify magic link");
      }
    };

    verifyMagicLink();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted px-4">
      {status === 'loading' && <div>Verifying magic link...</div>}
      {status === 'success' && <div>Success! Redirecting...</div>}
      {status === 'error' && <div>Error: {errorMessage}</div>}
    </div>
  );
}