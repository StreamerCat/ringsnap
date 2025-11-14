import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { redirectToRoleDashboard } from "../lib/redirects";

export default function MagicCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading'|'success'|'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const verify = async () => {
      const token = searchParams.get("token");
      const deviceNonce = localStorage.getItem("device_nonce") || null;
      if (!token) {
        setStatus('error');
        setErrorMessage('No verification token found in URL');
        return;
      }

      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE || ''}/.netlify/functions/verify-magic-link`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, deviceNonce }),
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Verification failed');

        const { session, user } = json;
        if (!session?.access_token || !session?.refresh_token) {
          throw new Error('No session returned from verification function');
        }

        const { error: setErr } = await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });
        if (setErr) throw setErr;

        setStatus('success');

        const redirectUrl = searchParams.get("redirect") || await redirectToRoleDashboard(user.id);
        setTimeout(() => navigate(redirectUrl, { replace: true }), 800);
      } catch (err: any) {
        console.error("[MagicCallback] verification error:", err);
        setStatus('error');
        setErrorMessage(err?.message || 'Verification failed');
      }
    };
    verify();
  }, [searchParams, navigate]);

  if (status === 'loading') return <div>Verifying your link...</div>;
  if (status === 'success') return <div>Success! Redirecting...</div>;
  return <div>Error verifying link: {errorMessage}</div>;
}