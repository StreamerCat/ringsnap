import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from "supabase";
import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/auth-utils.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_WEBHOOK_SECRET = Deno.env.get('RESEND_WEBHOOK_SECRET');

/**
 * Verify Resend webhook signature using Svix.
 * Resend signs webhooks with svix-id, svix-timestamp, and svix-signature headers.
 * Signed content: "{svix-id}.{svix-timestamp}.{raw-body}"
 * The secret is prefixed with "whsec_" and is base64-encoded.
 */
async function verifyResendSignature(req: Request, rawBody: string): Promise<boolean> {
  if (!RESEND_WEBHOOK_SECRET) {
    console.warn('[resend-webhook] RESEND_WEBHOOK_SECRET not set — skipping signature verification');
    return true;
  }

  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error('[resend-webhook] Missing svix signature headers');
    return false;
  }

  // Reject timestamps older than 5 minutes to prevent replay attacks
  const timestampMs = parseInt(svixTimestamp) * 1000;
  if (Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
    console.error('[resend-webhook] Timestamp too old — possible replay attack');
    return false;
  }

  try {
    // Strip the "whsec_" prefix and decode the base64 secret
    const secretBase64 = RESEND_WEBHOOK_SECRET.replace(/^whsec_/, '');
    const secretBytes = Uint8Array.from(atob(secretBase64), c => c.charCodeAt(0));

    const key = await crypto.subtle.importKey(
      'raw',
      secretBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
    const signatureBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedContent));
    const computedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));

    // svix-signature may contain multiple space-separated "v1,<sig>" values
    const signatures = svixSignature.split(' ').map(s => s.replace(/^v1,/, ''));
    return signatures.some(sig => sig === computedSignature);
  } catch (err) {
    console.error('[resend-webhook] Signature verification error:', err);
    return false;
  }
}

interface ResendWebhookEvent {
  type: string;
  created_at: string;
  data: {
    email_id?: string;
    from?: string;
    to?: string[];
    subject?: string;
    tags?: Array<{ name: string; value: string }>;
    [key: string]: any;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createAdminClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Read raw body first so we can verify the signature before parsing
    const rawBody = await req.text();

    const isValid = await verifyResendSignature(req, rawBody);
    if (!isValid) {
      console.error('[resend-webhook] Invalid signature — rejecting request');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401 });
    }

    const event: ResendWebhookEvent = JSON.parse(rawBody);

    console.log('Resend webhook event:', event.type, event.data.email_id);

    // Extract recipient email
    const recipient = event.data.to?.[0] || '';
    const emailId = event.data.email_id || '';

    // Find the user by email if exists
    let userId: string | undefined;
    if (recipient) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', recipient.toLowerCase())
        .single();

      userId = profile?.id;
    }

    // Extract email type from tags
    let emailType = 'unknown';
    if (event.data.tags && Array.isArray(event.data.tags)) {
      const typeTag = event.data.tags.find(tag => tag.name === 'type');
      if (typeTag) {
        emailType = typeTag.value;
      }
    }

    // Log the email event
    const { error: logError } = await supabase
      .from('email_events')
      .insert({
        email_id: emailId,
        email_type: emailType,
        recipient: recipient.toLowerCase(),
        event: event.type,
        event_data: event.data,
        user_id: userId
      });

    if (logError) {
      console.error('Failed to log email event:', logError);
    }

    // Handle specific event types
    switch (event.type) {
      case 'email.delivered':
        console.log(`✅ Email delivered to ${recipient}`);
        break;

      case 'email.bounced':
        console.warn(`⚠️ Email bounced for ${recipient}`);
        // Could mark email as invalid in profiles table
        break;

      case 'email.complained':
        console.warn(`⚠️ Spam complaint from ${recipient}`);
        // Could implement auto-unsubscribe logic
        break;

      case 'email.clicked':
        // Track link clicks (though we disable tracking for auth links)
        console.log(`🔗 Link clicked in email to ${recipient}`);
        break;

      case 'email.opened':
        console.log(`📧 Email opened by ${recipient}`);
        break;

      default:
        console.log(`📬 Email event ${event.type} for ${recipient}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in resend-webhook:', error);
    // Return 200 to acknowledge receipt even on error
    // (prevents Resend from retrying on our internal errors)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
