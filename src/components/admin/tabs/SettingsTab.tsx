import { Loader2, Settings, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAdminPlans } from "@/hooks/useAdminData";

export function SettingsTab() {
  const { data: plans = [], isLoading } = useAdminPlans();

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-100">Settings & Config</h1>
        <p className="text-sm text-gray-500 mt-0.5">Plan configuration, feature flags, and thresholds</p>
      </div>

      {/* Info banner */}
      <div className="bg-blue-950/30 border border-blue-800/30 rounded-lg p-4 flex items-start gap-3">
        <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
        <div className="text-xs text-blue-300">
          <p className="font-medium mb-1">Read-only view</p>
          <p className="text-blue-400/70">
            Plan configuration is managed via database migrations. To update plan limits or pricing, deploy a new migration.
            Feature flags are currently managed in <code className="bg-blue-900/40 px-1 rounded">src/lib/featureFlags.ts</code>.
          </p>
        </div>
      </div>

      {/* Plans table */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-3">Active Plans</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                {[
                  "Plan",
                  "Price",
                  "Included Min",
                  "Overage Rate",
                  "Ceiling Min",
                  "Trial Days",
                  "Trial Min",
                  "Coverage",
                  "Status",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {plans.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-gray-600 text-sm">
                    No plans found in database
                  </td>
                </tr>
              ) : (
                plans.map((plan) => (
                  <tr key={plan.plan_key} className="hover:bg-gray-800/30">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-200 font-medium">{plan.display_name}</span>
                        {plan.is_recommended && (
                          <Badge className="bg-blue-900/60 text-blue-400 border border-blue-700/40 text-[10px]">
                            Recommended
                          </Badge>
                        )}
                        {plan.badge_text && (
                          <Badge className="bg-emerald-900/60 text-emerald-400 border border-emerald-700/40 text-[10px]">
                            {plan.badge_text}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-600 font-mono mt-0.5">{plan.plan_key}</p>
                    </td>
                    <td className="px-3 py-3 font-mono text-emerald-400 font-semibold">
                      ${(plan.base_price_cents / 100).toFixed(0)}/mo
                    </td>
                    <td className="px-3 py-3 font-mono text-gray-300">{plan.included_minutes}</td>
                    <td className="px-3 py-3 font-mono text-amber-400">
                      ${(plan.overage_rate_cents / 100).toFixed(2)}/min
                    </td>
                    <td className="px-3 py-3 font-mono text-gray-500">
                      {(plan as Record<string, unknown>).system_overage_ceiling_minutes as number ?? "—"}
                    </td>
                    <td className="px-3 py-3 font-mono text-gray-400">{plan.trial_days}d</td>
                    <td className="px-3 py-3 font-mono text-gray-400">{plan.trial_minutes}m</td>
                    <td className="px-3 py-3 text-gray-500 text-xs capitalize">
                      {((plan as Record<string, unknown>).coverage_hours as string)?.replace(/_/g, " ") ?? "24/7"}
                    </td>
                    <td className="px-3 py-3">
                      {plan.is_active ? (
                        <Badge className="bg-emerald-900/60 text-emerald-400 border border-emerald-700/40 text-[10px]">active</Badge>
                      ) : (
                        <Badge className="bg-gray-800 text-gray-500 border border-gray-700 text-[10px]">inactive</Badge>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alert thresholds */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-3">Alert Thresholds</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          {[
            { label: "Usage warning level 1", value: "70%", note: "First usage alert" },
            { label: "Usage warning level 2", value: "90%", note: "High usage alert" },
            { label: "Margin alert threshold", value: "< 40%", note: "COGS & Margins tab" },
            { label: "Vapi cost per minute", value: "$0.05", note: "Used in COGS calc" },
            { label: "Fixed phone/SMS cost", value: "$1.17/mo", note: "Per account" },
            { label: "Platform overhead", value: "$1.42/mo", note: "Per account" },
          ].map(({ label, value, note }) => (
            <div key={label} className="bg-gray-800/50 rounded p-3">
              <p className="text-[10px] text-gray-600 uppercase tracking-wider">{label}</p>
              <p className="text-gray-200 font-mono font-semibold mt-1">{value}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">{note}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-600 mt-3">
          TODO: Persist thresholds to a settings table for live editing.
        </p>
      </div>

      {/* Feature flags */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-1">Feature Flags</h2>
        <p className="text-xs text-gray-600 mb-3">
          Currently managed in <code className="bg-gray-800 px-1 rounded text-gray-400">src/lib/featureFlags.ts</code>.{" "}
          TODO: Move to Supabase-backed feature flag table for live toggling.
        </p>
        <div className="bg-amber-950/20 border border-amber-800/30 rounded p-3">
          <p className="text-xs text-amber-400">
            Feature flag management is a future enhancement. Add a <code>feature_flags</code> table
            and build a toggle UI here to enable/disable features without code deploys.
          </p>
        </div>
      </div>
    </div>
  );
}
