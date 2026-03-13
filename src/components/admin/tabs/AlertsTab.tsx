import { useMemo } from "react";
import { Loader2, ShieldAlert, AlertTriangle, CheckCircle, Server, CreditCard, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  useAdminFlaggedAccounts,
  useAdminProvisioningFailures,
  useAdminEdgeFunctionErrors,
  useAdminRecentEvents,
  useAdminUsageAlerts,
} from "@/hooks/useAdminData";

function SeverityBadge({ severity }: { severity: string | null }) {
  const s = severity?.toLowerCase() ?? "low";
  if (s === "critical") return <Badge className="bg-red-900/60 text-red-400 border border-red-700/40 text-[10px]">critical</Badge>;
  if (s === "high") return <Badge className="bg-amber-900/60 text-amber-400 border border-amber-700/40 text-[10px]">high</Badge>;
  if (s === "medium") return <Badge className="bg-blue-900/60 text-blue-400 border border-blue-700/40 text-[10px]">medium</Badge>;
  return <Badge className="bg-gray-800 text-gray-500 border border-gray-700 text-[10px]">low</Badge>;
}

export function AlertsTab() {
  const { data: flagged = [], isLoading: flaggedLoading } = useAdminFlaggedAccounts();
  const { data: failures = [], isLoading: failuresLoading } = useAdminProvisioningFailures();
  const { data: edgeErrors = [], isLoading: edgeLoading } = useAdminEdgeFunctionErrors();
  const { data: recentEvents = [], isLoading: eventsLoading } = useAdminRecentEvents(24);
  const { data: usageAlerts = [] } = useAdminUsageAlerts();

  const systemHealth = useMemo(() => {
    const stripeFailures = recentEvents.filter(
      (e) =>
        (e.event_type.includes("payment") || e.event_type.includes("stripe") || e.event_type.includes("subscription")) &&
        e.event_type.includes("fail")
    ).length;

    const provStarted = recentEvents.filter((e) => e.event_type.includes("provisioning") && e.event_type.includes("start")).length;
    const provCompleted = recentEvents.filter((e) => e.event_type.includes("provisioning") && e.event_type.includes("complet")).length;
    const provFailed = recentEvents.filter((e) => e.event_type.includes("provisioning") && e.event_type.includes("fail")).length;

    const callErrors = recentEvents.filter(
      (e) => (e.event_type.includes("call") || e.event_type.includes("vapi")) && e.event_type.includes("fail")
    ).length;

    const criticalErrors = recentEvents.filter((e) => e.event_type.includes("fail") || e.event_type.includes("error")).slice(0, 20);

    return { stripeFailures, provStarted, provCompleted, provFailed, callErrors, criticalErrors };
  }, [recentEvents]);

  const isLoading = flaggedLoading || failuresLoading || edgeLoading || eventsLoading;

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>;
  }

  const totalAlerts = flagged.length + failures.length + systemHealth.stripeFailures + systemHealth.provFailed;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-100">Abuse & Alerts</h1>
        <p className="text-sm text-gray-500 mt-0.5">Flagged accounts, errors, and system health</p>
      </div>

      {/* System health row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Stripe Health</span>
            <CreditCard className="h-4 w-4 text-gray-600" />
          </div>
          <div className={`text-lg font-bold ${systemHealth.stripeFailures > 0 ? "text-red-400" : "text-emerald-400"}`}>
            {systemHealth.stripeFailures > 0 ? `${systemHealth.stripeFailures} Failures` : "Healthy"}
          </div>
          <p className="text-xs text-gray-600 mt-1">Last 24 hours</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Provisioning</span>
            <Server className="h-4 w-4 text-gray-600" />
          </div>
          <div className="space-y-0.5 text-sm">
            <div className="flex justify-between text-gray-400">
              <span>Started</span>
              <span className="font-mono">{systemHealth.provStarted}</span>
            </div>
            <div className="flex justify-between text-emerald-400">
              <span>Completed</span>
              <span className="font-mono">{systemHealth.provCompleted}</span>
            </div>
            <div className={`flex justify-between ${systemHealth.provFailed > 0 ? "text-red-400" : "text-gray-600"}`}>
              <span>Failed</span>
              <span className="font-mono">{systemHealth.provFailed}</span>
            </div>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Telephony</span>
            <Phone className="h-4 w-4 text-gray-600" />
          </div>
          <div className={`text-lg font-bold ${systemHealth.callErrors > 0 ? "text-red-400" : "text-emerald-400"}`}>
            {systemHealth.callErrors > 0 ? `${systemHealth.callErrors} Errors` : "Healthy"}
          </div>
          <p className="text-xs text-gray-600 mt-1">Last 24 hours</p>
        </div>
      </div>

      {/* Flagged accounts */}
      {flagged.length > 0 && (
        <div className="bg-gray-900 border border-red-800/30 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" /> Flagged Accounts ({flagged.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {["Account", "Status", "Reason", "Alerts", "Minutes", "Last Alert"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {flagged.map((acc) => (
                  <tr key={acc.account_id} className="hover:bg-gray-800/30">
                    <td className="px-3 py-2.5">
                      <span className="text-gray-200 font-medium">{acc.company_name}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge className="bg-gray-800 text-gray-400 border border-gray-700 text-[10px] capitalize">
                        {acc.provisioning_status ?? acc.account_status ?? "unknown"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-500 max-w-xs truncate">
                      {acc.flagged_reason ?? acc.provisioning_error ?? "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      {acc.total_alerts > 0 ? (
                        <span className="font-mono text-amber-400 text-xs">{acc.total_alerts}</span>
                      ) : (
                        <span className="text-gray-600 text-xs">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-gray-500 text-xs">
                      {acc.monthly_minutes_used ?? "—"}/{acc.monthly_minutes_limit ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600 text-xs whitespace-nowrap">
                      {acc.last_alert_at ? new Date(acc.last_alert_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Provisioning failures */}
      {failures.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Provisioning Failures ({failures.length})
          </h2>
          <div className="space-y-2">
            {failures.slice(0, 15).map((f) => (
              <div key={`${f.account_id}-${f.updated_at}`} className="bg-amber-950/10 border border-amber-800/20 rounded p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-sm font-medium text-gray-200">{f.company_name}</span>
                    <Badge className="ml-2 bg-gray-800 text-gray-400 border border-gray-700 text-[10px]">
                      {f.provisioning_status ?? "unknown"}
                    </Badge>
                  </div>
                  <span className="text-xs text-gray-600 whitespace-nowrap">
                    {f.updated_at ? new Date(f.updated_at).toLocaleDateString() : "—"}
                  </span>
                </div>
                {f.provisioning_error && (
                  <p className="text-xs text-amber-400/80 font-mono mt-1.5 line-clamp-2">
                    {f.provisioning_error}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edge function errors */}
      {edgeErrors.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">Edge Function Errors</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800">
                  {["Time", "Function", "Account", "Error", "Severity"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {edgeErrors.slice(0, 25).map((err) => (
                  <tr key={err.id} className="hover:bg-gray-800/30 align-top">
                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                      {err.created_at ? new Date(err.created_at).toLocaleTimeString() : "—"}
                      <div className="text-[10px]">{err.created_at ? new Date(err.created_at).toLocaleDateString() : ""}</div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-blue-400">
                      {err.function_name ?? err.alert_type ?? "unknown"}
                    </td>
                    <td className="px-3 py-2.5 text-gray-400">
                      {err.company_name ?? (err.account_id ? err.account_id.slice(0, 8) + "…" : "—")}
                    </td>
                    <td className="px-3 py-2.5 text-gray-400 max-w-xs">
                      <span className="line-clamp-2">
                        {err.error_message ?? (err.alert_details as Record<string, unknown>)?.message as string ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <SeverityBadge severity={err.severity} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Usage alerts */}
      {usageAlerts.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">Usage Threshold Alerts</h2>
          <div className="space-y-1">
            {usageAlerts.slice(0, 20).map((alert) => (
              <div key={alert.id} className="flex items-center gap-3 bg-gray-800/30 rounded px-3 py-2 text-xs">
                <span className="text-gray-600 whitespace-nowrap">
                  {new Date(alert.sent_at).toLocaleDateString()}
                </span>
                <Badge className="bg-gray-800 text-gray-400 border border-gray-700 text-[10px] font-mono shrink-0">
                  {alert.alert_type}
                </Badge>
                <span className="text-gray-400 truncate">
                  {alert.account_id.slice(0, 8)}…
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent critical errors from analytics events */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-3">System Errors (Last 24h)</h2>
        {systemHealth.criticalErrors.length === 0 ? (
          <div className="flex items-center gap-2 text-emerald-400 text-sm py-4">
            <CheckCircle className="h-4 w-4" />
            <span>No critical errors in the last 24 hours</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800">
                  {["Time", "Event Type", "Error", "Account"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {systemHealth.criticalErrors.map((ev) => {
                  const meta = ev.metadata ?? {};
                  return (
                    <tr key={ev.id} className="hover:bg-gray-800/30">
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                        {new Date(ev.created_at).toLocaleTimeString()}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge className="bg-gray-800 text-gray-400 border border-gray-700 text-[10px] font-mono">
                          {ev.event_type}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-red-400 max-w-xs line-clamp-2">
                        {(meta as Record<string, unknown>).error as string ?? (meta as Record<string, unknown>).message as string ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 font-mono">
                        {ev.account_id ? ev.account_id.slice(0, 8) + "…" : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* All clear state */}
      {totalAlerts === 0 && flagged.length === 0 && failures.length === 0 && edgeErrors.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-600">
          <CheckCircle className="h-12 w-12 text-emerald-600" />
          <p className="text-sm">No active alerts or issues detected</p>
        </div>
      )}
    </div>
  );
}
