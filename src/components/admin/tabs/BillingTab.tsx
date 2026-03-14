import { useMemo } from "react";
import { Loader2, DollarSign, TrendingUp, AlertTriangle, CreditCard } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { useAdminAccounts, useAdminPlans, useAdminCallStats } from "@/hooks/useAdminData";
import { Badge } from "@/components/ui/badge";

export function BillingTab() {
  const { data: accounts = [], isLoading: accountsLoading } = useAdminAccounts();
  const { data: plans = [], isLoading: plansLoading } = useAdminPlans();
  const { data: callStats = [] } = useAdminCallStats();

  // Build plan price lookup
  const planLookup = useMemo(() => {
    const map: Record<string, { price: number; name: string; included: number }> = {};
    plans.forEach((p) => {
      map[p.plan_key] = {
        price: p.base_price_cents / 100,
        name: p.display_name,
        included: p.included_minutes,
      };
    });
    return map;
  }, [plans]);

  const metrics = useMemo(() => {
    const active = accounts.filter((a) => a.subscription_status === "active");
    const trials = accounts.filter((a) => a.subscription_status === "trial" || a.trial_active);
    const pastDue = accounts.filter((a) => a.subscription_status === "past_due");

    const mrr = active.reduce((sum, a) => {
      const key = a.plan_key ?? a.plan_type ?? "";
      return sum + (planLookup[key]?.price ?? 0);
    }, 0);

    const trialMrr = trials.reduce((sum, a) => {
      const key = a.plan_key ?? a.plan_type ?? "";
      return sum + (planLookup[key]?.price ?? 0);
    }, 0);

    // Plan breakdown
    const planDist: Record<string, { count: number; mrr: number; name: string }> = {};
    active.forEach((a) => {
      const key = a.plan_key ?? a.plan_type ?? "unknown";
      const info = planLookup[key];
      if (!planDist[key]) planDist[key] = { count: 0, mrr: 0, name: info?.name ?? key };
      planDist[key].count += 1;
      planDist[key].mrr += info?.price ?? 0;
    });

    // Upcoming renewals (accounts with period end in next 7 days)
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingRenewals = accounts.filter((a) => {
      if (!a.current_period_end) return false;
      const end = new Date(a.current_period_end);
      return end >= now && end <= in7Days;
    });

    return { mrr, trialMrr, active, pastDue, trials, planDist, upcomingRenewals };
  }, [accounts, planLookup]);

  // MRR trend: approximate using cumulative signups over time.
  // This is a proxy — it counts cumulative active accounts per week and multiplies
  // by an assumed average plan price ($229). It does not account for churn or upgrades.
  //
  // Post-launch: replace with real Stripe MRR by consuming `customer.subscription.created`
  // and `customer.subscription.deleted` events from the stripe_events table and tracking
  // a running mrr_cents column in a separate revenue_snapshots table.
  const mrrTrendData = useMemo(() => {
    // Group active accounts by signup week for approximation
    const activeAccounts = accounts.filter((a) =>
      ["active", "trial"].includes(a.subscription_status ?? "")
    );

    const weekMap: Record<string, number> = {};
    activeAccounts.forEach((a) => {
      if (!a.created_at) return;
      const d = new Date(a.created_at);
      // Get Monday of that week
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      const key = monday.toISOString().slice(0, 10);
      weekMap[key] = (weekMap[key] ?? 0) + 1;
    });

    const sortedKeys = Object.keys(weekMap).sort();
    // Last 12 weeks
    const last12 = sortedKeys.slice(-12);

    let cumulative = 0;
    return last12.map((weekStart) => {
      cumulative += weekMap[weekStart] ?? 0;
      return {
        week: new Date(weekStart).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        newAccounts: weekMap[weekStart] ?? 0,
        approxMrr: Math.round(cumulative * 229),
      };
    });
  }, [accounts]);

  if (accountsLoading || plansLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-100">Billing & Revenue</h1>
        <p className="text-sm text-gray-500 mt-0.5">MRR, plan distribution, payment health</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AdminKpiCard
          title="Current MRR"
          value={`$${metrics.mrr.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
          subtitle={`${metrics.active.length} active accounts`}
          accent="green"
          icon={<DollarSign className="h-4 w-4" />}
        />
        <AdminKpiCard
          title="Pipeline MRR"
          value={`$${metrics.trialMrr.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
          subtitle={`${metrics.trials.length} trials converting`}
          accent="blue"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <AdminKpiCard
          title="Past Due"
          value={metrics.pastDue.length}
          subtitle="Need payment resolution"
          accent={metrics.pastDue.length > 0 ? "amber" : "default"}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <AdminKpiCard
          title="Upcoming Renewals"
          value={metrics.upcomingRenewals.length}
          subtitle="Next 7 days"
          icon={<CreditCard className="h-4 w-4" />}
        />
      </div>

      {/* MRR trend chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-200">MRR Trend (Approximated)</h2>
            <p className="text-xs text-gray-600 mt-0.5">
              {/* MOCK DATA NOTE */}
              Based on cumulative active account signups × avg price.{" "}
              <span className="text-amber-500">
                TODO: Connect to Stripe subscription events for accurate historical MRR.
              </span>
            </p>
          </div>
        </div>
        {mrrTrendData.length < 2 ? (
          <div className="h-48 flex items-center justify-center text-gray-600 text-sm">
            Not enough data for trend chart
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={mrrTrendData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="week" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 6, fontSize: 12, color: "#e5e7eb" }}
                formatter={(v: number) => [`$${v.toLocaleString()}`, "Approx MRR"]}
              />
              <Line type="monotone" dataKey="approxMrr" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4 }} name="Approx MRR" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Plan breakdown table */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-3">Plan Distribution (Active)</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              {["Plan", "Accounts", "MRR", "Avg Price", "Included Min"].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {Object.entries(metrics.planDist).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-gray-600 text-sm">No active accounts</td>
              </tr>
            ) : (
              Object.entries(metrics.planDist).map(([key, { count, mrr, name }]) => {
                const planInfo = planLookup[key];
                return (
                  <tr key={key} className="hover:bg-gray-800/30">
                    <td className="px-3 py-3">
                      <span className="text-gray-200 font-medium capitalize">{name}</span>
                    </td>
                    <td className="px-3 py-3 font-mono text-gray-400">{count}</td>
                    <td className="px-3 py-3 font-mono text-emerald-400 font-medium">
                      ${mrr.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-3 py-3 font-mono text-gray-400">
                      ${(planInfo?.price ?? 0).toFixed(0)}
                    </td>
                    <td className="px-3 py-3 font-mono text-gray-400">
                      {planInfo?.included ?? "—"} min
                    </td>
                  </tr>
                );
              })
            )}
            {/* Totals row */}
            {Object.keys(metrics.planDist).length > 0 && (
              <tr className="border-t border-gray-700 bg-gray-800/20">
                <td className="px-3 py-3 text-gray-300 font-semibold text-xs uppercase">Total</td>
                <td className="px-3 py-3 font-mono text-gray-300 font-semibold">{metrics.active.length}</td>
                <td className="px-3 py-3 font-mono text-emerald-300 font-semibold">
                  ${metrics.mrr.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </td>
                <td colSpan={2} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Past Due accounts */}
      {metrics.pastDue.length > 0 && (
        <div className="bg-gray-900 border border-amber-800/30 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Past Due Accounts ({metrics.pastDue.length})
          </h2>
          <div className="space-y-1">
            {metrics.pastDue.map((a) => (
              <div key={a.id} className="flex items-center gap-3 text-sm bg-amber-950/20 border border-amber-800/20 rounded px-3 py-2">
                <span className="text-gray-200 font-medium flex-1">{a.company_name}</span>
                <Badge className="bg-amber-900/60 text-amber-400 border border-amber-700/40 text-xs">past due</Badge>
                <span className="text-xs text-gray-500 capitalize">{(a.plan_key ?? a.plan_type ?? "—").replace(/_/g, " ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming renewals */}
      {metrics.upcomingRenewals.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">
            Upcoming Renewals (Next 7 Days)
          </h2>
          <div className="space-y-1">
            {metrics.upcomingRenewals.map((a) => {
              const planInfo = planLookup[a.plan_key ?? a.plan_type ?? ""] ?? null;
              return (
                <div key={a.id} className="flex items-center gap-3 text-sm bg-gray-800/30 rounded px-3 py-2">
                  <span className="text-gray-200 font-medium flex-1">{a.company_name}</span>
                  <span className="text-xs text-gray-500 capitalize">{(a.plan_key ?? "—").replace(/_/g, " ")}</span>
                  <span className="font-mono text-emerald-400 text-xs">${planInfo?.price.toFixed(0) ?? "—"}</span>
                  <span className="text-xs text-gray-600">
                    {a.current_period_end ? new Date(a.current_period_end).toLocaleDateString() : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
