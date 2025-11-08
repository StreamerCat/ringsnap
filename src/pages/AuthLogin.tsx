import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Mail, Lock, ArrowLeft } from "lucide-react";

export default function AuthLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const redirectTo = searchParams.get("redirect") || "/onboarding";

  const checkIfAlreadyLoggedIn = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        navigate(redirectTo);
      }
    } catch (error) {
      console.error("Auth check error:", error);
    } finally {
      setIsCheckingAuth(false);
    }
  }, [navigate, redirectTo]);

  useEffect(() => {
    checkIfAlreadyLoggedIn();
  }, [checkIfAlreadyLoggedIn]);

  // Check if email has a password set
  const checkEmailHasPassword = async (emailToCheck: string) => {
    if (!emailToCheck || !emailToCheck.includes("@")) return;

    try {
      // Try to get user metadata (this is a workaround since we can't directly check)
      // In production, you might want to add an endpoint to check this
      setHasPassword(true); // Assume password exists for now
    } catch (error) {
      setHasPassword(false);
    }
  };

  const handleContinueWithEmail = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsLoading(true);

    try {
      // Get device nonce from localStorage or create one
      let deviceNonce = localStorage.getItem("device_nonce");
      if (!deviceNonce) {
        deviceNonce = crypto.randomUUID();
        localStorage.setItem("device_nonce", deviceNonce);
      }

      // Send magic link
      const { data, error } = await supabase.functions.invoke("send-magic-link", {
        body: {
          email: email.toLowerCase().trim(),
          deviceNonce,
          redirectTo
        }
      });

      if (error) throw error;

      if (data?.success) {
        setMagicLinkSent(true);
        toast.success("Magic link sent! Check your email to sign in.");
      } else {
        throw new Error(data?.error || "Failed to send magic link");
      }
    } catch (error: any) {
      console.error("Magic link error:", error);
      const message = error?.message || "Failed to send magic link";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error) throw error;

      toast.success("Logged in successfully!");
      navigate(redirectTo);
    } catch (error: any) {
      console.error("Login error:", error);
      const message = error?.message || "Failed to sign in";
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

    navigate(`/auth/password?email=${encodeURIComponent(email)}&mode=reset`);
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (magicLinkSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex justify-center mb-4">
              <Mail className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold text-center">Check your email</CardTitle>
            <CardDescription className="text-center">
              We sent a magic link to <strong>{email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-center text-muted-foreground">
              Click the link in the email to sign in. The link expires in 20 minutes.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Welcome Back</CardTitle>
          <CardDescription className="text-center">
            Sign in to access your RingSnap account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showPasswordInput ? (
            <form onSubmit={handleContinueWithEmail} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => checkEmailHasPassword(email)}
                  required
                  disabled={isLoading}
                  autoFocus
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending magic link...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Continue with email
                  </>
                )}
              </Button>

              {hasPassword && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowPasswordInput(true)}
                  disabled={isLoading}
                >
                  <Lock className="mr-2 h-4 w-4" />
                  Use password instead
                </Button>
              )}
            </form>
          ) : (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
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
                  autoFocus
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

              <div className="flex justify-between text-sm">
                <Button
                  type="button"
                  variant="link"
                  className="p-0 h-auto"
                  onClick={() => setShowPasswordInput(false)}
                  disabled={isLoading}
                >
                  <ArrowLeft className="mr-1 h-3 w-3" />
                  Use magic link
                </Button>
                <Button
                  type="button"
                  variant="link"
                  className="p-0 h-auto"
                  onClick={handleForgotPassword}
                  disabled={isLoading}
                >
                  Forgot password?
                </Button>
              </div>
            </form>
          )}

          <div className="mt-6 text-center">
            <Button variant="link" onClick={() => navigate("/")}>
              Back to Homepage
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
