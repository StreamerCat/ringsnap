/**
 * Supabase Auth Hook: send_email
 *
 * Intercepts ALL native Supabase auth emails and routes them through Resend
 * using branded RingSnap templates. Configured in the Supabase Dashboard under
 * Authentication > Hooks > Send Email.
 *
 * Supported email_action_type values:
 *   signup       - Email confirmation for new accounts
 *   magic_link   - Passwordless sign-in link
 *   recovery     - Password reset link
 *   invite       - User invitation link
 *   email_change - Email address change confirmation
 *
 * Docs: https://supabase.com/docs/guides/auth/auth-hooks#send-email-hook
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  buildMagicLinkEmail,
  buildPasswordSetResetEmail,
  buildStaffInviteEmail,
} from '../_shared/auth-email-templates.ts';
import { sendEmail, buildEmailHtml, buildEmailText } from '../_shared/resend-client.ts';
import { getResendApiKey, getSupabaseUrl } from '../_shared/env.ts';

const { value: RESEND_API_KEY } = getResendApiKey();
const { value: SUPABASE_URL } = getSupabaseUrl();
const AUTH_HOOK_SECRET = Deno.env.get('AUTH_HOOK_SECRET');
const SITE_URL = Deno.env.get('SITE_URL') || 'https://app.getringsnap.com';
const FROM_ADDRESS = Deno.env.get('EMAIL_FROM') || 'RingSnap <support@getringsnap.com>';

// ---------------------------------------------------------------------------
// HMAC-SHA256 signature verification
// Supabase sends: Authorization: Bearer <base64url(hmac-sha256(body, secret))>
// ---------------------------------------------------------------------------

async function verifyHookSignature(req: Request, body: string): Promise<boolean> {
  if (!AUTH_HOOK_SECRET) {
    // If secret is not configured, skip verification (allow local dev without it)
    console.warn('[auth-send-email] AUTH_HOOK_SECRET not set — skipping signature check');
    return true;
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    console.error('[auth-send-email] Missing or invalid Authorization header');
    return false;
  }

  const token = authHeader.slice('Bearer '.length);

  const keyData = new TextEncoder().encode(AUTH_HOOK_SECRET);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  // Supabase sends the signature as base64url-encoded HMAC of the raw body
  const signatureBytes = Uint8Array.from(atob(token.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const bodyBytes = new TextEncoder().encode(body);

  return crypto.subtle.verify('HMAC', key, signatureBytes, bodyBytes);
}

// ---------------------------------------------------------------------------
// Build action link from token hash (Supabase verify endpoint)
// ---------------------------------------------------------------------------

function buildVerifyLink(tokenHash: string, type: string, redirectTo: string): string {
  const base = SUPABASE_URL?.replace(/\/$/, '');
  const params = new URLSearchParams({ token: tokenHash, type, redirect_to: redirectTo });
  return `${base}/auth/v1/verify?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Build confirm email change email inline (no dedicated template)
// ---------------------------------------------------------------------------

function buildEmailChangeEmail(confirmLink: string, recipientName: string): { subject: string; html: string; text: string } {
  const name = recipientName || 'there';
  const content = `
    <p>Hi ${name},</p>
    <p>We received a request to update the email address on your RingSnap account.</p>
    <p>Click the button below to confirm your new email address:</p>
    <p style="text-align: center;">
      <a href="${confirmLink}" class="button">Confirm New Email</a>
    </p>
    <p style="font-size: 14px; color: #6b7280;">
      Or copy and paste this link into your browser:<br>
      <code style="font-size: 12px; word-break: break-all;">${confirmLink}</code>
    </p>
    <div class="help">
      <strong>Didn't request this?</strong><br>
      If you didn't ask to change your email address, please contact support immediately at support@getringsnap.com.
    </div>
  `;
  const text = `Hi ${name},

We received a request to update the email address on your RingSnap account.

Confirm your new email address here:

${confirmLink}

If you didn't request this, please contact support@getringsnap.com immediately.

— The RingSnap Team`;

  return {
    subject: 'Confirm your new RingSnap email address',
    html: buildEmailHtml('Confirm New Email Address', content),
    text: buildEmailText(text),
  };
}

// ---------------------------------------------------------------------------
// Build signup confirmation email inline
// ---------------------------------------------------------------------------

function buildSignupConfirmEmail(confirmLink: string, recipientName: string): { subject: string; html: string; text: string } {
  const name = recipientName || 'there';
  const content = `
    <p>Hi ${name},</p>
    <p>Thanks for signing up for RingSnap! Please confirm your email address to get started.</p>
    <p style="text-align: center;">
      <a href="${confirmLink}" class="button">Confirm Email Address</a>
    </p>
    <p style="font-size: 14px; color: #6b7280;">
      Or copy and paste this link into your browser:<br>
      <code style="font-size: 12px; word-break: break-all;">${confirmLink}</code>
    </p>
    <div class="help">
      <strong>Didn't sign up?</strong><br>
      If you didn't create a RingSnap account, you can safely ignore this email.
    </div>
  `;
  const text = `Hi ${name},

Thanks for signing up for RingSnap! Confirm your email address here:

${confirmLink}

If you didn't sign up, you can safely ignore this email.

— The RingSnap Team`;

  return {
    subject: 'Confirm your RingSnap email address',
    html: buildEmailHtml('Confirm Your Email', content),
    text: buildEmailText(text),
  };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to read request body' }), { status: 400 });
  }

  // Verify signature
  const isValid = await verifyHookSignature(req, rawBody);
  if (!isValid) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { user, email_data } = payload;

  if (!user?.email || !email_data) {
    return new Response(JSON.stringify({ error: 'Missing user or email_data' }), { status: 400 });
  }

  if (!RESEND_API_KEY) {
    console.error('[auth-send-email] RESEND_PROD_KEY not configured');
    return new Response(JSON.stringify({ error: 'Email service not configured' }), { status: 500 });
  }

  const { email_action_type, token_hash, redirect_to, token, token_hash_new } = email_data;
  const recipientEmail = user.email;
  const recipientName = user.user_metadata?.name || user.user_metadata?.full_name || 'there';
  const redirectUrl = redirect_to || `${SITE_URL}/auth/callback`;

  console.log(`[auth-send-email] action=${email_action_type} email=${recipientEmail}`);

  let emailTemplate: { subject: string; html: string; text: string };

  switch (email_action_type) {
    case 'signup': {
      const confirmLink = buildVerifyLink(token_hash, 'signup', redirectUrl);
      emailTemplate = buildSignupConfirmEmail(confirmLink, recipientName);
      break;
    }

    case 'magic_link': {
      const magicLink = buildVerifyLink(token_hash, 'magiclink', redirectUrl);
      emailTemplate = buildMagicLinkEmail(magicLink, recipientName, 20);
      break;
    }

    case 'recovery': {
      const resetLink = buildVerifyLink(token_hash, 'recovery', redirectUrl);
      emailTemplate = buildPasswordSetResetEmail(resetLink, recipientName, false, 60);
      break;
    }

    case 'invite': {
      const inviteLink = buildVerifyLink(token_hash, 'invite', redirectUrl);
      // For native invites we don't have inviter/role info, use generic values
      emailTemplate = buildStaffInviteEmail(inviteLink, recipientName, 'RingSnap', 'member', 48);
      break;
    }

    case 'email_change': {
      // Supabase sends token_hash_new for the new address confirmation
      const confirmLink = buildVerifyLink(token_hash_new || token_hash, 'email_change', redirectUrl);
      emailTemplate = buildEmailChangeEmail(confirmLink, recipientName);
      break;
    }

    default: {
      console.warn(`[auth-send-email] Unknown email_action_type: ${email_action_type}`);
      // Return 200 to prevent Supabase from retrying indefinitely
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const result = await sendEmail(RESEND_API_KEY, {
    to: recipientEmail,
    subject: emailTemplate.subject,
    html: emailTemplate.html,
    text: emailTemplate.text,
    from: FROM_ADDRESS,
    tags: [
      { name: 'type', value: email_action_type },
      { name: 'source', value: 'auth_hook' },
    ],
  });

  if (!result.success) {
    console.error(`[auth-send-email] Failed to send ${email_action_type} email:`, result.error);
    // Return 500 so Supabase knows the email wasn't sent
    return new Response(JSON.stringify({ error: result.error }), { status: 500 });
  }

  console.log(`[auth-send-email] Sent ${email_action_type} to ${recipientEmail} (id=${result.emailId})`);

  // Supabase Auth Hook requires a 200 response with an empty JSON object
  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
