import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?target=deno";
import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/auth-utils.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

    // Verify webhook signature (if configured)
    // const signature = req.headers.get('resend-signature');
    // TODO: Implement signature verification for production

    const event: ResendWebhookEvent = await req.json();

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
