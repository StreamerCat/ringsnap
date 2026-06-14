/*
 * ═══════════════════════════════════════════════════════════════════════════
 * FUNCTION: rerun-provisioning (ADMIN-ONLY)
 *
 * PURPOSE: Safely rerun provisioning for a specific account or job.
 *          Requires platform_owner, platform_admin, or staff role.
 *
 * INPUT:
 *   { accountId: "uuid" }     — finds most recent job for account
 *   { jobId: "uuid" }         — reruns a specific job
 *   { accountId, force: true} — resets and forces fresh provisioning
 *
 * FLOW:
 *   1. Verify caller is admin via JWT
 *   2. Find the provisioning job
 *   3. Reset job status to "queued", attempts to 0
 *   4. Reset account provisioning_status to "pending"
 *   5. Invoke provision-vapi immediately
 *   6. Return job details
 *
 * IDEMPOTENCY:
 *   - If job is already completed, returns success without re-processing
 *   - If job is already queued/processing, returns current status
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { createClient } from "supabase";
import { extractCorrelationId, logError, logInfo, logWarn } from "../_shared/logging.ts";
import { corsHeaders } from "../_shared/cors.ts";

const FUNCTION_NAME = "rerun-provisioning";

const ADMIN_ROLES = ["platform_owner", "platform_admin", "staff"];

Deno.serve(async (req: Request) => {
  const correlationId = extractCorrelationId(req);
  const baseLogOptions = { functionName: FUNCTION_NAME, correlationId };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // ── Auth: verify JWT and check admin role ──────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check admin role in staff_roles table
    const { data: staffRole } = await supabase
      .from("staff_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!staffRole || !ADMIN_ROLES.includes(staffRole.role)) {
      logWarn("Non-admin attempted rerun-provisioning", {
        ...baseLogOptions,
        context: { userId: user.id, role: staffRole?.role },
      });
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Parse request ─────────────────────────────────────────────
    const payload = await req.json();
    const { accountId, jobId, force } = payload;

    if (!accountId && !jobId) {
      return new Response(
        JSON.stringify({ error: "accountId or jobId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logInfo("Admin rerun-provisioning requested", {
      ...baseLogOptions,
      context: {
        adminUserId: user.id,
        adminRole: staffRole.role,
        accountId,
        jobId,
        force: !!force,
      },
    });

    // ── Find the job ──────────────────────────────────────────────
    let job: any;

    if (jobId) {
      const { data, error } = await supabase
        .from("provisioning_jobs")
        .select("*")
        .eq("id", jobId)
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: "Job not found", details: error?.message }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      job = data;
    } else {
      const { data, error } = await supabase
        .from("provisioning_jobs")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        // No existing job — create a new one for this account
        logInfo("No existing job found, creating new provisioning job", {
          ...baseLogOptions,
          context: { accountId },
        });

        // Look up the account owner
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("account_id", accountId)
          .eq("is_primary", true)
          .maybeSingle();

        const userId = profile?.id || user.id;

        const { data: newJob, error: insertError } = await supabase
          .from("provisioning_jobs")
          .insert({
            account_id: accountId,
            user_id: userId,
            status: "queued",
            job_type: "provision_phone",
            correlation_id: correlationId,
          })
          .select("*")
          .single();

        if (insertError) {
          return new Response(
            JSON.stringify({ error: "Failed to create provisioning job", details: insertError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        job = newJob;
      } else {
        job = data;
      }
    }

    // ── Check if already completed ────────────────────────────────
    if (job.status === "completed" && !force) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Job already completed",
          job: { id: job.id, status: job.status, completed_at: job.completed_at },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Check if already in progress ──────────────────────────────
    if ((job.status === "queued" || job.status === "processing") && !force) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Job already in progress",
          job: { id: job.id, status: job.status },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Reset the job ─────────────────────────────────────────────
    const { error: resetError } = await supabase
      .from("provisioning_jobs")
      .update({
        status: "queued",
        attempts: 0,
        error: null,
        error_code: null,
        error_details: {},
        provisioning_step: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    if (resetError) {
      logError("Failed to reset provisioning job", {
        ...baseLogOptions,
        error: resetError,
        context: { jobId: job.id },
      });
      return new Response(
        JSON.stringify({ error: "Failed to reset job", details: resetError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Reset account provisioning status to pending
    await supabase.rpc("update_provisioning_lifecycle", {
      p_account_id: job.account_id,
      p_status: "pending",
    });

    logInfo("Provisioning job reset to queued", {
      ...baseLogOptions,
      context: { jobId: job.id, accountId: job.account_id },
    });

    // ── Trigger provision-vapi immediately ─────────────────────────
    try {
      await supabase.functions.invoke("provision-vapi", {
        body: { jobId: job.id, triggered_by: "admin-rerun" },
      });
      logInfo("provision-vapi invoked for rerun", {
        ...baseLogOptions,
        context: { jobId: job.id },
      });
    } catch (invokeErr: any) {
      logWarn("provision-vapi invoke failed (will be picked up by cron)", {
        ...baseLogOptions,
        error: invokeErr,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Provisioning job reset and triggered",
        job: {
          id: job.id,
          account_id: job.account_id,
          status: "queued",
          previous_status: job.status,
          previous_attempts: job.attempts,
          admin_user_id: user.id,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    logError("rerun-provisioning failed", {
      ...baseLogOptions,
      error,
    });

    return new Response(
      JSON.stringify({ error: "Internal error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
