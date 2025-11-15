import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { redirectToRoleDashboard } from "@/lib/auth/redirects";
import { getOrCreateDeviceNonce } from "@/lib/auth/deviceNonce";

export default function MagicCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const verifyMagicLink = async () => {
      const token = searchParams.get("token");
      const customRedirect = searchParams.get("redirect");

      console.log('[MagicCallback] Starting verification', { token: token?.substring(0, 10), customRedirect });

      if (!token) {
        setStatus("error");
        setErrorMessage("No verification token found in URL");
        return;
      }

      try {
        // Get device nonce
        const deviceNonce = getOrCreateDeviceNonce();
        console.log('[MagicCallback] Device nonce:', deviceNonce?.substring(0, 10));

        // Verify the magic link token
        console.log('[MagicCallback] Calling verify-magic-link...');
        const { data, error } = await supabase.functions.invoke("verify-magic-link", {
          body: {
            token,
            deviceNonce
          }
        });

        console.log('[MagicCallback] Edge function response:', { success: data?.success, error });

        if (error) {
          console.error('[MagicCallback] Edge function error:', error);
          throw error;
        }

        if (!data?.success || !data?.session) {
          console.error('[MagicCallback] Invalid response:', data);
          throw new Error(data?.error || "Failed to verify magic link");
        }

        console.log('[MagicCallback] Setting session...');
        // Set the session
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        });

        if (sessionError) {
          console.error('[MagicCallback] Session error:', sessionError);
          throw sessionError;
        }

        // Verify session was set
        const { data: { user } } = await supabase.auth.getUser();
        console.log('[MagicCallback] Session set, user:', user?.id);

        if (!user) {
          throw new Error("Session was set but user not found");
        }

        setStatus("success");

        // Determine redirect URL based on role
        const redirectUrl = customRedirect || await redirectToRoleDashboard(user.id);
        console.log('[MagicCallback] Redirecting to:', redirectUrl);

        // Redirect after a short delay
        setTimeout(() => {
          navigate(redirectUrl, { replace: true });
        }, 1500);

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
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            {status === "loading" && (
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            )}
            {status === "success" && (
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            )}
            {status === "error" && (
              <XCircle className="h-12 w-12 text-red-500" />
            )}
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            {status === "loading" && "Verifying your link..."}
            {status === "success" && "Success!"}
            {status === "error" && "Verification Failed"}
          </CardTitle>
          <CardDescription className="text-center">
            {status === "loading" && "Please wait while we sign you in"}
            {status === "success" && "Redirecting you to your dashboard..."}
            {status === "error" && "We couldn't verify your magic link"}
          </CardDescription>
        </CardHeader>
        {status === "error" && (
          <CardContent className="space-y-4">
            <p className="text-sm text-center text-muted-foreground">
              {errorMessage}
            </p>
            <Button
              className="w-full"
              onClick={() => navigate("/auth/login")}
            >
              Back to Login
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
