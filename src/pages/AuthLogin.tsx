import React, { useCallback, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import toast from "react-hot-toast";
import { redirectToRoleDashboard } from "../lib/redirects";

export default function AuthLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [emailSent, setEmailSent] = useState(false); // renamed from magicLinkSent
  const [emailSentType, setEmailSentType] = useState<'magic' | 'reset'>('magic');

  const redirectTo = searchParams.get("redirect") || "/onboarding";

  const checkIfAlreadyLoggedIn = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const customRedirect = searchParams.get("redirect");
        const finalRedirect = customRedirect || await redirectToRoleDashboard(user.id);
        navigate(finalRedirect, { replace: true });
        return;
      }
    } catch (err) {
      console.error('Error checking user session', err);
    } finally {
      // Always clear the loading flag so the page renders
      setIsCheckingAuth(false);
    }
  }, [searchParams, navigate]);

  const handleSendMagicLink = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setIsLoading(true);
    try {
      const deviceNonce = generateDeviceNonce(); // existing helper
      const redirectTo = searchParams.get('redirect') || '/onboarding';
      const { data, error } = await supabase.functions.invoke("send-magic-link", {
        body: { email: email.toLowerCase().trim(), deviceNonce, redirectTo }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to send email");

      setEmailSentType('magic');
      setEmailSent(true);
      // Use friendly, non-enumerating message:
      toast.success("If an account exists for this address, an email has been sent.");
    } catch (error: any) {
      console.error("Magic link error:", error);
      // Surface a friendly generic message; log detailed error server-side
      toast.error("Unable to send the email right now. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  // Password reset flow
  const handleForgotPassword = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-password-reset", {
        body: { email: email.toLowerCase().trim() }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to send reset link");

      setEmailSentType('reset');
      setEmailSent(true);
      toast.success("If an account exists for this address, a password reset email has been sent.");
    } catch (error: any) {
      console.error("Reset password error:", error);
      toast.error("Unable to send reset email right now. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  // ... rest of component UI uses emailSent and emailSentType ...
  return (
    <div>{/* the rest of your JSX — unchanged except variable names */}</div>
  );
}