import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from '../_shared/cors.ts';
import {
  createInviteToken,
  logAuthEvent,
  getIpAddress,
  getUserAgent,
  isValidEmail,
  createAdminClient,
  buildAuthUrl
} from '../_shared/auth-utils.ts';
import { sendEmail } from '../_shared/resend-client.ts';
import { buildStaffInviteEmail } from '../_shared/auth-email-templates.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_PROD_KEY')!;
const SITE_URL = Deno.env.get('SITE_URL') || 'http://localhost:5173';
const INVITE_TTL_HOURS = parseInt(Deno.env.get('AUTH_INVITE_TTL_HOURS') || '48');

const VALID_STAFF_ROLES = ['admin', 'support', 'sales', 'billing', 'readonly'];

interface RequestBody {
  email: string;
  role: string;
  recipientName: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createAdminClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get the authenticated user (must be admin)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: staffRole } = await supabase
      .from('staff_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!staffRole || staffRole.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Only admins can create staff invites' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, role, recipientName }: RequestBody = await req.json();

    // Validate inputs
    if (!email || !isValidEmail(email)) {
      return new Response(
        JSON.stringify({ error: 'Valid email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!role || !VALID_STAFF_ROLES.includes(role)) {
      return new Response(
        JSON.stringify({ error: `Invalid role. Must be one of: ${VALID_STAFF_ROLES.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!recipientName || recipientName.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Recipient name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const ipAddress = getIpAddress(req);
    const userAgent = getUserAgent(req);

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .single();

    if (existingUser) {
      // Check if already has staff role
      const { data: existingStaffRole } = await supabase
        .from('staff_roles')
        .select('role')
        .eq('user_id', existingUser.id)
        .single();

      if (existingStaffRole) {
        return new Response(
          JSON.stringify({ error: 'User already has a staff role' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get inviter's profile
    const { data: inviterProfile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single();

    const invitedByName = inviterProfile?.name || 'A RingSnap administrator';

    // Create invite token (no account_id for staff)
    const { token: inviteToken, expiresAt } = await createInviteToken(
      supabase,
      normalizedEmail,
      '', // Staff don't belong to a specific account
      role,
      user.id,
      INVITE_TTL_HOURS
    );

    // Build invite URL
    const inviteLink = buildAuthUrl(
      SITE_URL,
      '/auth/staff-invite',
      { token: inviteToken }
    );

    // Send email via Resend
    const emailTemplate = buildStaffInviteEmail(
      inviteLink,
      recipientName.trim(),
      invitedByName,
      role,
      INVITE_TTL_HOURS
    );

    const emailResult = await sendEmail(RESEND_API_KEY, {
      to: normalizedEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
      tags: [
        { name: 'type', value: 'staff_invite' },
        { name: 'role', value: role }
      ]
    });

    if (!emailResult.success) {
      await logAuthEvent(
        supabase,
        user.id,
        null,
        'staff_invite_send_failed',
        { email: normalizedEmail, role, error: emailResult.error },
        ipAddress,
        userAgent,
        false
      );

      return new Response(
        JSON.stringify({ error: 'Failed to send invite email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log successful invite
    await logAuthEvent(
      supabase,
      user.id,
      null,
      'staff_invite_created',
      { email: normalizedEmail, role, email_id: emailResult.emailId },
      ipAddress,
      userAgent,
      true
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Staff invitation sent successfully',
        expiresAt: expiresAt.toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-staff-invite:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
