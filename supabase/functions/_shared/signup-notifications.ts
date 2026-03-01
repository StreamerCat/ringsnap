/**
 * Signup Notifications
 * 
 * Sends notifications to admin when new users sign up.
 * Supports both email (via Resend) and Slack webhook notifications.
 * 
 * SETUP:
 * 1. Set ADMIN_NOTIFICATION_EMAIL in Supabase secrets (e.g., "founder@company.com")
 * 2. Set SLACK_SIGNUP_WEBHOOK_URL in Supabase secrets (from Slack Incoming Webhooks)
 * 
 * Both channels are optional - notifications will be sent to whichever are configured.
 */

import { sendEmail, buildEmailHtml, buildEmailText } from "./resend-client.ts";

// ==============================================================================
// Types
// ==============================================================================

export interface SignupNotificationData {
    email: string;
    name: string;
    companyName: string;
    phone?: string;
    trade?: string;
    planType: string;
    source?: string;
    accountId: string;
    userId?: string;
}

export interface NotificationResult {
    emailSent: boolean;
    slackSent: boolean;
    errors: string[];
}

// ==============================================================================
// Slack Notification
// ==============================================================================

/**
 * Send Slack notification for new signup
 */
async function sendSlackNotification(
    webhookUrl: string,
    data: SignupNotificationData
): Promise<{ success: boolean; error?: string }> {
    try {
        const timestamp = new Date().toLocaleString("en-US", {
            timeZone: "America/Denver",
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });

        const payload = {
            blocks: [
                {
                    type: "header",
                    text: {
                        type: "plain_text",
                        text: "🎉 New Signup!",
                        emoji: true,
                    },
                },
                {
                    type: "section",
                    fields: [
                        {
                            type: "mrkdwn",
                            text: `*Name:*\n${data.name}`,
                        },
                        {
                            type: "mrkdwn",
                            text: `*Company:*\n${data.companyName}`,
                        },
                    ],
                },
                {
                    type: "section",
                    fields: [
                        {
                            type: "mrkdwn",
                            text: `*Email:*\n<mailto:${data.email}|${data.email}>`,
                        },
                        {
                            type: "mrkdwn",
                            text: `*Phone:*\n${data.phone || "N/A"}`,
                        },
                    ],
                },
                {
                    type: "section",
                    fields: [
                        {
                            type: "mrkdwn",
                            text: `*Plan:*\n${data.planType.charAt(0).toUpperCase() + data.planType.slice(1)}`,
                        },
                        {
                            type: "mrkdwn",
                            text: `*Trade:*\n${data.trade || "N/A"}`,
                        },
                    ],
                },
                {
                    type: "context",
                    elements: [
                        {
                            type: "mrkdwn",
                            text: `📍 Source: ${data.source || "website"} | 🕐 ${timestamp}`,
                        },
                    ],
                },
                {
                    type: "divider",
                },
                {
                    type: "actions",
                    elements: [
                        {
                            type: "button",
                            text: {
                                type: "plain_text",
                                text: "View in Supabase",
                                emoji: true,
                            },
                            url: `https://supabase.com/dashboard/project/yizsrzzfxybphgxjmqbu/editor/accounts?filter=id:eq:${data.accountId}`,
                            style: "primary",
                        },
                    ],
                },
            ],
        };

        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, error: `Slack webhook failed: ${response.status} - ${errorText}` };
        }

        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown Slack error",
        };
    }
}

// ==============================================================================
// Email Notification
// ==============================================================================

/**
 * Build admin notification email content
 */
