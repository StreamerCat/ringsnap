#!/usr/bin/env node

type Category = "pstn_customer" | "web_demo" | "web_chat" | "unknown";

type VapiCall = {
  id?: string;
  createdAt?: string;
  startedAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  cost?: number;
  costBreakdown?: Record<string, unknown>;
  type?: string;
  phoneNumberId?: string;
  phoneNumber?: { id?: string; number?: string };
  transport?: { to?: string; from?: string };
  customer?: { number?: string };
  assistant?: { id?: string; metadata?: Record<string, unknown> };
  metadata?: Record<string, unknown>;
};

type TwilioCall = {
  sid: string;
  to: string | null;
  from: string | null;
  duration: string;
  price: string | null;
  start_time: string | null;
};

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1));
  return sortedAsc[idx];
}

function maskPhone(value?: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `***${digits.slice(-4)}`;
}

function classifyCall(call: VapiCall): Category {
  const metadataSource = call.metadata?.source ?? call.assistant?.metadata?.source;
  if (metadataSource === "web_demo") return "web_demo";
  if (metadataSource === "web_chat") return "web_chat";
  if (metadataSource === "pstn_customer") return "pstn_customer";

  const hasPhoneBinding = !!(call.phoneNumber?.id ?? call.phoneNumberId);
  const hasPhoneTransport = !!(call.transport?.to || call.transport?.from || call.customer?.number);
  const isInboundPhoneCall = call.type === "inboundPhoneCall";

  if (hasPhoneBinding || hasPhoneTransport || isInboundPhoneCall) return "pstn_customer";
  return "unknown";
}

function getDurationSeconds(call: VapiCall): number {
  if (typeof call.durationSeconds === "number" && call.durationSeconds > 0) return call.durationSeconds;
  if (call.startedAt && call.endedAt) {
    const seconds = Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  }
  return 0;
}

async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  const response = await fetch(url, init);
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}: ${text.slice(0, 500)}`);
  }
  return data;
}

async function fetchVapiCalls(vapiApiKey: string, limit: number): Promise<VapiCall[]> {
  const endpoints = ["https://api.vapi.ai/call", "https://api.vapi.ai/calls"];
  for (const endpoint of endpoints) {
    try {
      const data = await fetchJson(`${endpoint}?limit=${limit}`, {
        headers: { Authorization: `Bearer ${vapiApiKey}` },
      });
      const calls = Array.isArray(data)
        ? data
        : Array.isArray(data.data)
          ? data.data
          : Array.isArray(data.calls)
            ? data.calls
            : [];
      if (calls.length > 0 || endpoint.endsWith("/call")) {
        return calls;
      }
    } catch (error) {
      if (endpoint.endsWith("/calls")) throw error;
    }
  }
  return [];
}

async function fetchVapiPhoneNumbers(vapiApiKey: string): Promise<Map<string, string>> {
  const data = await fetchJson("https://api.vapi.ai/phone-number?limit=1000", {
    headers: { Authorization: `Bearer ${vapiApiKey}` },
  });
  const rows = Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : [];
  const map = new Map<string, string>();
  for (const row of rows) {
    const id = row?.id;
    const num = row?.number;
    if (typeof id === "string" && typeof num === "string") map.set(id, num);
  }
  return map;
}

async function fetchTwilioCalls(
  accountSid: string,
  authToken: string,
  pageSize = 1000,
): Promise<TwilioCall[]> {
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const base = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json?PageSize=${pageSize}`;
  const data = await fetchJson(base, { headers: { Authorization: `Basic ${auth}` } });
  return Array.isArray(data.calls) ? data.calls : [];
}

function minutes(seconds: number): number {
  return seconds / 60;
}

