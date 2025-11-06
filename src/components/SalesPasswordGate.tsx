import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Check if user has platform_owner role
        const { data: staffRole } = await supabase
          .from('staff_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .eq('role', 'platform_owner')
          .maybeSingle();
        
        setHasAccess(!!staffRole);
      }
    } catch (error) {
      console.error('Auth check error:', error);
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
        // Check if user has platform_owner role
        const { data: staffRole } = await supabase
          .from('staff_roles')
          .select('role')
          .eq('user_id', data.user.id)
          .eq('role', 'platform_owner')
          .maybeSingle();

        if (staffRole) {
          setHasAccess(true);
          toast({
            title: "Access Granted",
            description: "Welcome to the Sales Command Center",
          });
        } else {
          await supabase.auth.signOut();
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
              placeholder="your.email@ringsnap.com"
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