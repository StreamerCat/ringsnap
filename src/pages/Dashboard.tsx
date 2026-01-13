import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { hasRoleAccess } from "@/lib/auth/roles";
import { SalesTab } from "@/components/dashboard/SalesTab";

const PLAN_PRICING: Record<string, number> = {
  starter: 297,
  professional: 797,
  premium: 1497,
};

import { Helmet } from "react-helmet-async";

export default function Dashboard() {
  const navigate = useNavigate();
  const [dateFilter, setDateFilter] = useState("30");
  const [userId, setUserId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isAdminOrOwner, setIsAdminOrOwner] = useState(false);
  const [userProfileName, setUserProfileName] = useState<string | null>(null);
  const [salesRepFilter, setSalesRepFilter] = useState("all");

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/auth/login");
        return;
      }

      setUserId(user.id);

      // Fetch user's profile name for filtering
      const { data: profileData } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

      if (profileData?.name) {
        setUserProfileName(profileData.name);
      }

      const { data: staffRole, error } = await supabase
        .from("staff_roles" as any)
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Failed to load staff role", error);
        setIsOwner(false);
        return;
      }

      const role = (staffRole as any)?.role;
      const hasSalesAccess = hasRoleAccess(role, ['sales']);
      setIsOwner(hasSalesAccess);

      // Check if platform owner/admin for showing all accounts vs filtered
      setIsAdminOrOwner(role === 'platform_owner' || role === 'platform_admin');
    };

    checkAuth();
  }, [navigate]);

  const getDateThreshold = () => {
    if (dateFilter === "all") return null;
    const days = parseInt(dateFilter);
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
  };

  const {
    data: salesAccounts = [],
    isLoading: salesAccountsLoading,
  } = useQuery({
    queryKey: ["sales_team_accounts", dateFilter],
    queryFn: async () => {
      let query = supabase
        .from("accounts" as any)
        .select(
          "id, company_name, plan_type, subscription_status, sales_rep_name, created_at, trade, profiles!left(name, phone, is_primary)"
        )
        .in("subscription_status", ["trial", "active", "past_due"]);

      const threshold = getDateThreshold();
      if (threshold) query = query.gte("created_at", threshold);

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;

      return data || [];
    },
    enabled: isOwner,
  });

  // Fetch provisioning status for banner (Moved up to fix hooks rule)
  const { data: accountStatus } = useQuery({
    queryKey: ["account_provisioning_status", userId],
    queryFn: async () => {
      if (!userId) return null; // Guard inside fn

      const { data: profile } = await supabase
        .from("profiles")
        .select("account_id")
        .eq("id", userId)
        .single();

      if (!profile?.account_id) return null;

      const { data: account } = await supabase
        .from("accounts")
        .select("provisioning_status, vapi_phone_number")
        .eq("id", profile.account_id)
        .single();

      return account;
    },
    enabled: !!userId,
    refetchInterval: (query) => (query.state.data?.provisioning_status === "completed" || query.state.data?.provisioning_status === "active" ? false : 5000), // Poll if not complete
  });

  const salesRepOptions = useMemo(() => {
    const reps = new Set<string>();
    salesAccounts.forEach((account: any) => {
      const repValue = (account.sales_rep_name as string | null)?.trim() || "__unassigned";
      reps.add(repValue);
    });
    return Array.from(reps).sort((a, b) => {
      if (a === "__unassigned") return 1;
      if (b === "__unassigned") return -1;
      return a.localeCompare(b);
    });
  }, [salesAccounts]);

  const filteredAccounts = useMemo(() => {
    return salesAccounts.filter((account: any) => {
      const repValue = (account.sales_rep_name as string | null)?.trim() || "__unassigned";
      if (salesRepFilter === "all") return true;
      return repValue === salesRepFilter;
    });
  }, [salesAccounts, salesRepFilter]);

  const totals = useMemo(() => {
    const totalAccounts = filteredAccounts.length;
    let activeAccounts = 0;
    let pastDueAccounts = 0;
    const totalMRR = filteredAccounts.reduce((sum: number, account: any) => {
      const status = account.subscription_status;
      if (status === "active") activeAccounts += 1;
      if (status === "past_due") pastDueAccounts += 1;

      const planKey = (account.plan_type as string | null)?.toLowerCase() || "";
      const planValue = PLAN_PRICING[planKey] || 0;
      return sum + planValue;
    }, 0);

    return { totalAccounts, activeAccounts, pastDueAccounts, totalMRR };
  }, [filteredAccounts]);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }),
    []
  );

  const exportCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) return;

    const formattedRows: Record<string, string | number>[] = data.map((account: any) => {
      const planKey = (account.plan_type as string | null)?.toLowerCase() || "";
      const mrrValue = PLAN_PRICING[planKey] || 0;
      return {
        company_name: account.company_name ?? "",
        sales_rep: account.sales_rep_name?.trim() || "Unassigned",
        plan_type: account.plan_type ?? "",
        subscription_status: account.subscription_status ?? "",
        mrr: mrrValue,
        contact_name: account.profiles?.[0]?.name || "",
        contact_phone: account.profiles?.[0]?.phone || "",
        created_at: account.created_at ?? "",
      };
    });

    if (formattedRows.length === 0) return;

    const headers = Object.keys(formattedRows[0]);
    const csvRows = formattedRows.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          return `"${String(value ?? "")}"`;
        })
        .join(",")
    );

    const csv = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!userId) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading...</div>;
  }

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Only account owners can access the sales dashboard.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 pb-12">
      <Helmet>
        <title>Sales Dashboard | RingSnap</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      {/* Provisioning Status Banner */}
      {accountStatus && accountStatus.provisioning_status !== "completed" && accountStatus.provisioning_status !== "active" && (
        <div className={`w-full p-4 text-center text-sm font-medium ${accountStatus.provisioning_status?.startsWith("failed")
          ? "bg-red-100 text-red-800 border-b border-red-200"
          : "bg-blue-50 text-blue-800 border-b border-blue-200"
          }`}>
          {accountStatus.provisioning_status?.startsWith("failed")
            ? "We hit a snag setting up your assistant. Please check your email for next steps."
            : "Setting up your RingSnap Agent... (This may take a few minutes)"}
        </div>
      )}

      <div className="container mx-auto p-6 space-y-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Sales Dashboard</h1>

          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 3 months</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sales accounts - filtered for sales reps, all for admins */}
        <SalesTab
          dateFilter={dateFilter}
          salesRepNameFilter={isAdminOrOwner ? undefined : userProfileName || undefined}
        />
      </div>
    </div>
  );
}
