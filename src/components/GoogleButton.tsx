/**
 * Branded Google OAuth kickoff button for RingSnap authentication flows.
 */
import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isGoogleOAuthEnabled } from "@/config/authProviders";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

type GoogleButtonProps = {
  onError?: (message: string) => void;
};

const OAUTH_TIMEOUT_MS = 10000; // 10 second timeout

export function GoogleButton({ onError }: GoogleButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (!isGoogleOAuthEnabled) {
    // TODO(google-oauth): Remove this guard when the provider can return.
    // Flip VITE_ENABLE_GOOGLE_OAUTH to "true" (or set NEXT_PUBLIC_*) to render the button again.
    return null;
  }

  const handleClick = async () => {
    try {
      setIsLoading(true);

      // Check if Supabase is configured
      if (!isSupabaseConfigured) {
        throw new Error("Authentication is not configured. Please contact support.");
      }

      const origin = typeof window !== "undefined" && window.location.origin
        ? window.location.origin
        : "https://getringsnap.com";
      const redirectTo = `${origin}/auth/callback`;

      // Add timeout to prevent infinite loading
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Google sign-in timeout. Please try again.")), OAUTH_TIMEOUT_MS)
      );

      const oauthPromise = supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
        },
      });

      const { error } = await Promise.race([oauthPromise, timeoutPromise]) as Awaited<typeof oauthPromise>;

      if (error) {
        throw error;
      }

      // Note: If successful, user will be redirected to Google, so no need to reset loading state
    } catch (error: unknown) {
      console.error("Google OAuth sign-in failed:", error);
      const message = error instanceof Error ? error.message : "Unable to start Google sign-in";
      onError?.(message);
      setIsLoading(false);
    }
  };

  return (
    <Button
      type="button"
      onClick={handleClick}
      className="w-full rounded-xl bg-[#D67256] text-white hover:bg-[#c46045]"
      disabled={isLoading}
      aria-label="Continue with Google"
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Connecting to Google...
        </>
      ) : (
        <>
          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
            >
              <path
                d="M21.6 12.227c0-.815-.073-1.595-.21-2.341H12v4.43h5.382a4.602 4.602 0 0 1-1.998 3.017v2.507h3.23c1.89-1.74 2.986-4.299 2.986-7.613Z"
                fill="#4285F4"
              />
              <path
                d="M12 22c2.7 0 4.964-.896 6.618-2.42l-3.23-2.507c-.896.6-2.044.955-3.388.955-2.608 0-4.818-1.761-5.607-4.127H3.05v2.593A9.997 9.997 0 0 0 12 22Z"
                fill="#34A853"
              />
              <path
                d="M6.393 13.901c-.2-.6-.314-1.242-.314-1.901 0-.659.114-1.301.314-1.901V7.506H3.05A9.998 9.998 0 0 0 2 12c0 1.614.387 3.14 1.05 4.494l3.343-2.593Z"
                fill="#FBBC05"
              />
              <path
                d="M12 6.272c1.468 0 2.786.505 3.825 1.495l2.868-2.868C16.961 3.703 14.697 2.8 12 2.8a9.997 9.997 0 0 0-8.95 4.706l3.343 2.593C7.182 8.033 9.392 6.272 12 6.272Z"
                fill="#EA4335"
              />
            </svg>
          </span>
          Continue with Google
        </>
      )}
    </Button>
  );
}

export default GoogleButton;
