import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';
import { buildTeamInviteEmail } from '../_shared/email-templates.ts';
import { sendEmail } from '../_shared/resend-client.ts';
import { getResendApiKey } from '../_shared/env.ts';

console.log("Manage Team Member function loaded");

Deno.serve(async (req) => {
  console.log(`Received request: ${req.method} ${req.url}`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get current user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's account and verify owner role
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('id', user.id)
      .single();

    if (!profile?.account_id) {
      return new Response(
        JSON.stringify({ error: 'User not associated with an account' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: ownerCheck } = await supabase
      .from('account_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('account_id', profile.account_id)
      .eq('role', 'owner')
      .single();

    if (!ownerCheck) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Account owner access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, email, name, phone, new_role, target_user_id } = await req.json();

    if (action === 'invite') {
      let targetUserId: string;
      let isNewUser = false;
      let tempPassword = "";

      // 1. Try to find existing auth user first
      // We use listUsers because getByEmail isn't readily available in all SDK versions or requires different permissions
      // Note: listUsers is expensive on large userbases but manageable for invites
      const { data: { users: foundUsers }, error: findError } = await supabase.auth.admin.listUsers();

      const existingUser = foundUsers?.find(u => u.email?.toLowerCase() === email.toLowerCase());

      if (existingUser) {
        targetUserId = existingUser.id;
        console.log(`User ${email} already exists (id: ${targetUserId}). Adding to team.`);
      } else {
        // 2. Create new user if doesn't exist
        isNewUser = true;
        tempPassword = Math.random().toString(36).slice(-12) + 'A1!';

        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { name, phone }
        });

        if (createError) {
          // Handle race condition if user was created between our check and now
          if (createError.message?.toLowerCase().includes("already registered")) {
            console.log(`Race condition: User ${email} created concurrently. treating as existing.`);
            // Re-fetch to get ID (or fail if we can't) - simplistic retry
            const { data: { users: retryUsers } } = await supabase.auth.admin.listUsers();
            const retryUser = retryUsers?.find(u => u.email?.toLowerCase() === email.toLowerCase());
            if (!retryUser) throw createError;
            targetUserId = retryUser.id;
            isNewUser = false;
          } else {
            throw createError;
          }
        } else {
          targetUserId = newUser.user.id;

          // Create profile immediately for new user
          await supabase
            .from('profiles')
            .insert({
              id: targetUserId,
              account_id: profile.account_id, // Default to inviter's account for now, logical for expanded teams
              name,
              phone,
              is_primary: false
            });
        }
      }

      // 3. Check if already in THIS team
      const { data: existingMember } = await supabase
        .from('account_members')
        .select('id')
        .eq('user_id', targetUserId)
        .eq('account_id', profile.account_id)
        .single();

      if (existingMember) {
        console.log(`User ${targetUserId} is already a member of account ${profile.account_id}`);
        return new Response(
          JSON.stringify({ error: 'User is already a member of this team.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 4. Add to account_members
      await supabase
        .from('account_members')
        .insert({
          user_id: targetUserId,
          account_id: profile.account_id,
          role: new_role || 'member'
        });

      // Log the change
      await supabase
        .from('role_audit_log')
        .insert({
          user_id: targetUserId,
          changed_by: user.id,
          role_type: 'account',
          old_role: null,
          new_role: new_role || 'member',
          account_id: profile.account_id
        });

      // Get inviter's name
      const { data: inviterProfile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single();

      // Get company name
      const { data: account } = await supabase
        .from('accounts')
        .select('company_name')
        .eq('id', profile.account_id)
        .single();

      // Send custom invite email
      try {
        const inviteEmail = buildTeamInviteEmail({
          recipientName: name,
          invitedBy: inviterProfile?.name || 'Your team',
          companyName: account?.company_name || 'your team',
          loginLink: `${Deno.env.get("VITE_SUPABASE_URL") || "https://getringsnap.com"}/login`,
          tempPassword: isNewUser ? tempPassword : undefined // Only send temp password to new users
        });

        // Check for API key presence
        const resendKey = Deno.env.get("RESEND_PROD_KEY") || Deno.env.get("RESEND_API_KEY");

        if (!resendKey) {
          console.error("CRITICAL: RESEND_PROD_KEY and RESEND_API_KEY are missing. Cannot send invite email.");
        } else {
          const emailResult = await sendEmail(resendKey, {
            from: "RingSnap <support@getringsnap.com>",
            to: email,
            subject: inviteEmail.subject,
            html: inviteEmail.html,
            text: inviteEmail.text
          });

          if (!emailResult.success) {
            console.error("Failed to send invite email (API Error):", emailResult.error);
          } else {
            console.log(`Team invite email sent successfully to ${email} (ID: ${emailResult.emailId})`);
          }
        }
      } catch (emailError) {
        console.error('Unexpected error sending invite email:', emailError);
      }

      return new Response(
        JSON.stringify({ success: true, user_id: targetUserId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (action === 'update_role') {
      // Verify target user is in same account
      const { data: targetProfile } = await supabase
        .from('profiles')
        .select('account_id')
        .eq('id', target_user_id)
        .single();

      if (targetProfile?.account_id !== profile.account_id) {
        return new Response(
          JSON.stringify({ error: 'Target user not in same account' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get old role
      const { data: oldRoleData } = await supabase
        .from('account_members')
        .select('role')
        .eq('user_id', target_user_id)
        .eq('account_id', profile.account_id)
        .single();

      // Update role
      const { error: updateError } = await supabase
        .from('account_members')
        .update({ role: new_role })
        .eq('user_id', target_user_id)
        .eq('account_id', profile.account_id);

      if (updateError) throw updateError;

      // Log the change
      await supabase
        .from('role_audit_log')
        .insert({
          user_id: target_user_id,
          changed_by: user.id,
          role_type: 'account',
          old_role: oldRoleData?.role || null,
          new_role,
          account_id: profile.account_id
        });

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error managing team member:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
