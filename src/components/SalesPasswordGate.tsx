import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { signOutUser } from "@/lib/auth/session";
import { useToast } from "@/hooks/use-toast";
import { hasRoleAccess } from "@/lib/auth/roles";

// Bot access secret for automated testing (Google Jules, etc.)
const BOT_SECRET = import.meta.env.VITE_JULES_SECRET;
const BOT_ACCESS_SESSION_KEY = 'ringsnap_bot_access_granted';

export const SalesPasswordGate = ({
  children
}: {
  children: React.ReactNode;
}) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hasAccess, setHasAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // PRIORITY 1: Check for bot access via URL parameter or sessionStorage
      // This allows automated testing tools to bypass the password gate
      const urlParams = new URLSearchParams(window.location.search);
      const botAccessParam = urlParams.get('bot_access');
      const sessionBotAccess = sessionStorage.getItem(BOT_ACCESS_SESSION_KEY);

      if (BOT_SECRET && botAccessParam === BOT_SECRET) {
        // Valid bot access token in URL - grant access and store in session
        sessionStorage.setItem(BOT_ACCESS_SESSION_KEY, 'true');
        setHasAccess(true);
        setIsLoading(false);

        // Clean up the URL parameter for cleaner appearance
        if (urlParams.has('bot_access')) {
          urlParams.delete('bot_access');
          const newUrl = window.location.pathname +
            (urlParams.toString() ? '?' + urlParams.toString() : '') +
            window.location.hash;
          window.history.replaceState({}, '', newUrl);
        }
        return;
      }

      if (sessionBotAccess === 'true') {
        // Bot access already granted in this session
        setHasAccess(true);
        setIsLoading(false);
        return;
      }

      // PRIORITY 2: Check for existing authenticated user with proper role
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Check if user has sales, platform_admin, or platform_owner role
        const { data: staffRole } = await supabase
          .from('staff_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle();

        setHasAccess(hasRoleAccess(staffRole?.role, ['sales']));
      }
    } catch (error) {
      console.error("Auth check error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Check if user has sales, platform_admin, or platform_owner role
        const { data: staffRole } = await supabase
          .from('staff_roles')
          .select('role')
          .eq('user_id', data.user.id)
          .maybeSingle();

        if (hasRoleAccess(staffRole?.role, ['sales'])) {
          setHasAccess(true);
          toast({
            title: "Access Granted",
            description: "Welcome to the Sales Command Center",
          });
        } else {
          try {
            await signOutUser();
          } catch (error) {
            console.error("Failed to sign out:", error);
          }
          toast({
            title: "Access Denied",
            description: "You don't have permission to access this page",
            variant: "destructive",
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  if (isLoading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-muted-foreground">Checking access...</p>
    </div>;
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-center">RingSnap Sales Command Center</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="text-sm font-medium mb-2 block">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your.email@getringsnap.com"
              required
              className="text-base"
              style={{ fontSize: "16px" }}
            />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium mb-2 block">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              className="text-base"
              style={{ fontSize: "16px" }}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>;
};