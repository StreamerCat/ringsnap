import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SalesPasswordGate } from "@/components/SalesPasswordGate";

const PLAN_PRICING: Record<string, number> = {
  starter: 297,
  professional: 797,
  premium: 1497,
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [dateFilter, setDateFilter] = useState("30");
  const [userId, setUserId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [salesRepFilter, setSalesRepFilter] = useState("all");

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/login");
        return;
      }

      setUserId(user.id);

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
      if (role === "platform_owner" || role === "platform_admin") {
        setIsOwner(true);
      } else {
        setIsOwner(false);
      }
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
          "id, company_name, plan_type, subscription_status, sales_rep_name, created_at, trade, profiles!inner(name, phone, is_primary)"
        )
        .eq("profiles.is_primary", true)
        .in("subscription_status", ["active", "past_due"]);

      const threshold = getDateThreshold();
      if (threshold) query = query.gte("created_at", threshold);

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;

      return data || [];
    },
    enabled: isOwner,
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
    <SalesPasswordGate>
      <div className="min-h-screen bg-slate-50 p-4">
        <div className="container max-w-7xl mx-auto">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <h1 className="text-3xl font-bold text-slate-900">Sales Dashboard</h1>
              <Button variant="outline" onClick={() => navigate("/admin/monitoring")}>
                Monitoring Dashboard
              </Button>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
              <Select value={salesRepFilter} onValueChange={setSalesRepFilter}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Sales Rep" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sales Reps</SelectItem>
                  {salesRepOptions.map((rep) => (
                    <SelectItem key={rep} value={rep}>
                      {rep === "__unassigned" ? "Unassigned" : rep}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Total Accounts</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-slate-900">{totals.totalAccounts}</p>
                <p className="text-sm text-muted-foreground">
                  {salesRepFilter === "all" ? "Across all reps" : "Filtered"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Active</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-emerald-600">{totals.activeAccounts}</p>
                <p className="text-sm text-muted-foreground">Paying on time</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Past Due</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-amber-600">{totals.pastDueAccounts}</p>
                <p className="text-sm text-muted-foreground">Requires follow-up</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Total MRR</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-slate-900">{currencyFormatter.format(totals.totalMRR)}</p>
                <p className="text-sm text-muted-foreground">Based on plan selection</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="accounts" className="space-y-4">
            <TabsList className="grid w-full grid-cols-1">
              <TabsTrigger value="accounts">Sales Team Accounts ({filteredAccounts.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="accounts">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Sales Team Accounts</CardTitle>
                    <Button
                      onClick={() => exportCSV(filteredAccounts, "sales-team-accounts")}
                      disabled={filteredAccounts.length === 0}
                    >
                      Export CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Company</TableHead>
                          <TableHead>Sales Rep</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>MRR</TableHead>
                          <TableHead>Contact</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Joined</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salesAccountsLoading ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center text-muted-foreground">
                              Loading accounts...
                            </TableCell>
                          </TableRow>
                        ) : filteredAccounts.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center text-muted-foreground">
                              No paid accounts found for the selected filters
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredAccounts.map((account: any) => {
                            const status = account.subscription_status as string | null;
                            const planKey = (account.plan_type as string | null)?.toLowerCase() || "";
                            const mrrValue = PLAN_PRICING[planKey] || 0;
                            const badgeClasses =
                              status === "active"
                                ? "bg-green-100 text-green-800"
                                : status === "past_due"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-100 text-slate-700";

                            const repLabel = account.sales_rep_name?.trim() || "Unassigned";

                            return (
                              <TableRow key={account.id}>
                                <TableCell className="font-medium">{account.company_name}</TableCell>
                                <TableCell>{repLabel}</TableCell>
                                <TableCell className="capitalize">{account.plan_type || "—"}</TableCell>
                                <TableCell>
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${badgeClasses}`}>
                                    {status ? status.replace(/_/g, " ") : "—"}
                                  </span>
                                </TableCell>
                                <TableCell>{currencyFormatter.format(mrrValue)}</TableCell>
                                <TableCell>{account.profiles?.[0]?.name || "—"}</TableCell>
                                <TableCell>{account.profiles?.[0]?.phone || "—"}</TableCell>
                                <TableCell>
                                  {account.created_at ? new Date(account.created_at).toLocaleDateString() : "—"}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </SalesPasswordGate>
  );
}
