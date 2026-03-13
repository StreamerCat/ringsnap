import { useMemo, useState } from "react";
import { Loader2, Phone, Clock, DollarSign, TrendingUp } from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { useAdminCallStats } from "@/hooks/useAdminData";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function CallsTab() {
  const { data: callStats = [], isLoading } = useAdminCallStats();
  const [dateFilter, setDateFilter] = useState("30");

  const filteredStats = useMemo(() => {
    if (dateFilter === "all") return callStats;
    const days = parseInt(dateFilter);
    const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return callStats.filter((s) => new Date(s.call_date) >= threshold);
  }, [callStats, dateFilter]);

  const totals = useMemo(() => {
    return filteredStats.reduce(
      (acc, s) => ({
        calls: acc.calls + s.call_count,
        minutes: acc.minutes + s.total_call_minutes,
        costCents: acc.costCents + s.total_cost_cents,
        seconds: acc.seconds + s.total_call_seconds,
      }),
      { calls: 0, minutes: 0, costCents: 0, seconds: 0 }
    );
  }, [filteredStats]);

  const avgDuration = totals.calls > 0 ? Math.round(totals.seconds / totals.calls) : 0;

  // Chart data
  const chartData = useMemo(() =>
    filteredStats
      .slice()
      .sort((a, b) => a.call_date.localeCompare(b.call_date))
      .map((s) => ({
        date: new Date(s.call_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        calls: s.call_count,
        minutes: Math.round(s.total_call_minutes),
        cost: parseFloat((s.total_cost_cents / 100).toFixed(2)),
      })),
    [filteredStats]
  );

  // Per-account call breakdown (recent)
  const { data: perAccountCalls = [], isLoading: perAccountLoading } = useQuery({
    queryKey: ["admin-per-account-calls", dateFilter],
    queryFn: async () => {
      const days = dateFilter === "all" ? 365 : parseInt(dateFilter);
      const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from("call_logs")
        .select("account_id, duration_seconds, cost, started_at, accounts!inner(company_name)")
        .gte("started_at", threshold)
        .not("account_id", "is", null);

      if (error) {
        console.warn("call_logs query:", error.message);
        return [];
      }

      // Aggregate by account
      const map: Record<
        string,
        { company_name: string; calls: number; minutes: number; cost: number }
      > = {};
      (data ?? []).forEach((row: Record<string, unknown>) => {
        const aid = row.account_id as string;
        const acc = row.accounts as { company_name: string } | null;
        if (!map[aid]) {
          map[aid] = {
            company_name: acc?.company_name ?? "Unknown",
            calls: 0,
            minutes: 0,
            cost: 0,
          };
        }
        map[aid].calls += 1;
        map[aid].minutes += Math.ceil((Number(row.duration_seconds) || 0) / 60);
        map[aid].cost += Number(row.cost) || 0;
      });

      return Object.entries(map)
        .map(([id, v]) => ({ account_id: id, ...v }))
        .sort((a, b) => b.calls - a.calls)
        .slice(0, 20);
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Call Activity</h1>
          <p className="text-sm text-gray-500 mt-0.5">Volume, minutes consumed, and cost</p>
        </div>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-36 bg-gray-900 border-gray-700 text-gray-300 text-sm h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-gray-900 border-gray-700 text-gray-200">
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AdminKpiCard
          title="Total Calls"
          value={totals.calls.toLocaleString()}
          subtitle="In selected period"
          icon={<Phone className="h-4 w-4" />}
        />
        <AdminKpiCard
          title="Minutes Consumed"
          value={totals.minutes.toFixed(0)}
          subtitle="Billed usage"
          icon={<Clock className="h-4 w-4" />}
        />
        <AdminKpiCard
          title="Avg Duration"
          value={`${avgDuration}s`}
          subtitle="Per call"
        />
        <AdminKpiCard
          title="Vapi Cost"
          value={`$${(totals.costCents / 100).toFixed(2)}`}
          subtitle="Platform cost"
          accent="amber"
          icon={<DollarSign className="h-4 w-4" />}
        />
      </div>

      {/* Call volume chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-4">Daily Call Volume</h2>
        {chartData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-gray-600 text-sm">No data for selected period</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="callGradCalls" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 6, fontSize: 12, color: "#e5e7eb" }}
              />
              <Area type="monotone" dataKey="calls" stroke="#3b82f6" fill="url(#callGradCalls)" strokeWidth={2} dot={false} name="Calls" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Minutes & cost chart */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-200 mb-4">Daily Minutes</h2>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 6, fontSize: 12, color: "#e5e7eb" }} />
                <Bar dataKey="minutes" fill="#10b981" radius={[2, 2, 0, 0]} name="Minutes" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-200 mb-4">Daily Cost ($)</h2>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 6, fontSize: 12, color: "#e5e7eb" }} formatter={(v: number) => [`$${v}`, "Cost"]} />
                <Bar dataKey="cost" fill="#f59e0b" radius={[2, 2, 0, 0]} name="Cost $" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Per-account table */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-3">Top Accounts by Call Volume</h2>
        {perAccountLoading ? (
          <div className="flex h-16 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-blue-400" /></div>
        ) : perAccountCalls.length === 0 ? (
          <p className="text-sm text-gray-600 py-4 text-center">
            No per-account call data available (call_logs table may not have data for this period)
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                {["Account", "Calls", "Minutes", "Vapi Cost"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {perAccountCalls.map((row) => (
                <tr key={row.account_id} className="hover:bg-gray-800/30">
                  <td className="px-3 py-2.5 text-gray-200 font-medium">{row.company_name}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-400">{row.calls}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-400">{row.minutes}</td>
                  <td className="px-3 py-2.5 font-mono text-amber-400">${(row.minutes * 0.05).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
