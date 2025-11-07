import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractCorrelationId, logError, logInfo, logWarn, withLogContext } from "../_shared/logging.ts";
import { corsHeaders } from "../_shared/cors.ts";

const FUNCTION_NAME = "notify_number_ready";

interface NotificationPayload {
  type: "phone_ready";
  accountId: string;
  phoneNumber: string;
  userEmail?: string;
  userPhone?: string;
}

async function sendSmsTwilio(
  to: string,
  body: string,
  log: ReturnType<typeof withLogContext>
): Promise<boolean> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const fromNumber = Deno.env.get("NOTIFY_SMS_FROM");

  if (!accountSid || !authToken || !fromNumber) {
    log.warn("Twilio SMS not configured");
    return false;
  }

  try {
    const params = new URLSearchParams({
      To: to,
      From: fromNumber,
      Body: body
    });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: params
      }
    );

    if (response.ok) {
      log.info("SMS sent successfully", {
        recipient: maskPhone(to)
      });
      return true;
    } else {
      const error = await response.text();
      log.error("SMS send failed", new Error(error), {
        status: response.status
      });
      return false;
    }
  } catch (err) {
    log.error("Error sending SMS", err);
    return false;
  }
}

async function sendEmailSendGrid(
  to: string,
  subject: string,
  body: string,
  log: ReturnType<typeof withLogContext>
): Promise<boolean> {
  const apiKey = Deno.env.get("SENDGRID_API_KEY");
  const fromEmail = Deno.env.get("NOTIFY_EMAIL_FROM") || "noreply@getringsnap.com";

  if (!apiKey) {
    return false;
  }

  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: fromEmail },
        subject,
        content: [{ type: "text/html", value: body }]
      })
    });

    if (response.ok) {
      log.info("Email sent via SendGrid", {
        recipient: maskEmail(to)
      });
      return true;
    } else {
      log.warn("SendGrid email send failed", {
        status: response.status
      });
      return false;
    }
  } catch (err) {
    log.error("Error sending email via SendGrid", err);
    return false;
  }
}

async function sendEmailResend(
  to: string,
  subject: string,
  body: string,
  log: ReturnType<typeof withLogContext>
): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("NOTIFY_EMAIL_FROM") || "noreply@getringsnap.com";

  if (!apiKey) {
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: fromEmail,
        to,
        subject,
        html: body
      })
    });

    if (response.ok) {
      log.info("Email sent via Resend", {
        recipient: maskEmail(to)
      });
      return true;
    } else {
      log.warn("Resend email send failed", {
        status: response.status
      });
      return false;
    }
  } catch (err) {
    log.error("Error sending email via Resend", err);
    return false;
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***@***";
  return `${local.slice(0, 2)}***@${domain}`;
}

function maskPhone(phone: string): string {
  return `***${phone.slice(-4)}`;
}

function buildEmailHtml(phoneNumber: string): string {
  const setupUrl = `${Deno.env.get("APP_URL") || "https://app.getringsnap.com"}/settings/phone`;
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; line-height: 1.5; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { text-align: center; margin-bottom: 30px; }
      .phone-number { font-family: 'Monaco', 'Courier New', monospace; font-size: 28px; font-weight: bold; color: #000; background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
      .cta { text-align: center; margin: 30px 0; }
      .button { display: inline-block; padding: 12px 32px; background-color: #000; color: white; text-decoration: none; border-radius: 6px; font-weight: 500; }
      .button:hover { background-color: #333; }
      .steps { background: #f9f9f9; padding: 20px; border-radius: 6px; margin: 20px 0; }
      .step { margin: 10px 0; padding-left: 25px; position: relative; }
      .step:before { content: "✓"; position: absolute; left: 0; color: #4ade80; font-weight: bold; }
      .footer { border-top: 1px solid #e5e5e5; padding-top: 20px; margin-top: 30px; color: #666; font-size: 12px; text-align: center; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h2>Your RingSnap Phone Number is Ready! 🎉</h2>
      </div>

      <p>Great news! Your new local phone number is now active and ready to use.</p>

      <div class="phone-number">${phoneNumber}</div>

      <p>Here's what you can do next:</p>

      <div class="steps">
        <div class="step">Set up call forwarding in your RingSnap workspace</div>
        <div class="step">Share your number with clients and customers</div>
        <div class="step">Start receiving calls with your AI assistant</div>
      </div>

      <div class="cta">
        <a href="${setupUrl}" class="button">Go to RingSnap Settings</a>
      </div>

      <div class="footer">
        <p>Questions? Reply to this email or contact <strong>support@getringsnap.com</strong></p>
        <p>RingSnap - Smart phone answering for service professionals</p>
      </div>
    </div>
  </body>
</html>
  `;
}

serve(async (req) => {
  const correlationId = extractCorrelationId(req);
  const log = withLogContext({ functionName: FUNCTION_NAME, correlationId });

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const payload = (await req.json()) as NotificationPayload;
    const { accountId, phoneNumber, userEmail, userPhone } = payload;

    log.info("Notification request received", {
      hasEmail: !!userEmail,
      hasPhone: !!userPhone
    }, accountId);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: "Configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user details if not provided
    let email = userEmail;
    let phone = userPhone;

    if (!email || !phone) {
      const { data: account } = await supabase
        .from("accounts")
        .select("user_id")
        .eq("id", accountId)
        .single();

      if (account?.user_id) {
        try {
          const { data: user } = await supabase.auth.admin.getUserById(account.user_id);
          email = user?.email || email;
          phone = user?.user_metadata?.phone || phone;
        } catch (err) {
          log.warn("Could not fetch user details", err, { accountId });
        }
      }
    }

    // Compose message
    const htmlBody = buildEmailHtml(phoneNumber);
    const smsBody = `Your RingSnap number ${phoneNumber} is ready! Manage calls at ${Deno.env.get("APP_URL") || "https://app.getringsnap.com"}/settings/phone`;

    // Send notifications
    let emailSent = false;
    let smsSent = false;

    if (email) {
      // Try SendGrid first, then Resend
      emailSent = await sendEmailSendGrid(email, "Your RingSnap Phone Number is Ready", htmlBody, log);
      if (!emailSent) {
        emailSent = await sendEmailResend(email, "Your RingSnap Phone Number is Ready", htmlBody, log);
      }
    }

    if (phone) {
      smsSent = await sendSmsTwilio(phone, smsBody, log);
    }

    log.info("Notification dispatch complete", {
      emailSent,
      smsSent
    }, accountId);

    return new Response(
      JSON.stringify({
        success: emailSent || smsSent,
        emailSent,
        smsSent
      }),
      {
        status: emailSent || smsSent ? 200 : 206,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (err) {
    log.error("Unhandled error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
