import { test as setup, expect } from '@playwright/test';

/**
 * Authentication Setup for Playwright Tests
 * 
 * Logs in once and saves session to storageState for reuse.
 * Requires TEST_USER_EMAIL and TEST_USER_PASSWORD env vars.
 */

const authFile = 'tests/.auth/user.json';

setup('authenticate', async ({ page }) => {
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;

    if (!email || !password) {
        throw new Error('TEST_USER_EMAIL and TEST_USER_PASSWORD must be set');
    }

    // Navigate to login
    await page.goto('/auth/login');

    // Fill login form
    await page.fill('input[name="email"], input[type="email"]', email);
    await page.fill('input[name="password"], input[type="password"]', password);

    // Submit
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });

    // Verify we're on dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // Save authenticated state
    await page.context().storageState({ path: authFile });
});
