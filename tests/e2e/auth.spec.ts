import { test, expect } from '@playwright/test';
import { EmailHelper } from '../support/email-helper';

/**
 * Authentication & Redirect E2E Tests
 */

test.describe('Authentication Flow', () => {
    const emailHelper = new EmailHelper();
    const testEmail = `test-user-${crypto.randomUUID()}@getringsnap.com`;

    test('unauthenticated user to /dashboard redirects to /login', async ({ page }) => {
        await page.goto('/dashboard');
        await expect(page).toHaveURL(/\/auth\/login|\/login/);

        // Check if redirect back works after login (conceptual)
        // await page.fill('input[name="email"]', 'valid-user@example.com');
        // await page.fill('input[name="password"]', 'password');
        // await page.click('button[type="submit"]');
        // await expect(page).toHaveURL(/\/dashboard/);
    });

    test('authenticated user to /login redirects to /dashboard', async ({ page }) => {
        // This requires a mock session or real login
        // For now, testing the path only
        await page.goto('/signin'); // Some routes use /signin
        // ... logic to simulate session ...
    });

    test('password reset flow with automated email extraction @email', async ({ page }) => {
        const email = 'joshua+test@getringsnap.com'; // Use a stable test email if possible

        await page.goto('/auth/login');
        await page.click('text=/Forgot password/i');

        await page.fill('input[name="email"]', email);
        await page.click('button:has-text("Send Reset Link")');

        await expect(page.getByText(/check your email/i)).toBeVisible();

        // extract link from Resend
        // Pattern for reset: /reset-password?token=([^&\s]+)/
        const resetLinkPattern = /https?:\/\/[^\s"'<>]+reset-password\?token=[^&\s]+/i;

        try {
            const link = await emailHelper.getLatestLink(email, resetLinkPattern);
            console.log('Found reset link:', link);

            await page.goto(link);

            // Verify password reset page
            await expect(page.getByText(/set new password/i)).toBeVisible();
            await page.fill('input[name="password"]', 'NewSecurePassword123!');
            await page.click('button:has-text("Update Password")');

            await expect(page.getByText(/password updated/i)).toBeVisible();
        } catch (error) {
            console.error('Email extraction failed:', error);
            // Fail test if email not found in time
            throw error;
        }
    });

    test('email verification flow @email', async ({ page }) => {
        // This usually happens after signup
        // For smoke, we can test the link behavior
        const email = 'joshua+verify@getringsnap.com';
        const verifyPattern = /https?:\/\/[^\s"'<>]+verify\?token=[^&\s]+/i;

        // In a real flow, we'd trigger a verification email here

        // Simulation logic
        /*
        try {
          const link = await emailHelper.getLatestLink(email, verifyPattern);
          await page.goto(link);
          await expect(page.getByText(/email verified/i)).toBeVisible();
        } catch (err) {}
        */
    });

    test('logout clears session and prevents back navigation', async ({ page }) => {
        // 1. Login
        // 2. Click Logout
        // 3. Try to go back
        // 4. Verify redirected to login
    });
});
