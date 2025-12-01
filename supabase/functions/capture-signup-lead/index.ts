/*
 * Edge Function: capture-signup-lead
 *
 * PURPOSE: Capture signup lead data when signup fails or is abandoned
 *
 * Used by:
 * - AI-assisted signup flow when create-trial fails
 * - Traditional signup form when user abandons
 *
 * Input:
 * - email (required)
 * - full_name (optional)
 * - phone (optional)
 * - source (optional, default: "website")
 * - signup_flow (optional, default: "ai-assisted")
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
import { createClient } from "@supabase/supabase-js";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { logError, logInfo, extractCorrelationId } from "../_shared/logging.ts";

const FUNCTION_NAME = "capture-signup-lead";

// Validation schema
const captureLeadSchema = z.object({
  email: z.string().email("Invalid email").max(255),
  full_name: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  source: z.string().max(100).default("website"),
  signup_flow: z.string().max(100).default("ai-assisted"),
  metadata: z.record(z.any()).optional(),
  failure_reason: z.string().max(500).optional(),
  failure_phase: z.string().max(100).optional(),
  ip_address: z.string().max(100).optional(),
  user_agent: z.string().max(500).optional(),
});

serve(async (req: Request) => {
  const correlationId = extractCorrelationId(req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role (to bypass RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse and validate input
    const body = await req.json();
    const validatedData = captureLeadSchema.parse(body);

    logInfo(FUNCTION_NAME, "Capturing signup lead", {
      correlationId,
      email: validatedData.email,
      source: validatedData.source,
      signup_flow: validatedData.signup_flow,
      has_metadata: !!validatedData.metadata,
      failure_reason: validatedData.failure_reason,
    });

    // Check if lead with this email already exists
    const { data: existingLead, error: checkError } = await supabase
      .from("signup_leads")
      .select("id, created_at")
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
      logInfo(FUNCTION_NAME, "Updating existing lead", {
        correlationId,
        lead_id: existingLead.id,
        email: validatedData.email,
      });

      const { data: updatedLead, error: updateError } = await supabase
        .from("signup_leads")
        .update({
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
        })
        .eq("id", existingLead.id)
        .select("id")
        .single();

      if (updateError) {
        throw updateError;
      }

      leadId = updatedLead.id;
    } else {
      // Insert new lead
      logInfo(FUNCTION_NAME, "Creating new lead", {
        correlationId,
        email: validatedData.email,
      });

      const { data: newLead, error: insertError } = await supabase
        .from("signup_leads")
        .insert({
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
        })
        .select("id")
        .single();

      if (insertError) {
        throw insertError;
      }

      leadId = newLead.id;
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
