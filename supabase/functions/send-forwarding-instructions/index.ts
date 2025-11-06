import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { extractCorrelationId, logError, logInfo } from "../_shared/logging.ts";

const FUNCTION_NAME = "send-forwarding-instructions";
const RESEND_API_URL = "https://api.resend.com/emails";
const FROM_ADDRESS = "RingSnap <support@ringsnap.com>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type ForwardingRequest = {
  email?: string;
  phoneNumber?: string;
  companyName?: string | null;
};

type ResendResponse = {
  id?: string;
  object?: string;
  created_at?: string;
};

serve(async (req) => {
  const correlationId = extractCorrelationId(req);
  const baseLogOptions = { functionName: FUNCTION_NAME, correlationId } as const;

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body: ForwardingRequest = await req.json();
    const { email, phoneNumber, companyName } = body;

    if (!email || !phoneNumber) {
      logError("Missing required forwarding fields", {
        ...baseLogOptions,
        context: { emailProvided: Boolean(email), phoneNumberProvided: Boolean(phoneNumber) }
      });

      return new Response(
        JSON.stringify({ success: false, error: "Email and phone number are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      logError("RESEND_API_KEY is not configured", {
        ...baseLogOptions,
        context: { email }
      });

      return new Response(
        JSON.stringify({ success: false, error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formatted = formatPhoneNumber(phoneNumber);
    const cleanDigits = getForwardingDigits(phoneNumber);
    const businessName = companyName?.trim() || "your business";

    logInfo("Dispatching forwarding instructions email", {
      ...baseLogOptions,
      context: {
        email,
        phoneNumber: formatted,
        businessName
      }
    });

    const payload = {
      from: FROM_ADDRESS,
      to: email,
      subject: businessName === "your business"
        ? "Forward calls to your new RingSnap line"
        : `${businessName}: forward calls to your RingSnap line`,
      html: buildHtmlTemplate({ businessName, formattedNumber: formatted, forwardingDigits: cleanDigits }),
      text: buildTextTemplate({ businessName, formattedNumber: formatted, forwardingDigits: cleanDigits })
    };

    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      logError("Resend API returned error for forwarding email", {
        ...baseLogOptions,
        context: {
          status: response.status,
          statusText: response.statusText,
          email
        },
        error: new Error(errorText)
      });

      return new Response(
        JSON.stringify({ success: false, error: "Failed to send forwarding instructions" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendData = (await response.json()) as ResendResponse;

    logInfo("Forwarding instructions email queued", {
      ...baseLogOptions,
      context: {
        email,
        deliveryId: resendData.id ?? null,
        resendObject: resendData.object ?? null
      }
    });

    return new Response(
      JSON.stringify({ success: true, deliveryId: resendData.id ?? null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    logError("Unexpected error sending forwarding instructions", {
      ...baseLogOptions,
      error
    });

    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

type TemplateParams = {
  businessName: string;
  formattedNumber: string;
  forwardingDigits: string;
};

function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const localDigits = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;

  if (localDigits.length === 10) {
    return `(${localDigits.slice(0, 3)}) ${localDigits.slice(3, 6)}-${localDigits.slice(6)}`;
  }

  if (digits.length > 0) {
    return digits;
  }

  return phone;
}

function getForwardingDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }
  return digits;
}

function buildHtmlTemplate({ businessName, formattedNumber, forwardingDigits }: TemplateParams): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>RingSnap Forwarding Instructions</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #f9fafb; margin: 0; padding: 0; }
    .container { max-width: 640px; margin: 0 auto; padding: 32px 20px; }
    .card { background: #ffffff; border-radius: 12px; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08); padding: 32px; }
    h1 { font-size: 24px; margin-bottom: 16px; color: #111827; }
    p { color: #374151; line-height: 1.6; }
    .number { font-size: 28px; font-weight: 700; color: #d95f3c; letter-spacing: 0.05em; margin: 24px 0; }
    .steps { margin: 24px 0; padding-left: 16px; }
    .steps li { margin-bottom: 16px; color: #111827; }
    .code { display: inline-block; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 20px; background: #f3f4f6; padding: 12px 16px; border-radius: 8px; margin-top: 12px; letter-spacing: 0.08em; }
    .footer { font-size: 13px; color: #6b7280; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px; }
    .cta { display: inline-block; padding: 12px 20px; background: #111827; color: #ffffff !important; border-radius: 999px; text-decoration: none; font-weight: 600; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h1>Forward calls to RingSnap</h1>
      <p>Hi ${businessName === "your business" ? "there" : businessName},</p>
      <p>Your RingSnap line is ready to take calls:</p>
      <div class="number">${formattedNumber}</div>
      <p>Forward your existing business line so every call is answered automatically:</p>
      <ol class="steps">
        <li>
          <strong>On your business phone, dial:</strong>
          <div class="code">*72${forwardingDigits}</div>
        </li>
        <li><strong>Wait for the confirmation tone, then hang up.</strong></li>
        <li><strong>Call your business number</strong> to test that RingSnap answers.</li>
      </ol>
      <p>If you ever need to turn off forwarding, dial <span class="code">*73</span>.</p>
      <p>Need carrier-specific steps? Reply to this email and we'll help you set it up.</p>
      <p class="footer">Catch every call. Close more jobs. Sleep easy.<br/>— The RingSnap Team</p>
    </div>
  </div>
</body>
</html>`;
}

function buildTextTemplate({ businessName, formattedNumber, forwardingDigits }: TemplateParams): string {
  const greeting = businessName === "your business" ? "Hi there" : `Hi ${businessName}`;
  return `${greeting},

Your RingSnap line is ready: ${formattedNumber}

Forward your current business line so every call is answered automatically:
1. Dial *72${forwardingDigits}
2. Wait for the confirmation tone, then hang up
3. Call your business number to confirm RingSnap picks up

To disable forwarding later, dial *73.

Need carrier-specific help? Just reply to this email and we'll walk you through it.

Catch every call.
The RingSnap Team`;
}
