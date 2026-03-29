import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildPasswordSetResetEmail } from "../_shared/auth-email-templates.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/resend-client.ts";
import { createAdminClient } from "../_shared/auth-utils.ts";
import { getResendApiKey, getSupabaseServiceRoleKey, getSupabaseUrl } from "../_shared/env.ts";

const { value: SUPABASE_URL, source: supabaseUrlSource } = getSupabaseUrl();
const { value: SUPABASE_SERVICE_ROLE_KEY, source: serviceRoleSource } = getSupabaseServiceRoleKey();
const { value: RESEND_API_KEY, source: resendKeySource } = getResendApiKey();

if (resendKeySource && resendKeySource !== "RESEND_PROD_KEY") {
  console.warn(
    `[send-password-reset] Using fallback Resend key from ${resendKeySource}; configure RESEND_PROD_KEY when possible`
  );
}

if (serviceRoleSource && serviceRoleSource !== "SUPABASE_SERVICE_ROLE_KEY") {
  console.warn(
    `[send-password-reset] Using service role key from ${serviceRoleSource}; set SUPABASE_SERVICE_ROLE_KEY to avoid surprises`
  );
}

if (supabaseUrlSource && supabaseUrlSource !== "SUPABASE_URL") {
  console.warn(
    `[send-password-reset] Using Supabase URL from ${supabaseUrlSource}; prefer SUPABASE_URL for clarity`
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[send-password-reset] Request start (${req.method})`);

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`[send-password-reset] Email received: ${normalizedEmail}`);

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
    console.log("[send-password-reset] Generating recovery link via admin.generateLink");
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: normalizedEmail,
      options: {
        redirectTo: `${siteUrl}/auth/password?mode=reset`
      }
    });

    if (error) {
      console.error("[send-password-reset] generateLink failed", error);
      throw error;
    }

    console.log("[send-password-reset] generateLink succeeded");

    if (!data?.properties?.action_link) {
      console.error("[send-password-reset] Missing action link in generateLink response");
      return new Response(
        JSON.stringify({ error: "Failed to generate password reset link" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user profile for name
    let profile: { name: string | null } | null = null;
    const targetUserId = data.user?.id;
    if (targetUserId) {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", targetUserId)
        .maybeSingle();

      if (profileError && profileError.code !== "PGRST116") {
        console.error("[send-password-reset] Failed to fetch profile", profileError);
        return new Response(
          JSON.stringify({ error: "Failed to load user profile" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      profile = profileData;
    }

    // Build email template using consolidated auth-email-templates
    const emailContent = buildPasswordSetResetEmail(
      data.properties.action_link,
      profile?.name || 'there',
      false, // isFirstTime = false (this is a reset, not initial password set)
      60 // expiresInMinutes
    );

    // Send via Resend
    const emailResult = await sendEmail(RESEND_API_KEY, {
      from: "RingSnap <support@getringsnap.com>",
      to: normalizedEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
      tags: [
        { name: "type", value: "password_reset" },
        ...(data.user?.id ? [{ name: "user_id", value: data.user.id }] : [])
      ]
    });

    if (!emailResult.success) {
      console.error("[send-password-reset] resend failed", {
        email,
        error: emailResult.error
      });

      return new Response(
        JSON.stringify({ error: emailResult.error ?? "Failed to send password reset email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-password-reset] resend succeeded`, {
      email: normalizedEmail,
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
