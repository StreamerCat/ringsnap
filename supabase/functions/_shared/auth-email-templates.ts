import { buildEmailHtml, buildEmailText } from './resend-client.ts';

const BRAND_COLOR = '#D67256';
const SUPPORT_EMAIL = 'support@getringsnap.com';

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

/**
 * Magic Link Sign-In Email
 */
export function buildMagicLinkEmail(
  magicLink: string,
  recipientName?: string,
  expiresInMinutes: number = 20
): EmailTemplate {
  const name = recipientName || 'there';

  const content = `
    <p>Hi ${name},</p>
    <p>Click the button below to sign in to your RingSnap account. No password needed!</p>
    <p style="text-align: center;">
      <a href="${magicLink}" class="button">Sign In to RingSnap</a>
    </p>
    <p style="font-size: 14px; color: #6b7280;">
      Or copy and paste this link into your browser:<br>
      <code style="font-size: 12px; word-break: break-all;">${magicLink}</code>
    </p>
    <p style="color: #ef4444; font-size: 14px;">
      This link expires in ${expiresInMinutes} minutes for security.
    </p>
    <div class="help">
      <strong>Didn't request this?</strong><br>
      If you didn't try to sign in, you can safely ignore this email. Your account remains secure.
    </div>
  `;

  const text = `Hi ${name},

Click the link below to sign in to your RingSnap account:

${magicLink}

This link expires in ${expiresInMinutes} minutes.

If you didn't request this, you can safely ignore this email.

Need help? Contact ${SUPPORT_EMAIL}

— The RingSnap Team`;

  return {
    subject: 'Sign in to RingSnap',
    html: buildEmailHtml('Sign in to RingSnap', content),
    text: buildEmailText(text)
  };
}

/**
 * Finish Setup Email (after onboarding)
 */
export function buildFinishSetupEmail(
  setupLink: string,
  recipientName: string
): EmailTemplate {
  const content = `
    <p>Hi ${recipientName},</p>
    <p>Welcome to RingSnap! 🎉 You're all set up and ready to start taking calls.</p>
    <p>To secure your account, we recommend setting up a password or passkey for faster sign-in next time.</p>
    <p style="text-align: center;">
      <a href="${setupLink}" class="button">Complete Account Security</a>
    </p>
    <div class="help">
      <strong>Why set up security?</strong><br>
      Adding a password or passkey gives you more ways to sign in and helps keep your account secure.
    </div>
  `;

  const text = `Hi ${recipientName},

Welcome to RingSnap! 🎉

To secure your account, we recommend setting up a password or passkey:

${setupLink}

This is optional but recommended for faster sign-in.

Need help? Contact ${SUPPORT_EMAIL}

— The RingSnap Team`;

  return {
    subject: 'Complete your RingSnap account setup',
    html: buildEmailHtml('Complete Your Setup', content),
    text: buildEmailText(text)
  };
}

/**
 * Password Set/Reset Email (one-click)
 */
export function buildPasswordSetResetEmail(
  resetLink: string,
  recipientName: string,
  isFirstTime: boolean = false,
  expiresInMinutes: number = 60
): EmailTemplate {
  const title = isFirstTime ? 'Set your password' : 'Reset your password';
  const action = isFirstTime ? 'set' : 'reset';

  const content = `
    <p>Hi ${recipientName},</p>
    <p>Click the button below to ${action} your RingSnap password:</p>
    <p style="text-align: center;">
      <a href="${resetLink}" class="button">${isFirstTime ? 'Set' : 'Reset'} Password</a>
    </p>
    <p style="font-size: 14px; color: #6b7280;">
      Or copy and paste this link into your browser:<br>
      <code style="font-size: 12px; word-break: break-all;">${resetLink}</code>
    </p>
    <p style="color: #ef4444; font-size: 14px;">
      This link expires in ${expiresInMinutes} minutes for security.
    </p>
    ${!isFirstTime ? `
    <div class="help">
      <strong>Didn't request this?</strong><br>
      If you didn't ask to reset your password, you can safely ignore this email. Your account remains secure.
    </div>
    ` : ''}
  `;

  const text = `Hi ${recipientName},

Click the link below to ${action} your RingSnap password:

${resetLink}

This link expires in ${expiresInMinutes} minutes.

${!isFirstTime ? `If you didn't request this, you can safely ignore this email.\n\n` : ''}Need help? Contact ${SUPPORT_EMAIL}

— The RingSnap Team`;

  return {
    subject: isFirstTime ? 'Set your RingSnap password' : 'Reset your RingSnap password',
    html: buildEmailHtml(title, content),
    text: buildEmailText(text)
  };
}

/**
 * Staff Invite Email
 */
export function buildStaffInviteEmail(
  inviteLink: string,
  recipientName: string,
  invitedBy: string,
  role: string,
  expiresInHours: number = 48
): EmailTemplate {
  const roleDisplay = role.charAt(0).toUpperCase() + role.slice(1);

  const content = `
    <p>Hi ${recipientName},</p>
    <p>${invitedBy} has invited you to join RingSnap as a <strong>${roleDisplay}</strong>.</p>
    <p>Click the button below to accept your invitation and set up your account:</p>
    <p style="text-align: center;">
      <a href="${inviteLink}" class="button">Accept Invitation</a>
    </p>
    <p style="font-size: 14px; color: #6b7280;">
      Or copy and paste this link into your browser:<br>
      <code style="font-size: 12px; word-break: break-all;">${inviteLink}</code>
    </p>
    <div class="warning">
      <strong>Important:</strong> This invitation expires in ${expiresInHours} hours. Please accept it soon to get started.
    </div>
    <div class="help">
      <strong>About your role:</strong><br>
      As a ${roleDisplay}, you'll have access to RingSnap's internal tools and customer accounts.
      ${role === 'admin' || role === 'support' ? 'You\'ll be required to set up two-factor authentication for security.' : ''}
    </div>
  `;

  const text = `Hi ${recipientName},

${invitedBy} has invited you to join RingSnap as a ${roleDisplay}.

Accept your invitation here:

${inviteLink}

This invitation expires in ${expiresInHours} hours.

${role === 'admin' || role === 'support' ? 'Note: You\'ll be required to set up two-factor authentication.\n\n' : ''}Need help? Contact ${SUPPORT_EMAIL}

— The RingSnap Team`;

  return {
    subject: `You're invited to join RingSnap as ${roleDisplay}`,
    html: buildEmailHtml('Staff Invitation', content),
    text: buildEmailText(text)
  };
}

