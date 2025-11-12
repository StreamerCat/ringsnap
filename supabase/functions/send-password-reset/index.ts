import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildPasswordResetEmail } from "../_shared/email-templates.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/resend-client.ts";
import { createAdminClient } from "../_shared/auth-utils.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const RESEND_PROD_KEY = Deno.env.get("RESEND_PROD_KEY");
const RESEND_LEGACY_KEY = Deno.env.get("RESEND_API_KEY");

if (!RESEND_PROD_KEY && RESEND_LEGACY_KEY) {
  console.warn("[send-password-reset] RESEND_PROD_KEY not set; falling back to RESEND_API_KEY");
}

const RESEND_API_KEY = RESEND_PROD_KEY ?? RESEND_LEGACY_KEY;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[send-password-reset] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return new Response(
        JSON.stringify({ error: "Server configuration error: Missing Supabase credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!RESEND_API_KEY) {
      console.error(
        "[send-password-reset] Missing RESEND_PROD_KEY and RESEND_API_KEY environment variables"
      );
      return new Response(
        JSON.stringify({ error: "Server configuration error: Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createAdminClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Generate password reset link
    const siteUrl = Deno.env.get("SITE_URL") || Deno.env.get("VITE_SUPABASE_URL") || "https://getringsnap.com";
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: `${siteUrl}/auth/password?mode=reset`
      }
    });

    if (error) throw error;

    // Get user profile for name
    const { data: profile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", data.user.id)
      .single();

    // Build email template
    const emailContent = buildPasswordResetEmail({
      recipientName: profile?.name,
      resetLink: data.properties.action_link
    });

    // Send via Resend
    const emailResult = await sendEmail(RESEND_API_KEY, {
      from: "RingSnap <support@getringsnap.com>",
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
      tags: [
        { name: "type", value: "password_reset" },
        { name: "user_id", value: data.user.id }
      ]
    });

    if (!emailResult.success) {
      console.error("[send-password-reset] Failed to send password reset email", {
        email,
        error: emailResult.error
      });

      return new Response(
        JSON.stringify({ error: "Failed to send password reset email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-password-reset] Password reset email sent to ${email}`, {
      emailId: emailResult.emailId
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending password reset:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send password reset email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
