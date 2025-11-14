import React, { useCallback, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import toast from "react-hot-toast";
import { redirectToRoleDashboard } from "../lib/redirects";

export default function AuthLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailSentType, setEmailSentType] = useState<'magic'|'reset'>('magic');

  function generateDeviceNonce() {
    let deviceNonce = localStorage.getItem("device_nonce");
    if (!deviceNonce) {
      deviceNonce = crypto.randomUUID();
      localStorage.setItem("device_nonce", deviceNonce);
    }
    return deviceNonce;
  }

  const handleSendMagicLink = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    setIsLoading(true);
    try {
      const deviceNonce = generateDeviceNonce();
      const redirectTo = searchParams.get("redirect") || "/onboarding";

      const res = await fetch("/api/send-magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase().trim(), deviceNonce, redirectTo }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to send email");

      setEmailSentType('magic');
      setEmailSent(true);
      toast.success("If an account exists for this address, an email has been sent.");
    } catch (err: any) {
      console.error("Magic link error:", err);
      toast.error("Unable to send the email right now. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email || !email.includes("@")) {
      toast.error("Please enter your email address first");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/send-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to send reset link");

      setEmailSentType('reset');
      setEmailSent(true);
      toast.success("If an account exists for this address, a password reset email has been sent.");
    } catch (err: any) {
      console.error("Reset password error:", err);
      toast.error("Unable to send reset email right now. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSendMagicLink}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        <button type="submit" disabled={isLoading}>Continue with email</button>
      </form>
      {emailSent && <div>Check your email — we sent a {emailSentType === 'magic' ? 'magic link' : 'reset link'} to {email}</div>}
    </div>
  );
}