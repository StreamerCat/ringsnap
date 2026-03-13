import { useState, useMemo } from "react";
import {
  Search,
  ChevronUp,
  ChevronDown,
  X,
  Copy,
  ExternalLink,
  Loader2,
  Phone,
  Mail,
  Building,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdminAccounts, useAdminAccountDetail, useAdminPlans } from "@/hooks/useAdminData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type SortKey = "company_name" | "subscription_status" | "plan_key" | "created_at" | "minutes_used_current_period";
type SortDir = "asc" | "desc";

// Sub-component: user detail modal
function AccountDetailModal({
  accountId,
  onClose,
}: {
  accountId: string;
  onClose: () => void;
}) {
  const { data: account, isLoading } = useAdminAccountDetail(accountId);
  const { data: callHistory = [] } = useQuery({
    queryKey: ["admin-account-calls", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_logs")
        .select("id, started_at, duration_seconds, from_number, status, summary")
        .eq("account_id", accountId)
        .order("started_at", { ascending: false })
        .limit(10);
      if (error) return [];
      return data ?? [];
    },
  });
  const { toast } = useToast();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `Copied ${label}` });
  };

  if (isLoading || !account) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
      </div>
    );
  }

  const primaryProfile = account.profiles.find((p) => p.is_primary) ?? account.profiles[0];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-100">{account.company_name}</h2>
          <p className="text-xs text-gray-500 mt-0.5 font-mono">{account.id}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-800 text-gray-500 hover:text-gray-300 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-2">
        <StatusBadge status={account.subscription_status} />
        {account.plan_key && (
          <Badge variant="outline" className="text-gray-300 border-gray-700 capitalize text-xs">
            {account.plan_key.replace(/_/g, " ")}
          </Badge>
        )}
        {account.trade && (
          <Badge variant="outline" className="text-gray-500 border-gray-700 capitalize text-xs">
            {account.trade}
          </Badge>
        )}
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        {primaryProfile && (
          <>
            <div>
              <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Contact</p>
              <p className="text-gray-300 font-medium">{primaryProfile.name ?? "—"}</p>
              {primaryProfile.email && (
                <p className="text-gray-500 text-xs flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {primaryProfile.email}
                </p>
              )}
              {primaryProfile.phone && (
                <p className="text-gray-500 text-xs flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {primaryProfile.phone}
                </p>
              )}
            </div>
          </>
        )}
        <div>
          <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Signed Up</p>
          <p className="text-gray-300">
            {account.created_at ? new Date(account.created_at).toLocaleDateString() : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Minutes Used</p>
          <p className="text-gray-300 font-mono">
            {account.minutes_used_current_period ?? account.monthly_minutes_used ?? 0}
          </p>
        </div>
        {account.trial_end_date && (
          <div>
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Trial Ends</p>
            <p className="text-gray-300">{new Date(account.trial_end_date).toLocaleDateString()}</p>
          </div>
        )}
        {account.sales_rep_name && (
          <div>
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Sales Rep</p>
            <p className="text-gray-300">{account.sales_rep_name}</p>
          </div>
        )}
        <div>
          <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Provisioning</p>
          <p className={`text-xs font-mono ${account.provisioning_status === "failed" ? "text-red-400" : "text-gray-400"}`}>
            {account.provisioning_status ?? "—"}
          </p>
        </div>
      </div>

      {/* Stripe IDs */}
      {(account.stripe_customer_id || account.stripe_subscription_id) && (
        <div className="space-y-1">
          <p className="text-[10px] text-gray-600 uppercase tracking-wider">Stripe</p>
          {account.stripe_customer_id && (
            <div className="flex items-center gap-2">
              <code className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded font-mono truncate max-w-xs">
                {account.stripe_customer_id}
              </code>
              <button
                onClick={() => copyToClipboard(account.stripe_customer_id!, "customer ID")}
                className="text-gray-600 hover:text-gray-300 transition-colors"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Flagged reason */}
      {account.flagged_reason && (
        <div className="bg-red-950/30 border border-red-800/40 rounded p-3">
          <p className="text-xs text-red-400 font-semibold mb-1">Flagged</p>
          <p className="text-xs text-red-300">{account.flagged_reason}</p>
        </div>
      )}

      {/* Recent calls */}
      {callHistory.length > 0 && (
        <div>
          <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Recent Calls</p>
          <div className="space-y-1">
            {callHistory.slice(0, 5).map((call: Record<string, unknown>) => (
              <div key={call.id as string} className="flex items-center gap-2 text-xs text-gray-400 bg-gray-800/50 rounded px-2 py-1.5">
                <span className="w-20 text-gray-600">
                  {call.started_at ? new Date(call.started_at as string).toLocaleDateString() : "—"}
                </span>
                <span className="font-mono">{Math.ceil((Number(call.duration_seconds) || 0) / 60)}m</span>
                <span className="text-gray-600">·</span>
                <span className="truncate">{(call.summary as string)?.slice(0, 50) ?? call.status as string ?? "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <Badge variant="outline" className="text-gray-500 border-gray-700 text-xs">Unknown</Badge>;
  const s = status.toLowerCase();
  if (s === "active") return <Badge className="bg-emerald-900/60 text-emerald-400 border border-emerald-700/40 text-xs">{status}</Badge>;
  if (s === "trial") return <Badge className="bg-blue-900/60 text-blue-400 border border-blue-700/40 text-xs">{status}</Badge>;
  if (s === "past_due") return <Badge className="bg-amber-900/60 text-amber-400 border border-amber-700/40 text-xs">past due</Badge>;
  if (["cancelled", "canceled", "churned"].includes(s)) return <Badge className="bg-red-900/60 text-red-400 border border-red-700/40 text-xs">{status}</Badge>;
  return <Badge variant="outline" className="text-gray-400 border-gray-700 text-xs capitalize">{status}</Badge>;
}

export function AccountsTab() {
  const { data: accounts = [], isLoading } = useAdminAccounts();
  const { data: plans = [] } = useAdminPlans();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Build user-displayable profiles index
  const profilesQuery = useQuery({
    queryKey: ["admin-all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, account_id, name, email, is_primary");
      if (error) return {};
      const map: Record<string, { name: string | null; email: string | null }> = {};
      (data ?? []).forEach((p: Record<string, unknown>) => {
        const aid = p.account_id as string;
        if (aid && (!map[aid] || p.is_primary)) {
          map[aid] = { name: p.name as string | null, email: p.email as string | null };
        }
      });
      return map;
    },
    staleTime: 2 * 60_000,
  });
  const profileMap = useMemo(
    () => profilesQuery.data ?? {},
    [profilesQuery.data]
  );

  const planKeys = useMemo(() => {
    const keys = new Set<string>();
    accounts.forEach((a) => {
      if (a.plan_key) keys.add(a.plan_key);
      else if (a.plan_type) keys.add(a.plan_type);
    });
    return Array.from(keys).sort();
  }, [accounts]);

  const filtered = useMemo(() => {
    let result = [...accounts];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.company_name.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q) ||
          profileMap[a.id]?.email?.toLowerCase().includes(q) ||
          profileMap[a.id]?.name?.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((a) => a.subscription_status === statusFilter);
    }

    if (planFilter !== "all") {
      result = result.filter((a) => (a.plan_key ?? a.plan_type) === planFilter);
    }

    result.sort((a, b) => {
      const aVal = a[sortKey] ?? "";
      const bVal = b[sortKey] ?? "";
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [accounts, search, statusFilter, planFilter, sortKey, sortDir, profileMap]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortIcon = ({ key: k }: { key: SortKey }) =>
    sortKey === k ? (
      sortDir === "asc" ? <ChevronUp className="h-3 w-3 inline ml-0.5" /> : <ChevronDown className="h-3 w-3 inline ml-0.5" />
    ) : null;

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-100">Users & Accounts</h1>
        <p className="text-sm text-gray-500 mt-0.5">{accounts.length} total accounts</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-600" />
          <Input
            placeholder="Search company, email, ID…"
            className="pl-8 bg-gray-900 border-gray-700 text-gray-200 placeholder:text-gray-600 focus:border-blue-600 h-9 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 bg-gray-900 border-gray-700 text-gray-300 text-sm h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-gray-900 border-gray-700 text-gray-200">
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="past_due">Past due</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-40 bg-gray-900 border-gray-700 text-gray-300 text-sm h-9">
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent className="bg-gray-900 border-gray-700 text-gray-200">
            <SelectItem value="all">All plans</SelectItem>
            {planKeys.map((k) => (
              <SelectItem key={k} value={k} className="capitalize">
                {k.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-gray-600 self-center">{filtered.length} shown</span>
      </div>

      {/* Split layout: table + detail panel */}
      <div className="flex gap-4 min-h-0">
        {/* Table */}
        <div className={`overflow-x-auto rounded-lg border border-gray-800 flex-1 ${selectedId ? "max-w-none" : ""}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/80">
                {(
                  [
                    { label: "Company", key: "company_name" },
                    { label: "Status", key: "subscription_status" },
                    { label: "Plan", key: "plan_key" },
                    { label: "Minutes", key: "minutes_used_current_period" },
                    { label: "Signed Up", key: "created_at" },
                  ] as { label: string; key: SortKey }[]
                ).map(({ label, key: k }) => (
                  <th
                    key={k}
                    onClick={() => toggleSort(k)}
                    className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-300 select-none whitespace-nowrap"
                  >
                    {label}
                    <SortIcon key={k} />
                  </th>
                ))}
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-600 text-sm">
                    No accounts match your filters
                  </td>
                </tr>
              ) : (
                filtered.map((account) => {
                  const profile = profileMap[account.id];
                  const isSelected = selectedId === account.id;
                  return (
                    <tr
                      key={account.id}
                      onClick={() => setSelectedId(isSelected ? null : account.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-blue-900/20 border-l-2 border-l-blue-600"
                          : "hover:bg-gray-800/40"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-200 truncate max-w-40">
                          {account.company_name}
                        </div>
                        <div className="text-[10px] text-gray-600 font-mono truncate">
                          {account.id.slice(0, 8)}…
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={account.subscription_status} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-400 capitalize">
                          {(account.plan_key ?? account.plan_type ?? "—").replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">
                        {account.minutes_used_current_period ?? account.monthly_minutes_used ?? 0}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {account.created_at ? new Date(account.created_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-gray-400 truncate max-w-32">{profile?.name ?? "—"}</div>
                        <div className="text-[10px] text-gray-600 truncate max-w-32">{profile?.email ?? ""}</div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        {selectedId && (
          <div className="w-80 shrink-0 bg-gray-900 border border-gray-800 rounded-lg p-4 overflow-y-auto max-h-[600px]">
            <AccountDetailModal accountId={selectedId} onClose={() => setSelectedId(null)} />
          </div>
        )}
      </div>
    </div>
  );
}
