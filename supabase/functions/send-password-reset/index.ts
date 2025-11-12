import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildPasswordResetEmail } from "../_shared/email-templates.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/resend-client.ts";

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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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
    await sendEmail(Deno.env.get("RESEND_PROD_KEY")!, {
      from: "RingSnap <support@getringsnap.com>",
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text
    });

    console.log(`Password reset email sent successfully to ${email}`);

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
