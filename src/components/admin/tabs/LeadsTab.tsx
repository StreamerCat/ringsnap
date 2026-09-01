import { useMemo, useRef, useState } from "react";
import {
  Search,
  ChevronUp,
  ChevronDown,
  X,
  Loader2,
  Upload,
  PhoneOutgoing,
  RefreshCw,
  Wrench,
  ShieldOff,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  useAdminOutboundLeads,
  useAdminOutboundCallLog,
  useAdminOutboundCheckoutLog,
  useAdminOutboundPipelineHealth,
  type OutboundLead,
} from "@/hooks/useAdminData";

type SortKey = "business_name" | "status" | "campaign" | "created_at";
type SortDir = "asc" | "desc";

async function callAdminOutboundLeads(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("admin-outbound-leads", { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "new") return <Badge className="bg-blue-900/60 text-blue-400 border border-blue-700/40 text-xs">new</Badge>;
  if (s === "checkout_sent") return <Badge className="bg-emerald-900/60 text-emerald-400 border border-emerald-700/40 text-xs">checkout sent</Badge>;
  if (s === "dnc") return <Badge className="bg-red-900/60 text-red-400 border border-red-700/40 text-xs">DNC</Badge>;
  return <Badge variant="outline" className="text-gray-400 border-gray-700 text-xs capitalize">{status}</Badge>;
}

// ── Pipeline health card ──────────────────────────────────────────────────────

function PipelineHealthCard() {
  const { data: health, isLoading, refetch, isRefetching } = useAdminOutboundPipelineHealth();
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [dialing, setDialing] = useState(false);

  const tools = health?.vapiAssistant?.referencedTools ?? [];
  const toolNames = tools.map((t) => t.name).filter(Boolean);
  const expected = ["create_agent_trial", "send_link", "add_to_dnc", "end_call"];
  const hasWrongTool = toolNames.includes("create_trial");
  const missingExpected = expected.filter((n) => !toolNames.includes(n));
  const wiringOk = !hasWrongTool && missingExpected.length === 0 && tools.length > 0;

  const handleSync = async (dryRun: boolean) => {
    setSyncing(true);
    try {
      const result = await callAdminOutboundLeads({ action: "run_tool_sync", dryRun });
      if (dryRun) {
        toast({ title: "Dry run complete", description: "Review the planned actions, then apply." });
        console.info("outbound-audit sync (dry run):", result);
      } else {
        toast({ title: "Assistant tools synced" });
        refetch();
      }
    } catch (err: unknown) {
      toast({ title: "Sync failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const handleDial = async () => {
    setDialing(true);
    try {
      const result = await callAdminOutboundLeads({ action: "trigger_dial_batch" });
      toast({ title: "Dial batch triggered", description: JSON.stringify(result.result ?? result) });
    } catch (err: unknown) {
      toast({ title: "Trigger failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setDialing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex items-center justify-center h-24">
        <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-200">Pipeline Health</h2>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isRefetching} className="h-7 px-2 text-gray-400">
          <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {Object.entries(health?.envPresent ?? {}).map(([key, present]) => (
          <div key={key} className="flex items-center gap-1.5 bg-gray-800/50 rounded px-2 py-1.5">
            {present ? <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" /> : <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />}
            <span className="text-gray-400 truncate">{key}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 text-xs">
        {wiringOk ? (
          <Badge className="bg-emerald-900/60 text-emerald-400 border border-emerald-700/40">Assistant tools OK</Badge>
        ) : (
          <Badge className="bg-amber-900/60 text-amber-400 border border-amber-700/40">
            {hasWrongTool ? "create_trial still attached" : "Tool wiring needs sync"}
          </Badge>
        )}
        {health?.twilioFromNumber?.smsCapable === false && (
          <Badge className="bg-red-900/60 text-red-400 border border-red-700/40">Twilio number not SMS-capable</Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={() => handleSync(true)} disabled={syncing} className="h-7 text-xs border-gray-700 text-gray-300">
          <Wrench className="h-3 w-3 mr-1" /> Preview tool sync
        </Button>
        <Button variant="outline" size="sm" onClick={() => handleSync(false)} disabled={syncing} className="h-7 text-xs border-amber-700 text-amber-400 hover:bg-amber-900/30">
          {syncing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Wrench className="h-3 w-3 mr-1" />} Apply tool sync
        </Button>
        <Button variant="outline" size="sm" onClick={handleDial} disabled={dialing} className="h-7 text-xs border-blue-700 text-blue-400 hover:bg-blue-900/30">
          {dialing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <PhoneOutgoing className="h-3 w-3 mr-1" />} Run dial batch now
        </Button>
      </div>
      <p className="text-[10px] text-gray-600">
        "Run dial batch now" respects the OUTBOUND_DIALER_LIVE secret — it stays dry-run (logs intent only) until that's set to "true" in Supabase.
      </p>
    </div>
  );
}

// ── Import panel ──────────────────────────────────────────────────────────────

interface ParsedRow {
  business_name?: string;
  phone: string;
  city?: string;
  state?: string;
  email?: string;
  campaign?: string;
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const rows: ParsedRow[] = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(",").map((c) => c.trim());
    const row: Record<string, string> = {};
    header.forEach((h, i) => { row[h] = cells[i] ?? ""; });
    if (!row.phone) continue;
    rows.push({
      business_name: row.business_name || undefined,
      phone: row.phone,
      city: row.city || undefined,
      state: row.state || undefined,
      email: row.email || undefined,
      campaign: row.campaign || undefined,
    });
  }
  return rows;
}

function ImportPanel({ onImported }: { onImported: () => void }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);

  const handleFile = async (file: File) => {
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length === 0) {
      toast({ title: "No rows found", description: "Expected a header row with at least a phone column.", variant: "destructive" });
      return;
    }
    setRows(parsed);
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const result = await callAdminOutboundLeads({ action: "import", leads: rows });
      toast({
        title: "Import complete",
        description: `${result.created} created, ${result.updated} updated, ${result.skipped} skipped${result.errors?.length ? `, ${result.errors.length} errors` : ""}`,
      });
      setRows([]);
      if (fileRef.current) fileRef.current.value = "";
      onImported();
    } catch (err: unknown) {
      toast({ title: "Import failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-200">Import Leads</h2>
        <p className="text-[10px] text-gray-600">CSV columns: business_name, phone, city, state, email, campaign (phone required)</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="text-xs text-gray-400 file:mr-2 file:rounded file:border-0 file:bg-gray-800 file:px-2 file:py-1 file:text-xs file:text-gray-300"
        />
        {rows.length > 0 && (
          <Button size="sm" onClick={handleImport} disabled={importing} className="h-7 text-xs">
            {importing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
            Import {rows.length} lead{rows.length === 1 ? "" : "s"}
          </Button>
        )}
      </div>
      {rows.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded border border-gray-800 text-xs">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-800/50 text-gray-500">
                <th className="px-2 py-1 text-left">Business</th>
                <th className="px-2 py-1 text-left">Phone</th>
                <th className="px-2 py-1 text-left">City/State</th>
                <th className="px-2 py-1 text-left">Campaign</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {rows.slice(0, 50).map((r, i) => (
                <tr key={i} className="text-gray-400">
                  <td className="px-2 py-1">{r.business_name ?? "—"}</td>
                  <td className="px-2 py-1 font-mono">{r.phone}</td>
                  <td className="px-2 py-1">{[r.city, r.state].filter(Boolean).join(", ") || "—"}</td>
                  <td className="px-2 py-1">{r.campaign ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 50 && <p className="text-center text-gray-600 py-1">+{rows.length - 50} more</p>}
        </div>
      )}
    </div>
  );
}

// ── Lead detail panel ─────────────────────────────────────────────────────────

function LeadDetailPanel({ lead, onClose, onUpdated }: { lead: OutboundLead; onClose: () => void; onUpdated: () => void }) {
  const { data: calls = [] } = useAdminOutboundCallLog(lead.id);
  const { data: checkouts = [] } = useAdminOutboundCheckoutLog(lead.id);
  const { toast } = useToast();
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [dncing, setDncing] = useState(false);

  const handleSaveNotes = async () => {
    setSaving(true);
    try {
      await callAdminOutboundLeads({ action: "update", id: lead.id, notes });
      toast({ title: "Notes saved" });
      onUpdated();
    } catch (err: unknown) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDnc = async () => {
    setDncing(true);
    try {
      await callAdminOutboundLeads({ action: "update", id: lead.id, status: "dnc" });
      toast({ title: "Added to do-not-call" });
      onUpdated();
    } catch (err: unknown) {
      toast({ title: "Failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setDncing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-100">{lead.business_name ?? "Unknown"}</h2>
          <p className="text-xs text-gray-500 mt-0.5 font-mono">{lead.phone}</p>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-800 text-gray-500 hover:text-gray-300 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <StatusBadge status={lead.status} />
        {lead.campaign && <Badge variant="outline" className="text-gray-400 border-gray-700 text-xs">{lead.campaign}</Badge>}
        {[lead.city, lead.state].filter(Boolean).length > 0 && (
          <Badge variant="outline" className="text-gray-500 border-gray-700 text-xs">{[lead.city, lead.state].filter(Boolean).join(", ")}</Badge>
        )}
      </div>

      {lead.status !== "dnc" && (
        <Button variant="outline" size="sm" onClick={handleDnc} disabled={dncing} className="h-7 text-xs border-red-700 text-red-400 hover:bg-red-900/30">
          {dncing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ShieldOff className="h-3 w-3 mr-1" />} Add to DNC
        </Button>
      )}

      <div>
        <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Notes</p>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="bg-gray-800 border-gray-700 text-gray-200 text-xs min-h-20"
          placeholder="Add notes about this lead…"
        />
        <Button size="sm" onClick={handleSaveNotes} disabled={saving} className="mt-2 h-7 text-xs">
          {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null} Save notes
        </Button>
      </div>

      {calls.length > 0 && (
        <div>
          <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Call Log</p>
          <div className="space-y-1">
            {calls.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-xs text-gray-400 bg-gray-800/50 rounded px-2 py-1.5">
                <span className="w-32 text-gray-600 shrink-0">{new Date(c.created_at).toLocaleString()}</span>
                <span>{c.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {checkouts.length > 0 && (
        <div>
          <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Checkout Log</p>
          <div className="space-y-1">
            {checkouts.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-xs text-gray-400 bg-gray-800/50 rounded px-2 py-1.5">
                <span className="w-32 text-gray-600 shrink-0">{new Date(c.created_at).toLocaleString()}</span>
                <span>{c.plan_key ?? "—"}</span>
                <span className="text-gray-600">·</span>
                <span>{c.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main tab ───────────────────────────────────────────────────────────────────

export function LeadsTab() {
  const { data: leads = [], isLoading, error: leadsError, refetch } = useAdminOutboundLeads();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-outbound-leads"] });

  const campaigns = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => l.campaign && set.add(l.campaign));
    return Array.from(set).sort();
  }, [leads]);

  const filtered = useMemo(() => {
    let result = [...leads];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((l) => l.business_name?.toLowerCase().includes(q) || l.phone.includes(q));
    }
    if (statusFilter !== "all") result = result.filter((l) => l.status === statusFilter);
    if (campaignFilter !== "all") result = result.filter((l) => l.campaign === campaignFilter);
    result.sort((a, b) => {
      const aVal = a[sortKey] ?? "";
      const bVal = b[sortKey] ?? "";
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [leads, search, statusFilter, campaignFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3 inline ml-0.5" /> : <ChevronDown className="h-3 w-3 inline ml-0.5" />) : null;

  const selected = leads.find((l) => l.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-100">Outbound Leads</h1>
        <p className="text-sm text-gray-500 mt-0.5">{leads.length} total leads</p>
      </div>

      <PipelineHealthCard />
      <ImportPanel onImported={() => refetch()} />

      {isLoading ? (
        <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>
      ) : leadsError ? (
        <div className="bg-red-950/20 border border-red-800/30 rounded-lg p-4">
          <p className="text-red-400 text-sm font-medium">Failed to load leads</p>
          <p className="text-red-400/70 text-xs mt-1 font-mono">{leadsError instanceof Error ? leadsError.message : String(leadsError)}</p>
          <p className="text-gray-500 text-xs mt-2">
            If this is a permission error, confirm the staff_read_outbound_leads RLS migration has been applied to this Supabase project.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-48 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-600" />
              <Input
                placeholder="Search business, phone…"
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
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="checkout_sent">Checkout sent</SelectItem>
                <SelectItem value="dnc">DNC</SelectItem>
              </SelectContent>
            </Select>
            <Select value={campaignFilter} onValueChange={setCampaignFilter}>
              <SelectTrigger className="w-40 bg-gray-900 border-gray-700 text-gray-300 text-sm h-9">
                <SelectValue placeholder="Campaign" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700 text-gray-200">
                <SelectItem value="all">All campaigns</SelectItem>
                {campaigns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="ml-auto text-xs text-gray-600 self-center">{filtered.length} shown</span>
          </div>

          <div className="flex gap-4 min-h-0">
            <div className="overflow-x-auto rounded-lg border border-gray-800 flex-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-900/80">
                    {(
                      [
                        { label: "Business", key: "business_name" },
                        { label: "Status", key: "status" },
                        { label: "Campaign", key: "campaign" },
                        { label: "Added", key: "created_at" },
                      ] as { label: string; key: SortKey }[]
                    ).map(({ label, key: k }) => (
                      <th
                        key={k}
                        onClick={() => toggleSort(k)}
                        className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-300 select-none whitespace-nowrap"
                      >
                        {label}
                        <SortIcon k={k} />
                      </th>
                    ))}
                    <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-600 text-sm">No leads match your filters</td></tr>
                  ) : (
                    filtered.map((lead) => {
                      const isSelected = selectedId === lead.id;
                      return (
                        <tr
                          key={lead.id}
                          onClick={() => setSelectedId(isSelected ? null : lead.id)}
                          className={`cursor-pointer transition-colors ${isSelected ? "bg-blue-900/20 border-l-2 border-l-blue-600" : "hover:bg-gray-800/40"}`}
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-200 truncate max-w-40">{lead.business_name ?? "—"}</div>
                            <div className="text-[10px] text-gray-600 truncate">{[lead.city, lead.state].filter(Boolean).join(", ")}</div>
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                          <td className="px-4 py-3 text-xs text-gray-400">{lead.campaign ?? "—"}</td>
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{new Date(lead.created_at).toLocaleDateString()}</td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-400">{lead.phone}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {selected && (
              <div className="w-80 shrink-0 bg-gray-900 border border-gray-800 rounded-lg p-4 overflow-y-auto max-h-[600px]">
                <LeadDetailPanel lead={selected} onClose={() => setSelectedId(null)} onUpdated={invalidate} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
