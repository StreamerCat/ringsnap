// Supabase Edge Function: send-outbound-link

// NOTE: For Twilio credentials, set them as Supabase secrets:
// - TWILIO_ACCOUNT_SID
// - TWILIO_AUTH_TOKEN
// - TWILIO_PHONE_NUMBER

interface ToolCallListPayload {
  message?: {
    type?: string;
    toolCallList?: Array<{
      id: string;
      name: string;
      arguments?: Record<string, unknown>;
    }>;
  };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Connection": "keep-alive",
    },
  });
}

function toE164FromPossiblyLocal(input: string) {
  // Strip non-digits
  let digits = input.replace(/\D/g, "");
  // If it's 10 digits, assume US number
  if (digits.length === 10) digits = `1${digits}`;
  // If it already became >10 digits, just prefix +
  return `+${digits}`;
}

Deno.serve(async (req: Request) => {
  let body: ToolCallListPayload | null = null;
  try {
    body = (await req.json()) as ToolCallListPayload;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const toolCall = body?.message?.toolCallList?.[0];

  if (!toolCall || toolCall.name !== "send_link") {
    return json(
      {
        results: [
          {
            toolCallId: toolCall?.id ?? null,
            result: "Unknown tool call",
          },
        ],
      },
      200
    );
  }

  const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
  const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
  const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER")!;

  const args = (toolCall.arguments ?? {}) as {
    contactMobile?: string;
    contactName?: string;
    businessName?: string;
  };

  const { contactMobile, contactName, businessName } = args;

  if (!contactMobile) {
    return json(
      {
        results: [
          {
            toolCallId: toolCall.id,
            result:
              "No mobile number provided. Ask the caller for their mobile number first.",
          },
        ],
      },
      200
    );
  }

  const phone = toE164FromPossiblyLocal(contactMobile);
  const firstName = (contactName || businessName || "there").split(" ")[0];

  const smsBody = `Hi ${firstName}! Here's your RingSnap signup link — start your free 3-day trial (no charge during trial): https://getringsnap.com/start\n\nQuestions? Just reply to this text.`;

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

  const twilioRes = await fetch(twilioUrl, {
    method: "POST",
    headers: {
      "Authorization":
        "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      From: TWILIO_FROM_NUMBER,
      To: phone,
      Body: smsBody,
    }),
  });

  let twilioData: unknown = null;
  try {
    twilioData = await twilioRes.json();
  } catch {
    // ignore non-json responses
  }

  if (twilioRes.ok) {
    return json(
      {
        results: [
          {
            toolCallId: toolCall.id,
            result: `Link sent successfully to ${phone}. The message is on its way.`,
          },
        ],
      },
      200
    );
  }

  console.error("Twilio send failed", {
    status: twilioRes.status,
    body: twilioData,
  });

  return json(
    {
      results: [
        {
          toolCallId: toolCall.id,
          result:
            "Could not send the link right now. Ask the caller to go to getringsnap.com/start directly.",
        },
      ],
    },
    200
  );
});
