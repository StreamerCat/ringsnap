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
  buildAuthUrl,
  isUserNotFoundError
} from '../_shared/auth-utils.ts';
import { sendEmail } from '../_shared/resend-client.ts';
import { buildMagicLinkEmail } from '../_shared/auth-email-templates.ts';
import { getResendApiKey, getSupabaseServiceRoleKey, getSupabaseUrl } from '../_shared/env.ts';

const { value: SUPABASE_URL, source: supabaseUrlSource } = getSupabaseUrl();
const { value: SUPABASE_SERVICE_ROLE_KEY, source: serviceRoleSource } = getSupabaseServiceRoleKey();
const { value: RESEND_API_KEY, source: resendKeySource } = getResendApiKey();

if (resendKeySource && resendKeySource !== 'RESEND_PROD_KEY') {
  console.warn(
    `[send-magic-link] Using fallback Resend key from ${resendKeySource}; configure RESEND_PROD_KEY when possible`
  );
}

if (serviceRoleSource && serviceRoleSource !== 'SUPABASE_SERVICE_ROLE_KEY') {
  console.warn(
    `[send-magic-link] Using service role key from ${serviceRoleSource}; set SUPABASE_SERVICE_ROLE_KEY to avoid surprises`
  );
}

if (supabaseUrlSource && supabaseUrlSource !== 'SUPABASE_URL') {
  console.warn(
    `[send-magic-link] Using Supabase URL from ${supabaseUrlSource}; prefer SUPABASE_URL for clarity`
  );
}
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
    const { data: userLookup, error: getUserError } = await supabase.auth.admin.getUserByEmail(
      normalizedEmail
    );

    if (getUserError && !isUserNotFoundError(getUserError)) {
      console.error('[send-magic-link] Failed to lookup user:', getUserError);
      return new Response(
        JSON.stringify({ error: 'Failed to lookup user' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = userLookup?.user?.id ?? null;

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
