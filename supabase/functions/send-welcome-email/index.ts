
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildWelcomeEmail } from "../_shared/auth-email-templates.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { sendEmail, logEmailEvent } from "../_shared/resend-client.ts";
import { createAdminClient } from "../_shared/auth-utils.ts";
import { getResendApiKey, getSupabaseServiceRoleKey, getSupabaseUrl } from "../_shared/env.ts";

const { value: SUPABASE_URL } = getSupabaseUrl();
const { value: SUPABASE_SERVICE_ROLE_KEY } = getSupabaseServiceRoleKey();
const { value: RESEND_API_KEY } = getResendApiKey();

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { email, name, userId } = await req.json();

        if (!email) {
            return new Response(
                JSON.stringify({ error: "Email is required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const normalizedEmail = email.toLowerCase().trim();
        const recipientName = name || "there";

        if (!RESEND_API_KEY) {
            console.error("Missing RESEND_API_KEY");
            return new Response(
                JSON.stringify({ error: "Server configuration error" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Determine Dashboard URL (can be from env or hardcoded fallback)
        const siteUrl = Deno.env.get("SITE_URL") || "https://app.getringsnap.com";
        const dashboardLink = `${siteUrl}/dashboard`;

        const emailContent = buildWelcomeEmail(recipientName, dashboardLink);

        const emailResult = await sendEmail(RESEND_API_KEY, {
            from: "RingSnap <support@getringsnap.com>",
            to: normalizedEmail,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text,
            tags: [
                { name: "type", value: "welcome_email" },
                { name: "user_id", value: userId || "unknown" }
            ]
        });

        if (!emailResult.success) {
            console.error("Failed to send welcome email", emailResult.error);
            return new Response(
                JSON.stringify({ error: emailResult.error }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Log event in background if DB access is available
        if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
            const supabase = createAdminClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
            await logEmailEvent(
                supabase,
                emailResult.emailId,
                "welcome_email",
                normalizedEmail,
                "sent",
                { userId },
                userId
            );
        }

        return new Response(
            JSON.stringify({ success: true, emailId: emailResult.emailId }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Error sending welcome email:", error);
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
