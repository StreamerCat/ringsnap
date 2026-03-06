/**
 * React hook and helpers for working with the Supabase authenticated user.
 */
import type { ComponentType } from "react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { setUserContext, clearUserContext } from "@/lib/sentry-tracking";

type UseUserResult = {
  user: User | null;
  isLoading: boolean;
};

export function useUser(): UseUserResult {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const fetchUser = async () => {
      try {
        // Add timeout to prevent infinite loading if API never responds
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error("User fetch timeout")), 5000);
        });

        const getUserPromise = supabase.auth.getUser();
        const { data, error } = await Promise.race([getUserPromise, timeoutPromise]) as Awaited<typeof getUserPromise>;

        clearTimeout(timeoutId);

        if (error) {
          // Suppress expected "session missing" error, log others
          if (error.name !== "AuthSessionMissingError" && !error.message?.includes("Auth session missing")) {
            console.error("Failed to fetch Supabase user:", error);
          }
        }
        if (isMounted) {
          setUser(data?.user ?? null);
        }
      } catch (error) {
        console.error("Unexpected Supabase user error:", error);
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchUser();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        setIsLoading(false);

        // Update Sentry user context
        if (currentUser) {
          setUserContext({ userId: currentUser.id });
        } else {
          clearUserContext();
        }
      }
    });

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      data.subscription.unsubscribe();
    };
  }, []);

  return { user, isLoading };
}

type WithAuthGuardOptions = {
  redirectTo?: string;
};

export const withAuthGuard = <P extends object>(
  Component: ComponentType<P>,
  options?: WithAuthGuardOptions,
): ComponentType<P> => {
  const GuardedComponent = (props: P) => {
    const { user, isLoading } = useUser();
    const navigate = useNavigate();
    const location = useLocation();
    const fallback = options?.redirectTo ?? "/signin";

    const targetPath = useMemo(() => {
      const next = `${location.pathname}${location.search}${location.hash}`;
      return next || "/";
    }, [location.hash, location.pathname, location.search]);

    const isBillingE2EBypass =
      process.env.NODE_ENV === "test" &&
      new URLSearchParams(location.search).get("billingE2E") === "1";

    if (isBillingE2EBypass) {
      return <Component {...props} />;
    }

    useEffect(() => {
      if (isLoading || user) {
        return;
      }

      const redirectUrl = `${fallback}?redirect=${encodeURIComponent(targetPath)}`;
      navigate(redirectUrl, { replace: true });
    }, [fallback, isLoading, navigate, targetPath, user]);

    if (isLoading || !user) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-[#D67256]" />
            Checking your session...
          </span>
        </div>
      );
    }

    return <Component {...props} />;
  };

  GuardedComponent.displayName = `withAuthGuard(${Component.displayName ?? Component.name ?? "Component"})`;

  return GuardedComponent;
};