function buildExampleCalls(): VapiCall[] {
  return [
    {
      id: "call_demo_1",
      type: "webCall",
      durationSeconds: 180,
      cost: 0.54,
      metadata: { source: "web_demo" },
    },
    {
      id: "call_chat_1",
      type: "webCall",
      durationSeconds: 240,
      cost: 0.22,
      metadata: { source: "web_chat" },
    },
    {
      id: "call_pstn_1",
      type: "inboundPhoneCall",
      phoneNumberId: "pn_1",
      durationSeconds: 300,
      cost: 0.8,
      transport: { from: "+17205550111", to: "+17205550222" },
    },
  ];
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const minDuration = toNumber(process.env.COGS_MIN_DURATION_SECONDS, 30);
  const limit = toNumber(process.env.COGS_VAPI_LIMIT, 200);
  const useExample = args.has("--example");

  const vapiApiKey = process.env.VAPI_API_KEY;
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN ?? process.env.TWILIO_API_SECRET;

  if (!useExample && !vapiApiKey) {
    throw new Error("VAPI_API_KEY is required unless --example is used.");
  }

  const calls = useExample ? buildExampleCalls() : await fetchVapiCalls(vapiApiKey!, limit);
  const phoneMap = useExample ? new Map<string, string>([["pn_1", "+17205550222"]]) : await fetchVapiPhoneNumbers(vapiApiKey!);

  const filtered = calls.filter((call) => getDurationSeconds(call) >= minDuration);
  const bucket: Record<Category, Array<{ durationSeconds: number; cost: number; costPerMinute: number; call: VapiCall }>> = {
    pstn_customer: [],
    web_demo: [],
    web_chat: [],
    unknown: [],
  };

  for (const call of filtered) {
    const durationSeconds = getDurationSeconds(call);
    const totalCost = toNumber(call.cost, 0);
    const costPerMinute = durationSeconds > 0 ? totalCost / minutes(durationSeconds) : 0;
    const category = classifyCall(call);
    bucket[category].push({ durationSeconds, cost: totalCost, costPerMinute, call });
  }

  let twilioSummary = { totalMinutes: 0, totalCost: 0, estimatedCostPerMinute: 0, recordsMatched: 0 };

  if (!useExample && twilioSid && twilioToken && bucket.pstn_customer.length > 0) {
    const targetNumbers = new Set<string>();
    for (const row of bucket.pstn_customer) {
      const call = row.call;
      const resolved = call.phoneNumber?.number || (call.phoneNumberId ? phoneMap.get(call.phoneNumberId) : undefined) || call.transport?.to;
      if (resolved) targetNumbers.add(resolved);
    }

    const twilioCalls = await fetchTwilioCalls(twilioSid, twilioToken);
    const matched = twilioCalls.filter((c) => {
      if (!c.start_time) return false;
      return targetNumbers.has(c.to || "") || targetNumbers.has(c.from || "");
    });

    const totalSeconds = matched.reduce((sum, c) => sum + toNumber(c.duration, 0), 0);
    const totalCost = matched.reduce((sum, c) => sum + Math.abs(toNumber(c.price, 0)), 0);
    twilioSummary = {
      totalMinutes: minutes(totalSeconds),
      totalCost,
      estimatedCostPerMinute: totalSeconds > 0 ? totalCost / minutes(totalSeconds) : 0,
      recordsMatched: matched.length,
    };
  }

  console.log(`COGS Report (duration >= ${minDuration}s)`);
  console.log(`Calls analyzed: ${filtered.length}/${calls.length}`);
  console.log("Classification rule:");
  console.log("  1) source metadata => web_demo|web_chat|pstn_customer");
  console.log("  2) else if phoneNumberId or phone transport/inboundPhoneCall => pstn_customer");
  console.log("  3) else => unknown");

  for (const category of Object.keys(bucket) as Category[]) {
    const rows = bucket[category];
    const costPerMin = rows.map((r) => r.costPerMinute).sort((a, b) => a - b);
    const totalSeconds = rows.reduce((sum, r) => sum + r.durationSeconds, 0);

    console.log(`\n[${category}]`);
    console.log(`  count: ${rows.length}`);
    console.log(`  totalMinutes: ${minutes(totalSeconds).toFixed(2)}`);
    console.log(`  avgCostPerMinute: ${(costPerMin.reduce((a, b) => a + b, 0) / (costPerMin.length || 1)).toFixed(4)}`);
    console.log(`  p50CostPerMinute: ${percentile(costPerMin, 50).toFixed(4)}`);
    console.log(`  p90CostPerMinute: ${percentile(costPerMin, 90).toFixed(4)}`);

    if (rows[0]) {
      const sample = rows[0].call;
      console.log(`  sampleCall: id=${sample.id ?? "n/a"} type=${sample.type ?? "n/a"} phoneNumberId=${sample.phoneNumberId ?? sample.phoneNumber?.id ?? "n/a"} from=${maskPhone(sample.transport?.from || sample.customer?.number)} to=${maskPhone(sample.transport?.to || sample.phoneNumber?.number)}`);
    }
  }

  if (bucket.pstn_customer.length > 0) {
    console.log("\n[PSTN Twilio estimate]");
    console.log(`  twilioRecordsMatched: ${twilioSummary.recordsMatched}`);
    console.log(`  twilioTotalMinutes: ${twilioSummary.totalMinutes.toFixed(2)}`);
    console.log(`  twilioTotalCost: ${twilioSummary.totalCost.toFixed(4)}`);
    console.log(`  twilioEstimatedCostPerMinute: ${twilioSummary.estimatedCostPerMinute.toFixed(4)}`);

    const vapiPstnTotalCost = bucket.pstn_customer.reduce((sum, row) => sum + row.cost, 0);
    const vapiPstnMinutes = bucket.pstn_customer.reduce((sum, row) => sum + minutes(row.durationSeconds), 0);
    const combined = vapiPstnTotalCost + twilioSummary.totalCost;
    const combinedPerMinute = vapiPstnMinutes > 0 ? combined / vapiPstnMinutes : 0;

    console.log(`  pstnVapiTotalCost: ${vapiPstnTotalCost.toFixed(4)}`);
    console.log(`  pstnCombinedTotalCost: ${combined.toFixed(4)}`);
    console.log(`  pstnCombinedEstimatedCostPerMinute: ${combinedPerMinute.toFixed(4)}`);
  }
}

main().catch((error) => {
  console.error("cogs-report failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
