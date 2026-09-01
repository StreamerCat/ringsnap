/**
 * admin-outbound-leads
 *
 * Backs the admin dashboard's Leads tab (cold-outbound pipeline management).
 * Auth: verify_jwt = true (config.toml) plus an explicit staff_roles check
 * inside the function — the pattern from manage-staff-role/index.ts — so
 * only platform_owner/platform_admin can call it. All mutations use the
 * service-role client; reads for the dashboard's table/detail views go
 * directly through RLS (see 20260901203226_outbound_leads_staff_access.sql)
 * and do not go through this function.
 *
 * Body: { action: "import" | "update" | "bulk_schedule" | "trigger_dial_batch" | "run_tool_sync" | "diagnostics", ... }
 *
 * - diagnostics: {} — returns the true lead count via the service-role
 *     client (bypasses RLS), so the dashboard can detect a missing/broken
 *     staff-read RLS policy (which manifests as a silent empty result, not
 *     an error) instead of just "0 leads".
 * - import: { leads: Array<{ business_name?, phone, city?, state?, email?, campaign? }> }
 *     Upserts by phone (lookup-then-insert-or-update, same as add-outbound-dnc).
 * - update: { id, business_name?, city?, state?, email?, notes?, campaign?, status? }
 * - bulk_schedule: { ids: string[], campaign?, scheduled_after? }
 * - trigger_dial_batch: {} — proxies trigger-outbound-calls using CRON_SECRET,
 *     which stays server-side; the dashboard never holds it.
 * - run_tool_sync: { dryRun?: boolean } — proxies outbound-audit's sync mode
 *     using VAPI_TOOL_SECRET, which stays server-side.
 */

import { createClient } from "supabase";
import { corsHeaders } from "../_shared/cors.ts";

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const withCountry = digits.length === 10 ? "1" + digits : digits;
  return "+" + withCountry;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface ImportLeadInput {
  business_name?: string;
  phone: string;
  city?: string;
  state?: string;
  email?: string;
  campaign?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // ── Auth: require an authenticated staff member ──────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "No authorization header" }, 401);
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", "")
  );
  if (userError || !user) {
    return json({ error: "Invalid token" }, 401);
  }

  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["platform_owner", "platform_admin"])
    .maybeSingle();

  if (!staffRole) {
    return json({ error: "Unauthorized - platform_owner or platform_admin access required" }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const action = body.action;

  try {
    if (action === "diagnostics") {
      // Service-role count bypasses RLS entirely. Used by the dashboard to
      // tell "table is genuinely empty" apart from "RLS is silently
      // filtering every row" (a missing/misapplied staff_read_outbound_leads
      // policy) — Postgres RLS default-denies by omitting rows, not by
      // erroring, so the client-side query alone can't distinguish the two.
      const { count, error } = await supabase
        .from("outbound_leads")
        .select("id", { count: "exact", head: true });
      if (error) return json({ error: error.message }, 500);
      return json({ totalLeads: count ?? 0 });
    }

    if (action === "import") {
      const leads = Array.isArray(body.leads) ? (body.leads as ImportLeadInput[]) : [];
      if (leads.length === 0) return json({ error: "leads array required" }, 400);

      let created = 0, updated = 0, skipped = 0;
      const errors: Array<{ phone: string; error: string }> = [];

      for (const lead of leads) {
        if (!lead.phone) { skipped++; continue; }
        const phone = normalizePhone(String(lead.phone));

        const { data: existing, error: lookupError } = await supabase
          .from("outbound_leads")
          .select("id")
          .eq("phone", phone)
          .maybeSingle();

        if (lookupError) { errors.push({ phone, error: lookupError.message }); continue; }

        if (existing) {
          const { error: updateError } = await supabase
            .from("outbound_leads")
            .update({
              business_name: lead.business_name ?? undefined,
              city: lead.city ?? undefined,
              state: lead.state ?? undefined,
              email: lead.email ?? undefined,
              campaign: lead.campaign ?? undefined,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
          if (updateError) { errors.push({ phone, error: updateError.message }); continue; }
          updated++;
        } else {
          const { error: insertError } = await supabase.from("outbound_leads").insert({
            business_name: lead.business_name ?? "Unknown",
            phone,
            city: lead.city ?? null,
            state: lead.state ?? null,
            email: lead.email ?? null,
            campaign: lead.campaign ?? null,
            status: "new",
            source: "admin_import",
          });
          if (insertError) { errors.push({ phone, error: insertError.message }); continue; }
          created++;
        }
      }

      return json({ created, updated, skipped, errors });
    }

    if (action === "update") {
      const id = body.id as string | undefined;
      if (!id) return json({ error: "id required" }, 400);

      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const field of ["business_name", "city", "state", "email", "notes", "campaign", "status"]) {
        if (field in body) patch[field] = body[field];
      }

      const { error } = await supabase.from("outbound_leads").update(patch).eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "bulk_schedule") {
      const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
      if (ids.length === 0) return json({ error: "ids array required" }, 400);

      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if ("campaign" in body) patch.campaign = body.campaign;
      if ("scheduled_after" in body) patch.scheduled_after = body.scheduled_after;

      const { error } = await supabase.from("outbound_leads").update(patch).in("id", ids);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, count: ids.length });
    }

    if (action === "trigger_dial_batch") {
      const cronSecret = Deno.env.get("CRON_SECRET");
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      if (!cronSecret || !supabaseUrl) {
        return json({ error: "CRON_SECRET / SUPABASE_URL not configured" }, 500);
      }

      const res = await fetch(`${supabaseUrl}/functions/v1/trigger-outbound-calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-cron-secret": cronSecret },
        body: "{}",
      });
      const result = await res.json().catch(() => ({}));
      return json({ status: res.status, result }, res.ok ? 200 : 502);
    }

    if (action === "run_tool_sync") {
      const toolSecret = Deno.env.get("VAPI_TOOL_SECRET");
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      if (!toolSecret || !supabaseUrl) {
        return json({ error: "VAPI_TOOL_SECRET / SUPABASE_URL not configured" }, 500);
      }
      const dryRun = body.dryRun !== false; // default true — caller must explicitly pass false to apply

      const res = await fetch(`${supabaseUrl}/functions/v1/outbound-audit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-vapi-secret": toolSecret,
          Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: JSON.stringify({ action: "sync", dryRun }),
      });
      const result = await res.json().catch(() => ({}));
      return json({ status: res.status, result }, res.ok ? 200 : 502);
    }

    return json({ error: `Unknown action: ${String(action)}` }, 400);
  } catch (err: unknown) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
