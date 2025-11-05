import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const navigate = useNavigate();
  const [dateFilter, setDateFilter] = useState("30");
  const [userId, setUserId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }
      setUserId(user.id);

      const { data: roles } = await supabase
        .from("user_roles" as any)
        .select("role")
        .eq("user_id", user.id);

      if (!roles?.some((r: any) => r.role === "owner")) {
        setIsOwner(false);
      } else {
        setIsOwner(true);
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

  const { data: trials = [] } = useQuery({
    queryKey: ["trial_signups", dateFilter],
    queryFn: async () => {
      let query = supabase.from("trial_signups" as any).select("*");
      const threshold = getDateThreshold();
      if (threshold) query = query.gte("created_at", threshold);
      const { data } = await query.order("created_at", { ascending: false });
      return data || [];
    },
    enabled: isOwner,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["revenue_report_leads", dateFilter],
    queryFn: async () => {
      let query = supabase.from("revenue_report_leads" as any).select("*");
      const threshold = getDateThreshold();
      if (threshold) query = query.gte("created_at", threshold);
      const { data } = await query.order("created_at", { ascending: false });
      return data || [];
    },
    enabled: isOwner,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", dateFilter],
    queryFn: async () => {
      let query = supabase
        .from("accounts" as any)
        .select("*, profiles!inner(name, phone, is_primary)")
        .eq("profiles.is_primary", true);
      const threshold = getDateThreshold();
      if (threshold) query = query.gte("created_at", threshold);
      const { data } = await query.order("created_at", { ascending: false });
      return data || [];
    },
    enabled: isOwner,
  });

  const exportCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map((row) =>
      Object.values(row)
        .map((v) => `"${v}"`)
        .join(",")
    );
    const csv = [headers, ...rows].join("\n");
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
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="container max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Sales Dashboard</h1>
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
        </div>

        <Tabs defaultValue="trials" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="trials">Trial Signups ({trials.length})</TabsTrigger>
            <TabsTrigger value="leads">ROI Leads ({leads.length})</TabsTrigger>
            <TabsTrigger value="customers">Customers ({customers.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="trials">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Trial Signups</CardTitle>
                  <Button onClick={() => exportCSV(trials, "trial-signups")} disabled={trials.length === 0}>
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Trade</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Advanced Voice</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trials.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            No trial signups found
                          </TableCell>
                        </TableRow>
                      ) : (
                        trials.map((trial: any) => (
                          <TableRow key={trial.id}>
                            <TableCell className="font-medium">{trial.name}</TableCell>
                            <TableCell>{trial.email}</TableCell>
                            <TableCell>{trial.phone}</TableCell>
                            <TableCell>{trial.trade || "—"}</TableCell>
                            <TableCell>{trial.source || "—"}</TableCell>
                            <TableCell>{trial.wants_advanced_voice ? "Yes" : "No"}</TableCell>
                            <TableCell>{new Date(trial.created_at).toLocaleDateString()}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leads">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>ROI Report Leads</CardTitle>
                  <Button onClick={() => exportCSV(leads, "roi-leads")} disabled={leads.length === 0}>
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Business</TableHead>
                        <TableHead>Trade</TableHead>
                        <TableHead>Recovered Revenue</TableHead>
                        <TableHead>ROI</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leads.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            No ROI leads found
                          </TableCell>
                        </TableRow>
                      ) : (
                        leads.map((lead: any) => (
                          <TableRow key={lead.id}>
                            <TableCell className="font-medium">{lead.name}</TableCell>
                            <TableCell>{lead.email}</TableCell>
                            <TableCell>{lead.business}</TableCell>
                            <TableCell>{lead.trade || "—"}</TableCell>
                            <TableCell>${lead.recovered_revenue?.toLocaleString() || "0"}</TableCell>
                            <TableCell>{lead.roi || "0"}%</TableCell>
                            <TableCell>{new Date(lead.created_at).toLocaleDateString()}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customers">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Customer Accounts</CardTitle>
                  <Button onClick={() => exportCSV(customers, "customers")} disabled={customers.length === 0}>
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
                        <TableHead>Contact</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Trade</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Trial End</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            No customer accounts found
                          </TableCell>
                        </TableRow>
                      ) : (
                        customers.map((customer: any) => (
                          <TableRow key={customer.id}>
                            <TableCell className="font-medium">{customer.company_name}</TableCell>
                            <TableCell>{customer.profiles?.[0]?.name || "—"}</TableCell>
                            <TableCell>{customer.profiles?.[0]?.phone || "—"}</TableCell>
                            <TableCell>{customer.trade || "—"}</TableCell>
                            <TableCell>
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  customer.subscription_status === "active"
                                    ? "bg-green-100 text-green-800"
                                    : customer.subscription_status === "trial"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {customer.subscription_status}
                              </span>
                            </TableCell>
                            <TableCell>
                              {customer.trial_end_date
                                ? new Date(customer.trial_end_date).toLocaleDateString()
                                : "—"}
                            </TableCell>
                            <TableCell>{new Date(customer.created_at).toLocaleDateString()}</TableCell>
                          </TableRow>
                        ))
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
  );
}
