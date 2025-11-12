import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
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

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const RESEND_PROD_KEY = Deno.env.get('RESEND_PROD_KEY');
const RESEND_LEGACY_KEY = Deno.env.get('RESEND_API_KEY');

if (!RESEND_PROD_KEY && RESEND_LEGACY_KEY) {
  console.warn('[send-magic-link] RESEND_PROD_KEY not set; falling back to RESEND_API_KEY');
}

const RESEND_API_KEY = RESEND_PROD_KEY ?? RESEND_LEGACY_KEY;
const SITE_URL = Deno.env.get('SITE_URL') || 'https://getringsnap.com';
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
    // Check required environment variables
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[send-magic-link] Missing Supabase configuration');
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Missing Supabase credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!RESEND_API_KEY) {
      console.error(
        '[send-magic-link] Missing RESEND_PROD_KEY and RESEND_API_KEY environment variables'
      );
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Check if user exists via auth admin API
    const { data: usersData, error: getUserError } = await supabase.auth.admin.listUsers();

    if (getUserError) {
      console.error('[send-magic-link] Failed to list users:', getUserError);
      return new Response(
        JSON.stringify({ error: 'Failed to lookup user' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const existingUser = usersData?.users?.find(
      (u) => u.email?.toLowerCase() === normalizedEmail
    );
    const userId = existingUser?.id ?? null;

    let userName: string | undefined;
    let emailVerified: boolean | undefined;

    if (userId) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, email_verified')
        .eq('id', userId)
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('[send-magic-link] Failed to load user profile:', profileError);
        return new Response(
          JSON.stringify({ error: 'Failed to load user profile' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userName = profile?.name ?? undefined;
      emailVerified = profile?.email_verified ?? undefined;
    }

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
        { name: 'user_exists', value: userId ? 'true' : 'false' },
        ...(typeof emailVerified === 'boolean'
          ? [{ name: 'email_verified', value: emailVerified ? 'true' : 'false' }]
          : [])
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
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
