import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Activity, AlertTriangle, ShieldAlert } from "lucide-react";

interface ProvisioningStatusRow {
  provisioning_status: string;
  account_count: number;
  accounts_with_errors: number;
  last_failure_at: string | null;
}

interface DailyCallStat {
  call_date: string;
  call_count: number;
  total_call_seconds: number;
  total_call_minutes: number;
  total_cost_cents: number;
}

interface EdgeFunctionErrorRow {
  id: string;
  created_at: string | null;
  alert_type: string | null;
  severity: string | null;
  account_id: string | null;
  company_name: string | null;
  alert_details: Record<string, any> | null;
  function_name: string | null;
  error_message: string | null;
  request_id: string | null;
}

interface FlaggedAccountRow {
  account_id: string;
  company_name: string;
  plan_type: string | null;
  provisioning_status: string | null;
  provisioning_error: string | null;
  account_status: string | null;
  is_flagged_for_review: boolean | null;
  flagged_reason: string | null;
  monthly_minutes_used: number | null;
  monthly_minutes_limit: number | null;
  created_at: string | null;
  updated_at: string | null;
  total_alerts: number | null;
  last_alert_at: string | null;
  alert_types: string[] | null;
}

interface ProvisioningFailureRow {
  account_id: string;
  company_name: string;
  provisioning_status: string | null;
  provisioning_error: string | null;
  updated_at: string | null;
}

const chartConfig = {
  calls: {
    label: "Total Calls",
    color: "hsl(var(--primary))",
  },
};

const provisioningStatusStyles: Record<string, string> = {
  provisioning: "bg-blue-100 text-blue-700",
  provisioned: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  pending: "bg-amber-100 text-amber-700",
  unknown: "bg-slate-100 text-slate-700",
};

const severityStyles: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-amber-100 text-amber-700",
  medium: "bg-blue-100 text-blue-700",
  low: "bg-slate-100 text-slate-700",
};

