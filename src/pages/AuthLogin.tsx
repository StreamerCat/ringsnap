import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Mail } from "lucide-react";
import { Helmet } from "react-helmet-async";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { redirectToRoleDashboard } from "@/lib/auth/redirects";

type AuthMode = "password" | "magic";

export default function AuthLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("password");

  const checkIfAlreadyLoggedIn = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Always resolve the role-based destination first.  Staff users must
        // always land on their staff dashboard — never let a stale ?redirect
        // param (e.g. ?redirect=/dashboard set by withAuthGuard on
        // CustomerDashboard) override a staff route and trap them in a loop.
        const roleDest = await redirectToRoleDashboard(user.id);
        const isStaffRoute = roleDest === '/admin' || roleDest === '/salesdash';
        const customRedirect = searchParams.get("redirect");
        // Staff: always use role destination.
        // Customers: honour ?redirect unless it points at a staff-only page.
        const finalRedirect = isStaffRoute
          ? roleDest
          : (customRedirect &&
             !customRedirect.startsWith('/admin') &&
             !customRedirect.startsWith('/salesdash'))
            ? customRedirect
            : roleDest;
        navigate(finalRedirect);
      }
    } catch (error) {
      console.error("Auth check error:", error);
    } finally {
      setIsCheckingAuth(false);
    }
  }, [navigate, searchParams]);

  useEffect(() => {
    checkIfAlreadyLoggedIn();
  }, [checkIfAlreadyLoggedIn]);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    if (!password || password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error) throw error;

      if (!data.user) {
        throw new Error("Login succeeded but user not found");
      }

      toast.success("Logged in successfully!");

      const roleDest = await redirectToRoleDashboard(data.user.id);
      const isStaffRoute = roleDest === '/admin' || roleDest === '/salesdash';
      const customRedirect = searchParams.get("redirect");
      const finalRedirect = isStaffRoute
        ? roleDest
        : (customRedirect &&
           !customRedirect.startsWith('/admin') &&
           !customRedirect.startsWith('/salesdash'))
          ? customRedirect
          : roleDest;

      navigate(finalRedirect);
    } catch (error: any) {
      console.error("Login error:", error);
      let message = "Failed to sign in";

      // Provide helpful error messages
      if (error?.message?.includes("Invalid login credentials")) {
        message = "Invalid email or password";
      } else if (error?.message?.includes("Email not confirmed")) {
        message = "Please verify your email address";
      } else if (error?.message) {
        message = error.message;
      }

      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLinkLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-magic-link", {
        body: { email: email.toLowerCase().trim() }
      });

      if (error) {
        // Try to extract the actual error message from the response
        let errorBody: string | undefined;
        try {
          const ctx = (error as any).context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.json();
            errorBody = body?.error;
          }
        } catch { /* ignore parse errors */ }
        throw new Error(errorBody || error.message);
      }
      if (data?.error) throw new Error(data.error);

      setMagicLinkSent(true);
      toast.success("Sign-in link sent! Check your email.");
    } catch (error: any) {
      console.error("Magic link error:", error);
      const msg = error?.message || "";
      const isRateLimit = error?.status === 429 || msg.includes("rate limit") || msg.includes("Too many");
      if (isRateLimit) {
        toast.error("Too many attempts. Please try again later.");
      } else {
        toast.error("Email sign-in link is temporarily unavailable. Please use password login.");
        setAuthMode("password");
      }
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
    const normalizedEmail = email.toLowerCase().trim();

    try {
      // Try magic link first (redirects to security settings for password change)
      const { data, error } = await supabase.functions.invoke("send-magic-link", {
        body: { email: normalizedEmail, redirectTo: "/settings/security" }
      });

      if (error || data?.error) {
        // Magic link unavailable — fall back to send-password-reset
        console.warn("Magic link unavailable for reset, falling back to send-password-reset");
        const { data: resetData, error: resetError } = await supabase.functions.invoke("send-password-reset", {
          body: { email: normalizedEmail }
        });
        if (resetError) throw resetError;
        if (resetData?.error) throw new Error(resetData.error);
      }

      setResetEmailSent(true);
      toast.success("Reset link sent! Check your email.");
    } catch (error: any) {
      console.error("Reset password error:", error);

      const msg = error?.message || "";
      const isRateLimit = error?.status === 429 || msg.includes("rate limit") || msg.includes("Too many");
      const isNetwork = msg.includes("network") || msg.includes("fetch");

      if (isRateLimit || isNetwork) {
        toast.error("Too many attempts. Please try again later.");
      } else {
        // Security: don't reveal if user exists
        setResetEmailSent(true);
        toast.success("If an account exists, a reset link has been sent.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (resetEmailSent || magicLinkSent) {
    const isReset = resetEmailSent;
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Check your email</CardTitle>
            <CardDescription className="text-center">
              We sent a sign-in link to <strong>{email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-center text-muted-foreground">
              {isReset
                ? "Click the link to sign in and reset your password. The link expires in 20 minutes."
                : "Click the link in the email to sign in. The link expires in 20 minutes."}
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setResetEmailSent(false);
                setMagicLinkSent(false);
                setEmail("");
              }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Sign In | RingSnap</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Welcome Back</CardTitle>
            <CardDescription className="text-center">
              Sign in to access your RingSnap account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {authMode === "magic" ? (
              <form onSubmit={handleMagicLinkLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    autoFocus
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending link...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Send me a sign-in link
                    </>
                  )}
                </Button>

                <div className="text-center">
                  <Button
                    type="button"
                    variant="link"
                    className="text-sm"
                    onClick={() => setAuthMode("password")}
                    disabled={isLoading}
                  >
                    Sign in with password instead
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handlePasswordLogin} action="javascript:void(0);" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    minLength={8}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>

                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    variant="link"
                    className="text-sm px-0"
                    onClick={() => setAuthMode("magic")}
                    disabled={isLoading}
                  >
                    Use email link instead
                  </Button>
                  <Button
                    type="button"
                    variant="link"
                    className="text-sm px-0"
                    onClick={handleForgotPassword}
                    disabled={isLoading}
                  >
                    Forgot password?
                  </Button>
                </div>
              </form>
            )}

            <div className="text-center">
              <Button variant="link" onClick={() => navigate("/")}>
                Back to Homepage
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
