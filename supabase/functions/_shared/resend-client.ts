/**
 * Resend.com Email Client
 * Handles all transactional email sending via Resend API
 */

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
  headers?: Record<string, string>;
}

export interface SendEmailResult {
  success: boolean;
  emailId?: string;
  error?: string;
}

/**
 * Send email via Resend API
 */
export async function sendEmail(
  apiKey: string,
  options: EmailOptions
): Promise<SendEmailResult> {
  const from = options.from || Deno.env.get('EMAIL_FROM') || 'RingSnap <noreply@getringsnap.com>';
  const replyTo = options.replyTo || Deno.env.get('EMAIL_REPLY_TO');

  const payload: any = {
    from,
    to: [options.to],
    subject: options.subject,
    html: options.html,
    text: options.text,
    tags: options.tags || [],
    headers: {
      ...options.headers,
      // Disable click tracking for auth links to prevent bot prefetch
      'X-Entity-Ref-ID': crypto.randomUUID(),
    }
  };

  if (replyTo) {
    payload.reply_to = [replyTo];
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend API error:', data);
      return {
        success: false,
        error: data.message || 'Failed to send email'
      };
    }

    return {
      success: true,
      emailId: data.id
    };
  } catch (error) {
    console.error('Failed to send email via Resend:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Log email event to database
 */
export async function logEmailEvent(
  supabaseClient: any,
  emailId: string | undefined,
  emailType: string,
  recipient: string,
  event: string,
  eventData: Record<string, any> = {},
  userId?: string
): Promise<void> {
  const { error } = await supabaseClient
    .from('email_events')
    .insert({
      email_id: emailId,
      email_type: emailType,
      recipient: recipient.toLowerCase(),
      event,
      event_data: eventData,
      user_id: userId
    });

  if (error) {
    console.error('Failed to log email event:', error);
  }
}

/**
 * Build email with proper styling and structure
 */
export function buildEmailHtml(
  title: string,
  content: string,
  logoUrl: string = 'https://getringsnap.com/assets/RS_logo_color.svg'
): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #111827;
      line-height: 1.6;
      margin: 0;
      padding: 0;
      background: #f9fafb;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .card {
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      padding: 40px;
    }
    .logo {
      text-align: center;
      margin-bottom: 24px;
    }
    h1 {
      font-size: 24px;
      color: #111827;
      margin: 0 0 16px 0;
      font-weight: 600;
    }
    p {
      color: #374151;
      margin: 12px 0;
    }
    .button {
      display: inline-block;
      padding: 14px 32px;
      background: #D67256;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 24px 0;
      text-align: center;
    }
    .button:hover {
      background: #c25b42;
    }
    .code {
      background: #f3f4f6;
      padding: 12px 16px;
      border-radius: 6px;
      font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
      font-size: 14px;
      letter-spacing: 0.05em;
      display: inline-block;
      margin: 8px 0;
      color: #1f2937;
    }
    .footer {
      border-top: 1px solid #e5e7eb;
      padding-top: 20px;
      margin-top: 32px;
      font-size: 13px;
      color: #6b7280;
      text-align: center;
    }
    .footer a {
      color: #D67256;
      text-decoration: none;
    }
    .help {
      background: #f0fdf4;
      border-left: 4px solid #22c55e;
      padding: 12px 16px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .warning {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 12px 16px;
      margin: 20px 0;
      border-radius: 4px;
    }
    @media only screen and (max-width: 600px) {
      .card {
        padding: 24px 20px;
      }
      .button {
        display: block;
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">
        <img src="${logoUrl}" alt="RingSnap" height="40">
      </div>
      <h1>${title}</h1>
      ${content}
      <div class="footer">
        <p>Need help? Contact us at <a href="mailto:support@getringsnap.com">support@getringsnap.com</a></p>
        <p>RingSnap - Never miss a call</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Build plain text email
 */
export function buildEmailText(content: string): string {
  return `
${content}

---
Need help? Contact support@getringsnap.com

RingSnap - Never miss a call
  `.trim();
}