const AdminMonitoring = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [dateFilter, setDateFilter] = useState("7");

  useEffect(() => {
    const verifyAccess = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user;
        if (!user) {
          navigate("/login");
          return;
        }

        const { data: staffRole, error } = await supabase
          .from("staff_roles" as any)
          .select("role")
          .eq("user_id", user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        const hasAccess = staffRole && ((staffRole as any).role === "platform_owner" || (staffRole as any).role === "platform_admin");

        if (!hasAccess) {
          setIsAuthorized(false);
        } else {
          setIsAuthorized(true);
        }
      } catch (err: any) {
        console.error("Failed to verify admin access", err);
        toast({
          title: "Authentication error",
          description: err.message || "Unable to verify your access rights.",
          variant: "destructive",
        });
        navigate("/login");
      } finally {
        setLoading(false);
      }
    };

    verifyAccess();
  }, [navigate, toast]);

  const { data: provisioningSummary = [], isLoading: provisioningLoading, error: provisioningError } = useQuery({
    queryKey: ["admin-monitoring", "provisioning-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_provisioning_status_counts" as any)
        .select("*");

      if (error) throw error;
      return (data || []).map((row: any) => ({
        provisioning_status: row.provisioning_status,
        account_count: row.account_count,
        accounts_with_errors: row.accounts_with_errors,
        last_failure_at: row.last_failure_at,
      })) as ProvisioningStatusRow[];
    },
    enabled: isAuthorized,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (provisioningError) {
      console.error("Failed to load provisioning summary", provisioningError);
      toast({
        title: "Failed to load provisioning summary",
        description: provisioningError.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  }, [provisioningError, toast]);

  const { data: callStats = [], isLoading: callStatsLoading, error: callStatsError } = useQuery({
    queryKey: ["admin-monitoring", "call-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_daily_call_stats" as any)
        .select("*");

      if (error) throw error;
      return (data || []).map((row: any) => ({
        ...row,
        call_count: Number(row.call_count) || 0,
        total_call_seconds: Number(row.total_call_seconds) || 0,
        total_call_minutes: Number(row.total_call_minutes) || 0,
        total_cost_cents: Number(row.total_cost_cents) || 0,
      })) as DailyCallStat[];
    },
    enabled: isAuthorized,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (callStatsError) {
      console.error("Failed to load call stats", callStatsError);
      toast({
        title: "Failed to load call stats",
        description: callStatsError.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  }, [callStatsError, toast]);

  const { data: edgeFunctionErrors = [] as EdgeFunctionErrorRow[], isLoading: edgeErrorsLoading, error: edgeErrorsError } = useQuery({
    queryKey: ["admin-monitoring", "edge-function-errors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_edge_function_error_feed" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(25);

      if (error) throw error;
      if (!data) return [];
      return data as unknown as EdgeFunctionErrorRow[];
    },
    enabled: isAuthorized,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (edgeErrorsError) {
      console.error("Failed to load edge function errors", edgeErrorsError);
      toast({
        title: "Failed to load edge function errors",
        description: edgeErrorsError.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  }, [edgeErrorsError, toast]);

  const { data: flaggedAccounts = [] as FlaggedAccountRow[], isLoading: flaggedAccountsLoading, error: flaggedAccountsError } = useQuery({
    queryKey: ["admin-monitoring", "flagged-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_flagged_accounts" as any)
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return (data || []).map((row: any) => ({
        ...row,
        total_alerts: Number(row.total_alerts) || 0,
      })) as FlaggedAccountRow[];
    },
    enabled: isAuthorized,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (flaggedAccountsError) {
      console.error("Failed to load flagged accounts", flaggedAccountsError);
      toast({
        title: "Failed to load flagged accounts",
        description: flaggedAccountsError.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  }, [flaggedAccountsError, toast]);

  const { data: provisioningFailures = [] as ProvisioningFailureRow[], isLoading: provisioningFailuresLoading, error: provisioningFailuresError } = useQuery({
    queryKey: ["admin-monitoring", "provisioning-failures"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_provisioning_failures" as any)
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(25);

      if (error) throw error;
      if (!data) return [];
      return data as unknown as ProvisioningFailureRow[];
    },
    enabled: isAuthorized,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (provisioningFailuresError) {
      console.error("Failed to load provisioning failures", provisioningFailuresError);
      toast({
        title: "Failed to load provisioning failures",
        description: provisioningFailuresError.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  }, [provisioningFailuresError, toast]);

  const filteredCallStats = useMemo(() => {
    if (!callStats || callStats.length === 0) return [] as DailyCallStat[];
    if (dateFilter === "all") return callStats;

    const threshold = new Date();
    threshold.setDate(threshold.getDate() - parseInt(dateFilter));

    return callStats.filter((stat) => {
      if (!stat.call_date) return false;
      const statDate = new Date(stat.call_date);
      return statDate >= threshold;
    });
  }, [callStats, dateFilter]);

  const chartData = useMemo(() => {
    return [...filteredCallStats].sort(
      (a, b) => new Date(a.call_date).getTime() - new Date(b.call_date).getTime(),
    );
  }, [filteredCallStats]);

  const callMetrics = useMemo(() => {
    if (filteredCallStats.length === 0) {
      return {
        totalCalls: 0,
        totalMinutes: 0,
        totalCost: 0,
        averageDuration: 0,
      };
    }

    const totals = filteredCallStats.reduce(
      (acc, stat) => {
        acc.calls += stat.call_count || 0;
        acc.minutes += stat.total_call_minutes || 0;
        acc.cost += stat.total_cost_cents || 0;
        acc.seconds += stat.total_call_seconds || 0;
        return acc;
      },
      { calls: 0, minutes: 0, cost: 0, seconds: 0 },
    );

    return {
      totalCalls: totals.calls,
      totalMinutes: totals.minutes,
      totalCost: totals.cost,
      averageDuration: totals.calls > 0 ? Math.round(totals.seconds / totals.calls) : 0,
    };
  }, [filteredCallStats]);

  const totalAccountsTracked = useMemo(() => {
    return provisioningSummary.reduce((acc, row) => acc + (row.account_count || 0), 0);
  }, [provisioningSummary]);

  const statusCards = useMemo(() => {
    return provisioningSummary.map((row) => {
      const statusKey = row.provisioning_status?.toLowerCase() || "unknown";
      return {
        ...row,
        statusKey,
        style: provisioningStatusStyles[statusKey] || provisioningStatusStyles.unknown,
      };
    });
  }, [provisioningSummary]);

  const formatDateTime = (value: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground">
              You need owner or admin permissions to view the monitoring dashboard.
            </p>
            <Button variant="outline" onClick={() => navigate("/")}>
              Return home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto max-w-7xl py-8 px-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-slate-900">Operations Monitoring</h1>
            <p className="text-muted-foreground max-w-2xl">
              Track provisioning progress, platform health, and high-risk accounts for daily operations reviews.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate("/admin/users")}>
              Staff Management
            </Button>
            <Button variant="outline" onClick={() => navigate(-1)}>
              Go back
            </Button>
            <Button onClick={() => setDateFilter("7")}>Reset Filters</Button>
          </div>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Provisioning status
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {totalAccountsTracked} accounts actively tracked
                </p>
              </div>
            </CardHeader>
            <CardContent>
              {provisioningLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {statusCards.map((row) => (
                    <div key={row.provisioning_status} className="rounded-lg border bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <Badge className={row.style}>
                          {row.provisioning_status || "Unknown"}
                        </Badge>
                        <span className="text-2xl font-semibold text-slate-900">{row.account_count}</span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {row.accounts_with_errors} with errors
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Last failure: {formatDateTime(row.last_failure_at)}
                      </p>
                    </div>
                  ))}
                  {statusCards.length === 0 && (
                    <div className="col-span-full flex h-24 items-center justify-center rounded-lg border bg-white">
                      <p className="text-sm text-muted-foreground">No provisioning data available.</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-primary" />
                  Call volume & minute consumption
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Monitor platform usage and capacity across accounts.
                </p>
              </div>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select window" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="space-y-6">
              {callStatsLoading ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border bg-white p-4 shadow-sm">
                      <p className="text-sm text-muted-foreground">Total calls</p>
                      <p className="text-2xl font-semibold text-slate-900">{callMetrics.totalCalls}</p>
                    </div>
                    <div className="rounded-lg border bg-white p-4 shadow-sm">
                      <p className="text-sm text-muted-foreground">Minutes consumed</p>
                      <p className="text-2xl font-semibold text-slate-900">
                        {callMetrics.totalMinutes.toFixed(1)}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-white p-4 shadow-sm">
                      <p className="text-sm text-muted-foreground">Average call length</p>
                      <p className="text-2xl font-semibold text-slate-900">
                        {callMetrics.averageDuration} sec
                      </p>
                    </div>
                    <div className="rounded-lg border bg-white p-4 shadow-sm">
                      <p className="text-sm text-muted-foreground">Estimated cost</p>
                      <p className="text-2xl font-semibold text-slate-900">
                        ${ (callMetrics.totalCost / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
                      </p>
                    </div>
                  </div>

                  <ChartContainer config={chartConfig} className="h-[260px] w-full">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="callsGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-calls)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--color-calls)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="call_date"
                        tickFormatter={(value) => {
                          const date = new Date(value);
                          return Number.isNaN(date.getTime())
                            ? value
                            : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
                        }}
                      />
                      <YAxis allowDecimals={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area
                        type="monotone"
                        dataKey="call_count"
                        stroke="var(--color-calls)"
                        fill="url(#callsGradient)"
                        strokeWidth={2}
                        name="Calls"
                      />
                    </AreaChart>
                  </ChartContainer>
                </>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-primary" />
                  Recent edge function errors
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {edgeErrorsLoading ? (
                  <div className="flex h-32 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <ScrollArea className="h-[320px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Timestamp</TableHead>
                          <TableHead>Function</TableHead>
                          <TableHead>Account</TableHead>
                          <TableHead>Severity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {edgeFunctionErrors.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground">
                              No edge function errors recorded in the selected window.
                            </TableCell>
                          </TableRow>
                        ) : (
                          edgeFunctionErrors.map((error) => {
                            const severityKey = error.severity?.toLowerCase() || "low";
                            const severityStyle = severityStyles[severityKey] || severityStyles.low;
                            const detailMessage =
                              error.error_message ||
                              error.alert_details?.message ||
                              error.alert_details?.error ||
                              "View alert details for full context.";

                            return (
                              <TableRow key={error.id} className="align-top">
                                <TableCell className="min-w-[140px] text-sm">
                                  <div className="font-medium text-slate-900">{formatDateTime(error.created_at)}</div>
                                  <p className="text-xs text-muted-foreground truncate max-w-[220px]">
                                    {detailMessage}
                                  </p>
                                </TableCell>
                                <TableCell className="text-sm">
                                  <div className="font-medium text-slate-900">
                                    {error.function_name || error.alert_details?.function || "Unknown"}
                                  </div>
                                  {error.request_id && (
                                    <p className="text-xs text-muted-foreground">Request: {error.request_id}</p>
                                  )}
                                </TableCell>
                                <TableCell className="text-sm">
                                  <div className="font-medium text-slate-900">
                                    {error.company_name || "Unassigned"}
                                  </div>
                                  {error.account_id && (
                                    <p className="text-xs text-muted-foreground">{error.account_id}</p>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge className={severityStyle}>
                                    {error.severity || "low"}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-primary" />
                  Flagged accounts & provisioning failures
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-2">Accounts requiring review</h3>
                  {flaggedAccountsLoading ? (
                    <div className="flex h-24 items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <ScrollArea className="h-[180px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Account</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Alerts</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {flaggedAccounts.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-muted-foreground">
                                No flagged accounts right now.
                              </TableCell>
                            </TableRow>
                          ) : (
                            flaggedAccounts.map((account) => {
                              const statusKey = account.provisioning_status?.toLowerCase() || "unknown";
                              const statusStyle = provisioningStatusStyles[statusKey] || provisioningStatusStyles.unknown;
                              return (
                                <TableRow key={account.account_id}>
                                  <TableCell className="text-sm">
                                    <div className="font-medium text-slate-900">{account.company_name}</div>
                                    <p className="text-xs text-muted-foreground">
                                      {account.flagged_reason || "Check alert log"}
                                    </p>
                                  </TableCell>
                                  <TableCell>
                                    <Badge className={statusStyle}>
                                      {account.provisioning_status || "Unknown"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    <div className="font-medium text-slate-900">{account.total_alerts || 0}</div>
                                    {account.alert_types && account.alert_types.length > 0 && (
                                      <p className="text-xs text-muted-foreground truncate max-w-[160px]">
                                        {account.alert_types.join(", ")}
                                      </p>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-2">Recent provisioning failures</h3>
                  {provisioningFailuresLoading ? (
                    <div className="flex h-24 items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <ScrollArea className="h-[160px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Account</TableHead>
                            <TableHead>Error</TableHead>
                            <TableHead>Updated</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {provisioningFailures.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-muted-foreground">
                                No provisioning failures detected.
                              </TableCell>
                            </TableRow>
                          ) : (
                            provisioningFailures.map((failure) => (
                              <TableRow key={`${failure.account_id}-${failure.updated_at}`}>
                                <TableCell className="text-sm">
                                  <div className="font-medium text-slate-900">{failure.company_name}</div>
                                  <p className="text-xs text-muted-foreground">
                                    Status: {failure.provisioning_status || "Unknown"}
                                  </p>
                                </TableCell>
                                <TableCell className="text-sm">
                                  <p className="max-w-[200px] truncate text-muted-foreground">
                                    {failure.provisioning_error || "—"}
                                  </p>
                                </TableCell>
                                <TableCell className="text-sm">{formatDateTime(failure.updated_at)}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminMonitoring;
