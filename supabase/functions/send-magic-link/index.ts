import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { corsHeaders } from '../_shared/cors.ts';
import {
  createMagicLinkToken,
  checkRateLimit,
  logAuthEvent,
  getIpAddress,
  getUserAgent,
  isValidEmail,
  createAdminClient,
  buildAuthUrl
} from '../_shared/auth-utils.ts';
import { sendEmail } from '../_shared/resend-client.ts';
import { buildMagicLinkEmail } from '../_shared/auth-email-templates.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SITE_URL = Deno.env.get('SITE_URL') || 'http://localhost:5173';
const MAGIC_LINK_TTL_MINUTES = parseInt(Deno.env.get('AUTH_MAGIC_LINK_TTL_MINUTES') || '20');

interface RequestBody {
  email: string;
  deviceNonce?: string;
  redirectTo?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createAdminClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { email, deviceNonce, redirectTo }: RequestBody = await req.json();

    // Validate email
    if (!email || !isValidEmail(email)) {
      return new Response(
        JSON.stringify({ error: 'Valid email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const ipAddress = getIpAddress(req);
    const userAgent = getUserAgent(req);

    // Rate limiting: 5 attempts per email per hour
    const rateLimitEmail = await checkRateLimit(
      supabase,
      `magic_link:email:${normalizedEmail}`,
      'send_magic_link',
      { maxAttempts: 5, windowMinutes: 60 }
    );

    if (!rateLimitEmail.allowed) {
      await logAuthEvent(
        supabase,
        null,
        null,
        'magic_link_rate_limited',
        { email: normalizedEmail, reason: 'email' },
        ipAddress,
        userAgent,
        false
      );

      return new Response(
        JSON.stringify({ error: 'Too many attempts. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting: 10 attempts per IP per hour
    if (ipAddress) {
      const rateLimitIp = await checkRateLimit(
        supabase,
        `magic_link:ip:${ipAddress}`,
        'send_magic_link',
        { maxAttempts: 10, windowMinutes: 60 }
      );

      if (!rateLimitIp.allowed) {
        await logAuthEvent(
          supabase,
          null,
          null,
          'magic_link_rate_limited',
          { email: normalizedEmail, reason: 'ip' },
          ipAddress,
          userAgent,
          false
        );

        return new Response(
          JSON.stringify({ error: 'Too many attempts. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id, name, email_verified')
      .eq('email', normalizedEmail)
      .single();

    const userId = existingUser?.id || null;
    const userName = existingUser?.name || undefined;

    // Create magic link token
    const { token, expiresAt } = await createMagicLinkToken(
      supabase,
      normalizedEmail,
      userId,
      MAGIC_LINK_TTL_MINUTES,
      deviceNonce
    );

    // Build magic link URL
    const magicLink = buildAuthUrl(
      SITE_URL,
      '/auth/magic-callback',
      {
        token,
        ...(redirectTo && { redirect: redirectTo })
      }
    );

    // Send email via Resend
    const emailTemplate = buildMagicLinkEmail(magicLink, userName, MAGIC_LINK_TTL_MINUTES);
    const emailResult = await sendEmail(RESEND_API_KEY, {
      to: normalizedEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
      tags: [
        { name: 'type', value: 'magic_link' },
        { name: 'user_exists', value: existingUser ? 'true' : 'false' }
      ]
    });

    if (!emailResult.success) {
      await logAuthEvent(
        supabase,
        userId,
        null,
        'magic_link_send_failed',
        { email: normalizedEmail, error: emailResult.error },
        ipAddress,
        userAgent,
        false
      );

      return new Response(
        JSON.stringify({ error: 'Failed to send magic link email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log successful send
    await logAuthEvent(
      supabase,
      userId,
      null,
      'magic_link_sent',
      { email: normalizedEmail, email_id: emailResult.emailId },
      ipAddress,
      userAgent,
      true
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Magic link sent! Check your email to sign in.',
        expiresAt: expiresAt.toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-magic-link:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
