/*
 * Edge Function: capture-signup-lead
 *
 * PURPOSE: Capture signup lead data for step progression tracking and abandonment
 *
 * Used by:
 * - AI-assisted signup flow when create-trial fails
 * - Traditional signup form when user abandons
 * - Step-by-step progression tracking (GTM observability)
 *
 * Input:
 * - email (required)
 * - full_name (optional)
 * - phone (optional)
 * - source (optional, default: "website")
 * - signup_flow (optional, default: "ai-assisted")
 * - step_number (optional) - current step in signup flow (1, 2, 3, etc.)
 * - trace_id (optional) - correlation ID for tracing
 * - metadata (optional JSONB):
 *   - companyName
 *   - trade
 *   - website
 *   - primaryGoal
 *   - planType
 *   - any other AI-collected data
 * - failure_reason (optional)
 * - failure_phase (optional)
 * - ip_address (optional)
 * - user_agent (optional)
 *
 * Output:
 * - success: boolean
 * - lead_id: UUID (if success)
 * - message: string
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "supabase";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { logError, logInfo, extractCorrelationId } from "../_shared/logging.ts";
import { parseTraceId, createObservabilityContext } from "../_shared/observability.ts";

const FUNCTION_NAME = "capture-signup-lead";

// Validation schema - extended with step tracking
const captureLeadSchema = z.object({
  email: z.string().email("Invalid email").max(255),
  full_name: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  source: z.string().max(100).default("website"),
  signup_flow: z.string().max(100).default("ai-assisted"),
  step_number: z.number().int().min(1).max(10).optional(), // Track step progression
  trace_id: z.string().max(100).optional(), // Correlation for tracing
  metadata: z.record(z.any()).optional(),
  failure_reason: z.string().max(500).optional(),
  failure_phase: z.string().max(100).optional(),
  ip_address: z.string().max(100).optional(),
  user_agent: z.string().max(500).optional(),
});

serve(async (req: Request) => {
  const correlationId = extractCorrelationId(req);
  const traceId = parseTraceId(req);

  logInfo(FUNCTION_NAME, "capture-signup-lead invoked", {
    method: req.method,
    correlationId,
  });

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role (to bypass RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Initialize observability context
    const obs = createObservabilityContext(supabase, traceId, FUNCTION_NAME);

    // Parse and validate input
    const body = await req.json();
    const validatedData = captureLeadSchema.parse(body);

    // Use trace_id from body if provided, otherwise use header-derived one
    const effectiveTraceId = validatedData.trace_id || traceId;

    logInfo(FUNCTION_NAME, "Capturing signup lead", {
      correlationId,
      email: validatedData.email,
      source: validatedData.source,
      signup_flow: validatedData.signup_flow,
      step_number: validatedData.step_number,
      has_metadata: !!validatedData.metadata,
      failure_reason: validatedData.failure_reason,
    });

    // Check if lead with this email already exists
    const { data: existingLead, error: checkError } = await supabase
      .from("signup_leads")
      .select("id, created_at, last_step")
      .eq("email", validatedData.email)
      .is("completed_at", null) // Only check incomplete leads
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (checkError) {
      throw checkError;
    }

    let leadId: string;

    if (existingLead) {
      // Update existing incomplete lead
      // Only update last_step if newer step provided
      const newStep = validatedData.step_number;
      const currentStep = existingLead.last_step || 0;
      const shouldUpdateStep = newStep && newStep > currentStep;

      logInfo(FUNCTION_NAME, "Updating existing lead", {
        correlationId,
        lead_id: existingLead.id,
        email: validatedData.email,
        current_step: currentStep,
        new_step: newStep,
      });

      const updateData: Record<string, unknown> = {
        full_name: validatedData.full_name || null,
        phone: validatedData.phone || null,
        source: validatedData.source,
        signup_flow: validatedData.signup_flow,
        metadata: validatedData.metadata || {},
        failure_reason: validatedData.failure_reason || null,
        failure_phase: validatedData.failure_phase || null,
        ip_address: validatedData.ip_address || null,
        user_agent: validatedData.user_agent || null,
        updated_at: new Date().toISOString(),
      };

      // Only update trace_id if provided
      if (effectiveTraceId) {
        updateData.trace_id = effectiveTraceId;
      }

      // Only update last_step if it's a higher step
      if (shouldUpdateStep) {
        updateData.last_step = newStep;
      }

      const { data: updatedLead, error: updateError } = await supabase
        .from("signup_leads")
        .update(updateData)
        .eq("id", existingLead.id)
        .select("id")
        .single();

      if (updateError) {
        throw updateError;
      }

      leadId = updatedLead.id;

      // Log system event for step update
      if (shouldUpdateStep) {
        await obs.info("lead_step_updated", {
          lead_id: leadId,
          step: newStep,
        });
      }
    } else {
      // Insert new lead
      logInfo(FUNCTION_NAME, "Creating new lead", {
        correlationId,
        email: validatedData.email,
        step_number: validatedData.step_number,
      });

      const insertData: Record<string, unknown> = {
        email: validatedData.email,
        full_name: validatedData.full_name || null,
        phone: validatedData.phone || null,
        source: validatedData.source,
        signup_flow: validatedData.signup_flow,
        metadata: validatedData.metadata || {},
        failure_reason: validatedData.failure_reason || null,
        failure_phase: validatedData.failure_phase || null,
        ip_address: validatedData.ip_address || null,
        user_agent: validatedData.user_agent || null,
      };

      // Add step tracking fields
      if (validatedData.step_number) {
        insertData.last_step = validatedData.step_number;
      }
      if (effectiveTraceId) {
        insertData.trace_id = effectiveTraceId;
      }

      const { data: newLead, error: insertError } = await supabase
        .from("signup_leads")
        .insert(insertData)
        .select("id")
        .single();

      if (insertError) {
        throw insertError;
      }

      leadId = newLead.id;

      // Log system event for new lead
      await obs.info("lead_created", {
        lead_id: leadId,
        step: validatedData.step_number || 1,
      });
    }

    logInfo(FUNCTION_NAME, "Lead captured successfully", {
      correlationId,
      lead_id: leadId,
      email: validatedData.email,
    });

    return new Response(
      JSON.stringify({
        success: true,
        lead_id: leadId,
        message: "Lead captured successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    logError(FUNCTION_NAME, "Failed to capture lead", error, { correlationId });

    // Validation errors
    if (error.name === "ZodError") {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Invalid input",
          errors: error.errors,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Database errors
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || "Failed to capture lead",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
