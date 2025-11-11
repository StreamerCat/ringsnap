/**
 * React hook and helpers for working with the Supabase authenticated user.
 */
import type { ComponentType } from "react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";

import { supabase } from "@/lib/supabase";

type UseUserResult = {
  user: User | null;
  isLoading: boolean;
};

export function useUser(): UseUserResult {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchUser = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) {
          console.error("Failed to fetch Supabase user:", error);
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
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
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