function buildAdminEmailContent(data: SignupNotificationData): { html: string; text: string } {
    const timestamp = new Date().toLocaleString("en-US", {
        timeZone: "America/Denver",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });

    const htmlContent = `
    <p style="font-size: 16px; margin-bottom: 24px;">
      A new user just signed up for RingSnap! 🎉
    </p>
    
    <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; font-weight: 600; color: #64748b; width: 120px;">Name</td>
          <td style="padding: 8px 0; color: #1e293b;">${data.name}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600; color: #64748b;">Company</td>
          <td style="padding: 8px 0; color: #1e293b;">${data.companyName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600; color: #64748b;">Email</td>
          <td style="padding: 8px 0; color: #1e293b;">
            <a href="mailto:${data.email}" style="color: #D67256;">${data.email}</a>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600; color: #64748b;">Phone</td>
          <td style="padding: 8px 0; color: #1e293b;">${data.phone || "N/A"}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600; color: #64748b;">Trade</td>
          <td style="padding: 8px 0; color: #1e293b;">${data.trade || "N/A"}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600; color: #64748b;">Plan</td>
          <td style="padding: 8px 0; color: #1e293b;">
            <span style="background: #D67256; color: white; padding: 2px 8px; border-radius: 4px; font-size: 13px;">
              ${data.planType.charAt(0).toUpperCase() + data.planType.slice(1)}
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600; color: #64748b;">Source</td>
          <td style="padding: 8px 0; color: #1e293b;">${data.source || "website"}</td>
        </tr>
      </table>
    </div>
    
    <p style="font-size: 14px; color: #64748b; margin-top: 24px;">
      Signed up at ${timestamp} (Mountain Time)
    </p>
    
    <div style="text-align: center; margin-top: 24px;">
      <a href="https://supabase.com/dashboard/project/yizsrzzfxybphgxjmqbu/editor/accounts?filter=id:eq:${data.accountId}" 
         class="button"
         style="display: inline-block; padding: 14px 32px; background: #D67256; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600;">
        View Account in Supabase
      </a>
    </div>
  `;

    const textContent = `
New RingSnap Signup! 🎉

Name: ${data.name}
Company: ${data.companyName}
Email: ${data.email}
Phone: ${data.phone || "N/A"}
Trade: ${data.trade || "N/A"}
Plan: ${data.planType}
Source: ${data.source || "website"}

Signed up at ${timestamp} (Mountain Time)

View in Supabase: https://supabase.com/dashboard/project/yizsrzzfxybphgxjmqbu/editor/accounts?filter=id:eq:${data.accountId}
  `;

    return { html: htmlContent, text: textContent };
}

/**
 * Send admin email notification for new signup
 */
async function sendEmailNotification(
    adminEmail: string,
    resendApiKey: string,
    data: SignupNotificationData
): Promise<{ success: boolean; error?: string }> {
    try {
        const { html, text } = buildAdminEmailContent(data);
        const fullHtml = buildEmailHtml(`New Signup: ${data.companyName}`, html);

        const result = await sendEmail(resendApiKey, {
            to: adminEmail,
            subject: `🎉 New Signup: ${data.name} from ${data.companyName}`,
            html: fullHtml,
            text: buildEmailText(text),
            tags: [{ name: "type", value: "admin_notification" }],
        });

        return result;
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown email error",
        };
    }
}

// ==============================================================================
// Main Export
// ==============================================================================

/**
 * Send signup notifications via all configured channels
 * 
 * This is fire-and-forget - errors are logged but don't fail the signup flow.
 * 
 * @param data - Signup data to include in notifications
 * @returns Result object with status for each channel
 */
export async function sendSignupNotifications(
    data: SignupNotificationData
): Promise<NotificationResult> {
    const result: NotificationResult = {
        emailSent: false,
        slackSent: false,
        errors: [],
    };

    // Get configuration from environment
    const adminEmail = Deno.env.get("ADMIN_NOTIFICATION_EMAIL");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const slackWebhookUrl = Deno.env.get("SLACK_SIGNUP_WEBHOOK_URL");

    // Send email notification if configured
    if (adminEmail && resendApiKey) {
        console.log(`[signup-notifications] Sending email notification to ${adminEmail}`);
        const emailResult = await sendEmailNotification(adminEmail, resendApiKey, data);
        result.emailSent = emailResult.success;
        if (!emailResult.success && emailResult.error) {
            console.error(`[signup-notifications] Email failed: ${emailResult.error}`);
            result.errors.push(`Email: ${emailResult.error}`);
        } else {
            console.log(`[signup-notifications] Email sent successfully`);
        }
    } else {
        console.log("[signup-notifications] Email notification skipped - ADMIN_NOTIFICATION_EMAIL or RESEND_API_KEY not configured");
    }

    // Send Slack notification if configured
    if (slackWebhookUrl) {
        console.log("[signup-notifications] Sending Slack notification");
        const slackResult = await sendSlackNotification(slackWebhookUrl, data);
        result.slackSent = slackResult.success;
        if (!slackResult.success && slackResult.error) {
            console.error(`[signup-notifications] Slack failed: ${slackResult.error}`);
            result.errors.push(`Slack: ${slackResult.error}`);
        } else {
            console.log("[signup-notifications] Slack notification sent successfully");
        }
    } else {
        console.log("[signup-notifications] Slack notification skipped - SLACK_SIGNUP_WEBHOOK_URL not configured");
    }

    return result;
}
