/**
 * @deprecated This file is deprecated. Use auth-email-templates.ts instead.
 * This file is kept only for backwards compatibility and will be removed in a future version.
 *
 * Migration status:
 * - buildPasswordResetEmail() → Use buildPasswordSetResetEmail() from auth-email-templates.ts ✅ MIGRATED
 * - buildTeamInviteEmail() → Use buildStaffInviteEmail() from auth-email-templates.ts (pending)
 *
 * As of the latest update, send-password-reset has been migrated to use auth-email-templates.ts.
 */

type EmailTemplate = {
  subject: string;
  html: string;
  text: string;
};

interface PasswordResetParams {
  recipientName?: string;
  resetLink: string;
}

interface InviteParams {
  recipientName: string;
  invitedBy: string;
  companyName: string;
  loginLink: string;
  tempPassword?: string;
}

const RINGSNAP_LOGO = "https://getringsnap.com/assets/RS_logo_color.svg";
const SUPPORT_EMAIL = "support@getringsnap.com";
const BASE_STYLES = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111827; line-height: 1.6; margin: 0; padding: 0; background: #f9fafb; }
  .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
  .card { background: #ffffff; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.08); padding: 40px; }
  .logo { text-align: center; margin-bottom: 24px; }
  h1 { font-size: 24px; color: #111827; margin: 0 0 16px 0; }
  p { color: #374151; margin: 12px 0; }
  .button { display: inline-block; padding: 14px 32px; background: #d67256; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 24px 0; }
  .button:hover { background: #c25b42; }
  .code { background: #f3f4f6; padding: 12px 16px; border-radius: 6px; font-family: monospace; font-size: 14px; letter-spacing: 0.05em; display: inline-block; margin: 8px 0; }
  .footer { border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 32px; font-size: 13px; color: #6b7280; text-align: center; }
  .help { background: #f0fdf4; border-left: 4px solid #22c55e; padding: 12px 16px; margin: 20px 0; border-radius: 4px; }
`;

export function buildPasswordResetEmail({ recipientName, resetLink }: PasswordResetParams): EmailTemplate {
  const name = recipientName || "there";

  return {
    subject: "Reset your RingSnap password",
    html: `
<!DOCTYPE html>
<html>
<head><style>${BASE_STYLES}</style></head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">
        <img src="${RINGSNAP_LOGO}" alt="RingSnap" height="40">
      </div>
      <h1>Reset your password</h1>
      <p>Hi ${name},</p>
      <p>We received a request to reset your RingSnap password. Click the button below to create a new password:</p>
      <p style="text-align: center;">
        <a href="${resetLink}" class="button">Reset Password</a>
      </p>
      <p>This link expires in 1 hour for security.</p>
      <div class="help">
        <strong>Didn't request this?</strong><br>
        If you didn't ask to reset your password, you can safely ignore this email. Your account remains secure.
      </div>
      <div class="footer">
        <p>Need help? Contact us at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
        <p>RingSnap - Never miss a call</p>
      </div>
    </div>
  </div>
</body>
</html>`,
    text: `Hi ${name},

We received a request to reset your RingSnap password.

Reset your password here: ${resetLink}

This link expires in 1 hour.

If you didn't request this, you can safely ignore this email.

Need help? Contact ${SUPPORT_EMAIL}

— The RingSnap Team`
  };
}

export function buildTeamInviteEmail({ recipientName, invitedBy, companyName, loginLink, tempPassword }: InviteParams): EmailTemplate {
  return {
    subject: `You've been invited to ${companyName} on RingSnap`,
    html: `
<!DOCTYPE html>
<html>
<head><style>${BASE_STYLES}</style></head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">
        <img src="${RINGSNAP_LOGO}" alt="RingSnap" height="40">
      </div>
      <h1>You're invited to ${companyName}</h1>
      <p>Hi ${recipientName},</p>
      <p>${invitedBy} has invited you to join <strong>${companyName}</strong>'s RingSnap account.</p>
      <p>RingSnap is an AI-powered answering service that ensures you never miss a customer call.</p>
      ${tempPassword ? `
      <p><strong>Your temporary password:</strong></p>
      <p class="code">${tempPassword}</p>
      ` : `
      <p>Please log in with your existing account to accept the invitation.</p>
      `}
      <p style="text-align: center;">
        <a href="${loginLink}" class="button">Sign In to RingSnap</a>
      </p>
      <div class="help">
        <strong>${tempPassword ? 'First time logging in?' : 'Already have an account?'}</strong><br>
        ${tempPassword
        ? "Use the temporary password above, then you'll be prompted to create your own secure password."
        : "Simply sign in to access the new team."}
      </div>
      <div class="footer">
        <p>Questions? Contact us at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
        <p>RingSnap - Never miss a call</p>
      </div>
    </div>
  </div>
</body>
</html>`,
    text: `Hi ${recipientName},

${invitedBy} has invited you to join ${companyName}'s RingSnap account.

${tempPassword ? `Your temporary password: ${tempPassword}` : 'Please log in with your existing account.'}

Sign in here: ${loginLink}

${tempPassword ? "You'll be prompted to create your own password after first login." : ''}

Questions? Contact ${SUPPORT_EMAIL}

— The RingSnap Team`
  };
}
