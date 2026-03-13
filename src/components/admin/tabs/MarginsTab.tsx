import { useMemo } from "react";
import { Loader2, BarChart3, AlertTriangle } from "lucide-react";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { useAdminAccounts, useAdminPlans } from "@/hooks/useAdminData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Cost Model ─────────────────────────────────────────────────────────────
// Per the spec:
//   Variable cost: minutes_used × $0.05  (Vapi + Deepgram + ElevenLabs + Twilio bundled)
//   Fixed / phone:  $1.17 / month
//   Platform overhead: $1.42 / month
//   Stripe fee: 2.9% of revenue + $0.30 per transaction

const VAPI_COST_PER_MIN = 0.05;
const FIXED_PHONE_SMS = 1.17;
const FIXED_PLATFORM = 1.42;
const STRIPE_PCT = 0.029;
const STRIPE_FLAT = 0.30;

interface MarginRow {
  account_id: string;
  company_name: string;
  plan_key: string;
  plan_name: string;
  revenue: number;
  vapi_cost: number;
  fixed_cost: number;
  stripe_fee: number;
  total_cogs: number;
  gross_profit: number;
  margin_pct: number;
  minutes_used: number;
  is_alert: boolean;
}

export function MarginsTab() {
  const { data: accounts = [], isLoading: accountsLoading } = useAdminAccounts();
  const { data: plans = [], isLoading: plansLoading } = useAdminPlans();

  // Build plan lookup
  const planLookup = useMemo(() => {
    const map: Record<string, { price: number; name: string; included: number }> = {};
    plans.forEach((p) => {
      map[p.plan_key] = { price: p.base_price_cents / 100, name: p.display_name, included: p.included_minutes };
    });
    return map;
  }, [plans]);

  // Calculate margins per active account
  const marginRows = useMemo((): MarginRow[] => {
    const active = accounts.filter((a) =>
      ["active", "trial"].includes(a.subscription_status ?? "")
    );

    return active.map((a) => {
      const key = a.plan_key ?? a.plan_type ?? "";
      const planInfo = planLookup[key];
      const revenue = planInfo?.price ?? 0;
      const minutesUsed = a.minutes_used_current_period || a.monthly_minutes_used || 0;

      const vapiCost = minutesUsed * VAPI_COST_PER_MIN;
      const fixedCost = FIXED_PHONE_SMS + FIXED_PLATFORM;
      const stripeFee = revenue > 0 ? revenue * STRIPE_PCT + STRIPE_FLAT : 0;
      const totalCogs = vapiCost + fixedCost + stripeFee;
      const grossProfit = revenue - totalCogs;
      const marginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

      // Alert if margin < 40% or COGS > 60% of revenue
      const isAlert = marginPct < 40;

      return {
        account_id: a.id,
        company_name: a.company_name,
        plan_key: key,
        plan_name: planInfo?.name ?? key,
        revenue,
        vapi_cost: vapiCost,
        fixed_cost: fixedCost,
        stripe_fee: stripeFee,
        total_cogs: totalCogs,
        gross_profit: grossProfit,
        margin_pct: marginPct,
        minutes_used: minutesUsed,
        is_alert: isAlert,
      };
    });
  }, [accounts, planLookup]);

  // Aggregate metrics
  const aggregate = useMemo(() => {
    if (marginRows.length === 0) return null;
    const totalRevenue = marginRows.reduce((s, r) => s + r.revenue, 0);
    const totalCogs = marginRows.reduce((s, r) => s + r.total_cogs, 0);
    const totalProfit = totalRevenue - totalCogs;
    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const alertCount = marginRows.filter((r) => r.is_alert).length;
    return { totalRevenue, totalCogs, totalProfit, avgMargin, alertCount };
  }, [marginRows]);

  // Sort: alerts first, then by margin ascending (worst first)
  const sortedRows = useMemo(() =>
    [...marginRows].sort((a, b) => {
      if (a.is_alert !== b.is_alert) return a.is_alert ? -1 : 1;
      return a.margin_pct - b.margin_pct;
    }),
    [marginRows]
  );

  if (accountsLoading || plansLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-100">COGS & Margins</h1>
        <p className="text-sm text-gray-500 mt-0.5">Per-customer cost breakdown and gross margin</p>
      </div>

      {/* Cost model legend */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-xs text-gray-500">
        <p className="font-medium text-gray-400 mb-1">Cost model applied:</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <span>Vapi/telephony: <strong className="text-gray-300">$0.05/min</strong></span>
          <span>Phone/SMS fixed: <strong className="text-gray-300">$1.17/mo</strong></span>
          <span>Platform overhead: <strong className="text-gray-300">$1.42/mo</strong></span>
          <span>Stripe fee: <strong className="text-gray-300">2.9% + $0.30</strong></span>
        </div>
      </div>

      {/* Aggregate KPIs */}
      {aggregate && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <AdminKpiCard
            title="Total Revenue"
            value={`$${aggregate.totalRevenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
            subtitle="Active + trial"
            accent="green"
            icon={<BarChart3 className="h-4 w-4" />}
          />
          <AdminKpiCard
            title="Total COGS"
            value={`$${aggregate.totalCogs.toLocaleString("en-US", { maximumFractionDigits: 2 })}`}
            subtitle="Vapi + fixed + Stripe"
          />
          <AdminKpiCard
            title="Gross Profit"
            value={`$${aggregate.totalProfit.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
            subtitle="Revenue minus COGS"
            accent={aggregate.totalProfit >= 0 ? "green" : "red"}
          />
          <AdminKpiCard
            title="Avg Margin"
            value={`${aggregate.avgMargin.toFixed(1)}%`}
            subtitle={aggregate.alertCount > 0 ? `${aggregate.alertCount} below 40%` : "All healthy"}
            accent={aggregate.avgMargin >= 60 ? "green" : aggregate.avgMargin >= 40 ? "amber" : "red"}
            icon={aggregate.alertCount > 0 ? <AlertTriangle className="h-4 w-4" /> : undefined}
          />
        </div>
      )}

      {/* Per-customer margin table */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-200">Per-Customer Margin Calculator</h2>
          <p className="text-xs text-gray-600 mt-0.5">
            Sorted worst margin first. Minutes from current billing period.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/80">
                {["Customer", "Plan", "Revenue", "Vapi", "Fixed", "Stripe", "COGS", "Profit", "Margin", "Min Used"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-600">
                    No active accounts to analyze
                  </td>
                </tr>
              ) : (
                sortedRows.map((row) => (
                  <tr
                    key={row.account_id}
                    className={`${row.is_alert ? "bg-amber-950/10" : "hover:bg-gray-800/30"} transition-colors`}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {row.is_alert && <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />}
                        <span className="text-gray-200 font-medium truncate max-w-32">{row.company_name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-gray-400 capitalize whitespace-nowrap">
                      {row.plan_name}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-emerald-400">${row.revenue.toFixed(0)}</td>
                    <td className="px-3 py-2.5 font-mono text-gray-400">${row.vapi_cost.toFixed(2)}</td>
                    <td className="px-3 py-2.5 font-mono text-gray-400">${row.fixed_cost.toFixed(2)}</td>
                    <td className="px-3 py-2.5 font-mono text-gray-400">${row.stripe_fee.toFixed(2)}</td>
                    <td className="px-3 py-2.5 font-mono text-gray-300">${row.total_cogs.toFixed(2)}</td>
                    <td className={`px-3 py-2.5 font-mono font-semibold ${row.gross_profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      ${row.gross_profit.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex px-1.5 py-0.5 rounded font-mono font-semibold text-[10px] ${
                          row.margin_pct >= 70
                            ? "bg-emerald-900/50 text-emerald-400"
                            : row.margin_pct >= 40
                            ? "bg-amber-900/50 text-amber-400"
                            : "bg-red-900/50 text-red-400"
                        }`}
                      >
                        {row.margin_pct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-gray-500">{row.minutes_used}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