/**
 * Invite Expired Email
 */
export function buildInviteExpiredEmail(
  recipientName: string,
  contactPerson: string
): EmailTemplate {
  const content = `
    <p>Hi ${recipientName},</p>
    <p>Your invitation to join RingSnap has expired.</p>
    <p>If you still need access, please reach out to ${contactPerson} for a new invitation.</p>
    <div class="help">
      <strong>Need help?</strong><br>
      Contact ${contactPerson} or our support team at ${SUPPORT_EMAIL}.
    </div>
  `;

  const text = `Hi ${recipientName},

Your invitation to join RingSnap has expired.

If you still need access, please reach out to ${contactPerson} for a new invitation.

Need help? Contact ${SUPPORT_EMAIL}

— The RingSnap Team`;

  return {
    subject: 'Your RingSnap invitation has expired',
    html: buildEmailHtml('Invitation Expired', content),
    text: buildEmailText(text)
  };
}

/**
 * Magic Link Resend Email
 */
export function buildMagicLinkResendEmail(
  magicLink: string,
  recipientName: string,
  expiresInMinutes: number = 20
): EmailTemplate {
  const content = `
    <p>Hi ${recipientName},</p>
    <p>You requested a new sign-in link. Click the button below to sign in:</p>
    <p style="text-align: center;">
      <a href="${magicLink}" class="button">Sign In to RingSnap</a>
    </p>
    <p style="color: #ef4444; font-size: 14px;">
      This link expires in ${expiresInMinutes} minutes. Previous sign-in links are now invalid.
    </p>
    <div class="help">
      <strong>Too many emails?</strong><br>
      Consider setting up a password or passkey in your security settings for faster sign-in.
    </div>
  `;

  const text = `Hi ${recipientName},

Here's your new sign-in link:

${magicLink}

This link expires in ${expiresInMinutes} minutes.

Need help? Contact ${SUPPORT_EMAIL}

— The RingSnap Team`;

  return {
    subject: 'Your new RingSnap sign-in link',
    html: buildEmailHtml('New Sign-In Link', content),
    text: buildEmailText(text)
  };
}

/**
 * 2FA Setup Email
 */
export function build2FASetupEmail(
  recipientName: string,
  backupCodes: string[]
): EmailTemplate {
  const codesHtml = backupCodes.map(code => `<code class="code">${code}</code>`).join('<br>');
  const codesText = backupCodes.join('\n');

  const content = `
    <p>Hi ${recipientName},</p>
    <p>Two-factor authentication has been enabled on your RingSnap account. Great job securing your account! 🔒</p>
    <div class="warning">
      <strong>Save these backup codes:</strong><br>
      Each code can be used once if you lose access to your authenticator app.<br><br>
      ${codesHtml}
    </div>
    <p style="font-size: 14px; color: #6b7280;">
      Store these codes in a safe place. You won't be able to see them again.
    </p>
  `;

  const text = `Hi ${recipientName},

Two-factor authentication has been enabled on your RingSnap account.

SAVE THESE BACKUP CODES:
Each code can be used once if you lose access to your authenticator app.

${codesText}

Store these codes in a safe place. You won't be able to see them again.

Need help? Contact ${SUPPORT_EMAIL}

— The RingSnap Team`;

  return {
    subject: 'Two-factor authentication enabled',
    html: buildEmailHtml('2FA Enabled', content),
    text: buildEmailText(text)
  };
}

/**
 * Session Revoked Email
 */
export function buildSessionRevokedEmail(
  recipientName: string,
  deviceInfo: string
): EmailTemplate {
  const content = `
    <p>Hi ${recipientName},</p>
    <p>A session was revoked on your RingSnap account:</p>
    <div class="code">${deviceInfo}</div>
    <p>If this was you, no action is needed. If you didn't revoke this session, please secure your account immediately.</p>
    <div class="warning">
      <strong>Secure your account:</strong><br>
      Change your password and review your active sessions in your security settings.
    </div>
  `;

  const text = `Hi ${recipientName},

A session was revoked on your RingSnap account:

${deviceInfo}

If this wasn't you, please secure your account immediately by changing your password.

Need help? Contact ${SUPPORT_EMAIL}

— The RingSnap Team`;

  return {
    subject: 'Session revoked on your RingSnap account',
    html: buildEmailHtml('Session Revoked', content),
    text: buildEmailText(text)
  };
}
