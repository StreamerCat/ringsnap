import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import { Helmet } from "react-helmet-async";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { redirectToRoleDashboard } from "@/lib/auth/redirects";

export default function AuthLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [resetEmailSent, setResetEmailSent] = useState(false);

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

  const handleForgotPassword = async () => {
    if (!email || !email.includes("@")) {
      toast.error("Please enter your email address first");
      return;
    }

    setIsLoading(true);
    try {
      // Use custom edge function to send password reset via Resend
      const { data, error } = await supabase.functions.invoke("send-password-reset", {
        body: { email: email.toLowerCase().trim() }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResetEmailSent(true);
      toast.success("Password reset link sent! Check your email.");
    } catch (error: any) {
      console.error("Reset password error:", error);

      // Security: Do not reveal if the user exists or not
      // Only show actual errors for network issues or rate limits
      const isRateLimit = error?.status === 429 || error?.message?.includes("rate limit");
      const isNetwork = error?.message?.includes("network") || error?.message?.includes("fetch");

      if (isRateLimit || isNetwork) {
        toast.error(error?.message || "Function temporarily unavailable. Please try again later.");
      } else {
        // For "User not found" or other auth errors, treat as success to avoid enumeration
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

  if (resetEmailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Check your email</CardTitle>
            <CardDescription className="text-center">
              We sent a password reset link to <strong>{email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-center text-muted-foreground">
              Click the link in the email to reset your password. The link expires in 1 hour.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setResetEmailSent(false);
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

              <div className="text-center">
                <Button
                  type="button"
                  variant="link"
                  className="text-sm"
                  onClick={handleForgotPassword}
                  disabled={isLoading}
                >
                  Forgot password?
                </Button>
              </div>
            </form>

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
