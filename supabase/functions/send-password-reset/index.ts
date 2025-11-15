import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildPasswordSetResetEmail } from "../_shared/auth-email-templates.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/resend-client.ts";
import { createAdminClient, isUserNotFoundError } from "../_shared/auth-utils.ts";

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

    const normalizedEmail = email.toLowerCase().trim();

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

    // Ensure user exists before generating the recovery link
    const { data: userLookup, error: userLookupError } = await supabase.auth.admin.getUserByEmail(
      normalizedEmail
    );

    if (userLookupError) {
      if (!isUserNotFoundError(userLookupError)) {
        console.error("[send-password-reset] getUserByEmail error", userLookupError);
        return new Response(
          JSON.stringify({ error: "Failed to lookup user" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Hide whether the user exists to prevent email enumeration
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!userLookup?.user) {
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetUserId = userLookup.user.id;

    // Generate password reset link
    const siteUrl = Deno.env.get("SITE_URL") || Deno.env.get("VITE_SUPABASE_URL") || "https://getringsnap.com";
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: normalizedEmail,
      options: {
        redirectTo: `${siteUrl}/auth/password?mode=reset`
      }
    });

    if (error) throw error;

    if (!data?.properties?.action_link) {
      console.error("[send-password-reset] Missing action link in generateLink response");
      return new Response(
        JSON.stringify({ error: "Failed to generate password reset link" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user profile for name
    const { data: profile, error: profileError } = await supabase
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
        { name: "user_id", value: targetUserId }
      ]
    });

    if (!emailResult.success) {
      console.error("[send-password-reset] Failed to send password reset email", {
        email,
        error: emailResult.error
      });

      return new Response(
        JSON.stringify({ error: emailResult.error ?? "Failed to send password reset email" }),
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
