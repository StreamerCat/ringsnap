import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables for provision status route");
}

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })
  : null;

export async function GET(req: NextRequest) {
  if (!supabase) {
    return Response.json({ ok: false, error: "server_not_configured" }, { status: 500 });
  }

  const url = new URL(req.url);
  const jobId = url.searchParams.get("job_id");

  if (!jobId) {
    return Response.json({ ok: false, error: "missing_job_id" }, { status: 400 });
  }

  try {
    const { data: job, error: jobError } = await supabase
      .from("provisioning_jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle();

    if (jobError) {
      throw jobError;
    }

    if (!job) {
      return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    if (job.status === "succeeded") {
      const { data: account, error: accountError } = await supabase
        .from("accounts")
        .select("phone_number_e164")
        .eq("id", job.account_id)
        .maybeSingle();

      if (accountError) {
        throw accountError;
      }

      return Response.json({
        ok: true,
        status: job.status,
        step: job.step,
        phone: account?.phone_number_e164 ?? null,
      });
    }

    return Response.json({
      ok: true,
      status: job.status,
      step: job.step,
      error: job.error ?? null,
    });
  } catch (error) {
    console.error("Provision status error", error);
    const message = error instanceof Error ? error.message : "unknown_error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
