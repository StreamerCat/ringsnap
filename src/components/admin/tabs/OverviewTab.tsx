import { useMemo } from "react";
import { Loader2, DollarSign, Users, TrendingUp, Phone, AlertTriangle, Activity } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { useAdminAccounts, useAdminCallStats, useAdminPlans } from "@/hooks/useAdminData";

export function OverviewTab() {
  const { data: accounts = [], isLoading: accountsLoading } = useAdminAccounts();
  const { data: callStats = [], isLoading: callStatsLoading } = useAdminCallStats();
  const { data: plans = [] } = useAdminPlans();

  // Build plan price lookup from DB
  const planPriceLookup = useMemo(() => {
    const map: Record<string, number> = {};
    plans.forEach((p) => {
      map[p.plan_key] = p.base_price_cents;
    });
    return map;
  }, [plans]);

  const kpis = useMemo(() => {
    const active = accounts.filter((a) => a.subscription_status === "active");
    const trials = accounts.filter(
      (a) => a.subscription_status === "trial" || a.trial_active
    );
    const pastDue = accounts.filter((a) => a.subscription_status === "past_due");
    const churned = accounts.filter((a) =>
      ["cancelled", "canceled", "inactive", "churned"].includes(
        a.subscription_status?.toLowerCase() ?? ""
      )
    );

    // MRR: sum base prices for active accounts (from plans table when available)
    const mrr = active.reduce((sum, acc) => {
      const key = acc.plan_key ?? acc.plan_type ?? "";
      const cents = planPriceLookup[key] ?? 0;
      return sum + cents;
    }, 0);

    // Churn rate: churned / (active + churned) — rough approximation
    const churnDenom = active.length + churned.length;
    const churnRate = churnDenom > 0 ? ((churned.length / churnDenom) * 100).toFixed(1) : "0.0";

    // Today's calls
    const today = new Date().toISOString().slice(0, 10);
    const todayStat = callStats.find((s) => s.call_date === today);
    const todayCalls = todayStat?.call_count ?? 0;
    const todayCostCents = todayStat?.total_cost_cents ?? 0;

    return {
      mrr: mrr / 100,
      activeCount: active.length,
      trialCount: trials.length,
      pastDueCount: pastDue.length,
      churnRate,
      todayCalls,
      todayCostDollars: todayCostCents / 100,
    };
  }, [accounts, callStats, planPriceLookup]);

  // Last 30 days call chart data
  const chartData = useMemo(() => {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - 30);
    return callStats
      .filter((s) => new Date(s.call_date) >= threshold)
      .map((s) => ({
        date: new Date(s.call_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        calls: s.call_count,
        minutes: Math.round(s.total_call_minutes),
        cost: (s.total_cost_cents / 100).toFixed(2),
      }));
  }, [callStats]);

  // Plan distribution
  const planDistribution = useMemo(() => {
    const activeAccounts = accounts.filter((a) => a.subscription_status === "active");
    const dist: Record<string, number> = {};
    activeAccounts.forEach((a) => {
      const key = a.plan_key ?? a.plan_type ?? "unknown";
      dist[key] = (dist[key] ?? 0) + 1;
    });
    return Object.entries(dist).sort((a, b) => b[1] - a[1]);
  }, [accounts]);

  if (accountsLoading || callStatsLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-100">Overview</h1>
        <p className="text-sm text-gray-500 mt-0.5">Platform health at a glance</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <AdminKpiCard
          title="MRR"
          value={`$${kpis.mrr.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
          subtitle="Active subscriptions"
          accent="green"
          icon={<DollarSign className="h-4 w-4" />}
        />
        <AdminKpiCard
          title="Active"
          value={kpis.activeCount}
          subtitle="Paying customers"
          accent="green"
          icon={<Users className="h-4 w-4" />}
        />
        <AdminKpiCard
          title="Trials"
          value={kpis.trialCount}
          subtitle="In trial window"
          accent="blue"
          icon={<Activity className="h-4 w-4" />}
        />
        <AdminKpiCard
          title="Past Due"
          value={kpis.pastDueCount}
          subtitle="Payment needed"
          accent={kpis.pastDueCount > 0 ? "amber" : "default"}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <AdminKpiCard
          title="Churn Rate"
          value={`${kpis.churnRate}%`}
          subtitle="Rough estimate"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <AdminKpiCard
          title="Calls Today"
          value={kpis.todayCalls}
          subtitle={`~$${kpis.todayCostDollars.toFixed(2)} cost`}
          icon={<Phone className="h-4 w-4" />}
        />
      </div>

      {/* Call Volume Chart (Last 30 days) */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-gray-200">Call Volume — Last 30 Days</h2>
          <p className="text-xs text-gray-500">Daily call count across all accounts</p>
        </div>
        {chartData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-gray-600 text-sm">
            No call data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="callGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#6b7280", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "#6b7280", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#111827",
                  border: "1px solid #374151",
                  borderRadius: 6,
                  fontSize: 12,
                  color: "#e5e7eb",
                }}
                labelStyle={{ color: "#9ca3af" }}
              />
              <Area
                type="monotone"
                dataKey="calls"
                stroke="#3b82f6"
                fill="url(#callGrad)"
                strokeWidth={2}
                name="Calls"
                dot={false}
                activeDot={{ r: 4, fill: "#3b82f6" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Bottom row: plan distribution + recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Plan Distribution */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">Active Plan Distribution</h2>
          {planDistribution.length === 0 ? (
            <p className="text-sm text-gray-600">No active accounts</p>
          ) : (
            <div className="space-y-2">
              {planDistribution.map(([planKey, count]) => {
                const total = accounts.filter((a) => a.subscription_status === "active").length || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={planKey} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-24 truncate capitalize">
                      {planKey.replace(/_/g, " ")}
                    </span>
                    <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-8 text-right">{count}</span>
                    <span className="text-xs text-gray-600 w-8 text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Account Status Summary */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">Account Status Breakdown</h2>
          {accounts.length === 0 ? (
            <p className="text-sm text-gray-600">No accounts found</p>
          ) : (
            <div className="space-y-2">
              {[
                { label: "Active", filter: "active", color: "bg-emerald-500" },
                { label: "Trial", filter: "trial", color: "bg-blue-500" },
                { label: "Past Due", filter: "past_due", color: "bg-amber-500" },
                { label: "Cancelled", filter: "cancelled", color: "bg-red-600" },
                { label: "Other", filter: "__other", color: "bg-gray-600" },
              ].map(({ label, filter, color }) => {
                let count: number;
                if (filter === "__other") {
                  count = accounts.filter(
                    (a) => !["active", "trial", "past_due", "cancelled", "canceled", "churned"].includes(a.subscription_status?.toLowerCase() ?? "")
                  ).length;
                } else {
                  count = accounts.filter((a) =>
                    filter === "cancelled"
                      ? ["cancelled", "canceled", "churned"].includes(a.subscription_status?.toLowerCase() ?? "")
                      : a.subscription_status?.toLowerCase() === filter
                  ).length;
                }
                const pct = Math.round((count / accounts.length) * 100);
                return (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-20">{label}</span>
                    <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-gray-400 w-6 text-right">{count}</span>
                    <span className="text-xs text-gray-600 w-8 text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
