import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
const SALES_PASSWORD = "L3g4cy";
const STORAGE_KEY = "sales_access";
export const SalesPasswordGate = ({
  children
}: {
  children: React.ReactNode;
}) => {
  const [password, setPassword] = useState("");
  const [hasAccess, setHasAccess] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored === "granted") {
      setHasAccess(true);
    }
  }, []);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === SALES_PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, "granted");
      setHasAccess(true);
      setError("");
    } else {
      setError("Incorrect password");
    }
  };
  if (hasAccess) {
    return <>{children}</>;
  }
  return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">RingSnap Sales
Command Center</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" className="text-base" style={{
              fontSize: "16px"
            }} />
              {error && <p className="text-sm text-destructive mt-2">{error}</p>}
            </div>
            <Button type="submit" className="w-full">
              Access Sales Page
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>;
};