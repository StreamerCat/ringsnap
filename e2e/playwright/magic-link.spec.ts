import { test, expect } from '@playwright/test';

// This test assumes dev environment exposes an email capture endpoint (MailHog, Ethereal, or Resend V2 API)
// Set EMAIL_TEST_INBOX_URL in your test env to a URL that returns the latest email for the test recipient.
// For example, MailHog: http://localhost:8025/api/v2/messages

const SITE_URL = process.env.E2E_SITE_URL || 'http://localhost:3000';
const EMAIL_INBOX_URL = process.env.EMAIL_TEST_INBOX_URL; // REQUIRED for full end-to-end

if (!EMAIL_INBOX_URL) {
  console.warn('EMAIL_TEST_INBOX_URL not set — email delivery assertions will be skipped');
}

test('magic link flow creates account and logs in (happy path)', async ({ page }) => {
  const testEmail = `e2e+${Date.now()}@example.com`;

  await page.goto(`${SITE_URL}/auth/login`);
  await page.fill('input[type="email"]', testEmail);
  await page.click('button:has-text("Continue with email")');

  // Expect check your email UI
  await expect(page.locator('text=Check your email')).toBeVisible();

  if (EMAIL_INBOX_URL) {
    // Poll the inbox for the latest message to the testEmail
    let rawEmail: any = null;
    for (let i = 0; i < 20; i++) {
      const res = await page.request.get(`${EMAIL_INBOX_URL}?recipient=${encodeURIComponent(testEmail)}`);
      if (res.ok()) {
        const json = await res.json();
        // Adapt to your inbox shape: look for a message with links
        if (json && json.items && json.items.length) {
          rawEmail = json.items[0];
          break;
        }
      }
      await page.waitForTimeout(1500);
    }

    expect(rawEmail).not.toBeNull();
    // Extract magic link from the message (adapt selector to your mail shape)
    const body = rawEmail.Content?.Body || rawEmail.body || JSON.stringify(rawEmail);
    const match = body.match(/https?:\/\/[^\n"\\s]+/);
    expect(match).not.toBeNull();
    const magicLink = match[0].replace(/\\/g, '');

    // Navigate to the magic link
    await page.goto(magicLink);

    // Expect redirect to magic-callback then to dashboard
    await expect(page.locator('text=Verifying magic link')).toBeVisible();
    // Wait for final redirect
    await page.waitForURL('**/dashboard', { timeout: 20000 });
    await expect(page.locator('text=Welcome')).toBeVisible();
  }
});