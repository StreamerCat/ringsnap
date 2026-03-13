import { useMemo, useState } from "react";
import { Loader2, FlaskConical, Clock, TrendingUp, Search } from "lucide-react";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { useAdminAccounts, useAdminPlans } from "@/hooks/useAdminData";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export function TrialsTab() {
  const { data: accounts = [], isLoading } = useAdminAccounts();
  const { data: plans = [] } = useAdminPlans();
  const [search, setSearch] = useState("");

  const planLookup = useMemo(() => {
    const map: Record<string, { name: string; trialMinutes: number }> = {};
    plans.forEach((p) => {
      map[p.plan_key] = { name: p.display_name, trialMinutes: p.trial_minutes };
    });
    return map;
  }, [plans]);

  // Memoized to avoid re-creating on every render (eslint react-hooks/exhaustive-deps)
  const now = useMemo(() => new Date(), []);

  const trialAccounts = useMemo(() => {
    return accounts
      .filter((a) => a.subscription_status === "trial" || a.trial_active)
      .map((a) => {
        const endDate = a.trial_end_date ? new Date(a.trial_end_date) : null;
        const daysLeft = endDate
          ? Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
          : null;
        const planInfo = planLookup[a.plan_key ?? ""] ?? null;
        const trialMinLimit = a.trial_minutes_limit || planInfo?.trialMinutes || 50;
        const usagePct = trialMinLimit > 0
          ? Math.min(100, Math.round((a.trial_minutes_used / trialMinLimit) * 100))
          : 0;

        return { ...a, daysLeft, usagePct, trialMinLimit, planInfo };
      })
      .sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999));
  }, [accounts, planLookup, now]);

  // Conversion metrics
  const conversionMetrics = useMemo(() => {
    const totalActive = accounts.filter((a) => a.subscription_status === "active").length;
    const totalEverTrialed = accounts.filter((a) =>
      ["active", "trial", "cancelled", "canceled"].includes(a.subscription_status ?? "")
    ).length;
    const conversionRate = totalEverTrialed > 0
      ? ((totalActive / totalEverTrialed) * 100).toFixed(1)
      : "0.0";

    // This week's new trials
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const newTrialsThisWeek = accounts.filter(
      (a) =>
        a.subscription_status === "trial" &&
        a.created_at &&
        new Date(a.created_at) >= weekAgo
    ).length;

    return { totalActive, conversionRate, newTrialsThisWeek, totalTrials: trialAccounts.length };
  }, [accounts, trialAccounts, now]);

  // Group by cohort (signup week)
  const cohorts = useMemo(() => {
    const map: Record<string, { trial: number; converted: number; week: string }> = {};
    accounts
      .filter((a) => ["active", "trial", "cancelled", "canceled"].includes(a.subscription_status ?? ""))
      .forEach((a) => {
        if (!a.created_at) return;
        const d = new Date(a.created_at);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(new Date(a.created_at).setDate(diff));
        const key = monday.toISOString().slice(0, 10);
        if (!map[key]) {
          map[key] = {
            trial: 0,
            converted: 0,
            week: monday.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          };
        }
        map[key].trial += 1;
        if (a.subscription_status === "active") map[key].converted += 1;
      });
    return Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 8)
      .map(([, v]) => ({
        ...v,
        rate: v.trial > 0 ? Math.round((v.converted / v.trial) * 100) : 0,
      }));
  }, [accounts]);

  const filteredTrials = useMemo(() => {
    if (!search) return trialAccounts;
    const q = search.toLowerCase();
    return trialAccounts.filter((a) =>
      a.company_name.toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q)
    );
  }, [trialAccounts, search]);

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-100">Trials & Conversion</h1>
        <p className="text-sm text-gray-500 mt-0.5">Active trials, pipeline health, conversion funnel</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AdminKpiCard
          title="Active Trials"
          value={conversionMetrics.totalTrials}
          subtitle="In trial window"
          accent="blue"
          icon={<FlaskConical className="h-4 w-4" />}
        />
        <AdminKpiCard
          title="New This Week"
          value={conversionMetrics.newTrialsThisWeek}
          subtitle="Started trial"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <AdminKpiCard
          title="Conversion Rate"
          value={`${conversionMetrics.conversionRate}%`}
          subtitle="Trial → Active"
          accent={Number(conversionMetrics.conversionRate) >= 30 ? "green" : "amber"}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <AdminKpiCard
          title="Active Paid"
          value={conversionMetrics.totalActive}
          subtitle="Converted"
          accent="green"
        />
      </div>

      {/* Active trial pipeline */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-sm font-semibold text-gray-200 flex-1">Trial Pipeline</h2>
          <div className="relative w-48">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-600" />
            <Input
              placeholder="Search…"
              className="pl-7 h-8 text-xs bg-gray-800 border-gray-700 text-gray-200 placeholder:text-gray-600"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {filteredTrials.length === 0 ? (
          <p className="text-sm text-gray-600 py-4 text-center">No active trials</p>
        ) : (
          <div className="space-y-2">
            {filteredTrials.map((trial) => {
              const urgency =
                trial.daysLeft !== null && trial.daysLeft <= 1
                  ? "critical"
                  : trial.daysLeft !== null && trial.daysLeft <= 2
                  ? "high"
                  : "normal";

              return (
                <div
                  key={trial.id}
                  className={`rounded-lg p-3 border transition-colors ${
                    urgency === "critical"
                      ? "border-red-800/40 bg-red-950/20"
                      : urgency === "high"
                      ? "border-amber-800/40 bg-amber-950/10"
                      : "border-gray-800 bg-gray-800/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-200 truncate">
                          {trial.company_name}
                        </span>
                        <Badge
                          className={`text-[10px] shrink-0 ${
                            urgency === "critical"
                              ? "bg-red-900/60 text-red-400 border-red-700/40"
                              : urgency === "high"
                              ? "bg-amber-900/60 text-amber-400 border-amber-700/40"
                              : "bg-blue-900/60 text-blue-400 border-blue-700/40"
                          }`}
                        >
                          {trial.daysLeft !== null ? `${trial.daysLeft}d left` : "No end date"}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 capitalize">
                        {(trial.plan_key ?? trial.plan_type ?? "—").replace(/_/g, " ")} ·{" "}
                        Started {trial.created_at ? new Date(trial.created_at).toLocaleDateString() : "—"}
                      </p>
                    </div>

                    {/* Usage bar */}
                    <div className="w-28 shrink-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-gray-600">Usage</span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {trial.trial_minutes_used}/{trial.trialMinLimit}m
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            trial.usagePct >= 90
                              ? "bg-red-500"
                              : trial.usagePct >= 70
                              ? "bg-amber-500"
                              : "bg-blue-500"
                          }`}
                          style={{ width: `${trial.usagePct}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-600 mt-0.5 text-right">{trial.usagePct}%</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cohort conversion table */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-3">Cohort Conversion (by Signup Week)</h2>
        <p className="text-xs text-gray-600 mb-3">
          Includes active + trial + cancelled accounts. Conversion = active / total in cohort.{" "}
          <span className="text-amber-500">
            NOTE: true cohort analysis requires tracking original trial start date separately.
          </span>
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              {["Week", "Signups", "Converted", "Rate"].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {cohorts.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-gray-600">No cohort data</td>
              </tr>
            ) : (
              cohorts.map((c, i) => (
                <tr key={i} className="hover:bg-gray-800/30">
                  <td className="px-3 py-2.5 text-gray-300">{c.week}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-400">{c.trial}</td>
                  <td className="px-3 py-2.5 font-mono text-emerald-400">{c.converted}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex px-1.5 py-0.5 rounded font-mono text-[11px] font-semibold ${
                        c.rate >= 50
                          ? "bg-emerald-900/50 text-emerald-400"
                          : c.rate >= 20
                          ? "bg-amber-900/50 text-amber-400"
                          : "bg-gray-800 text-gray-500"
                      }`}
                    >
                      {c.rate}%
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
