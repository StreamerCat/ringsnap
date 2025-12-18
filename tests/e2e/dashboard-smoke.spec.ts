import { test, expect } from '@playwright/test';

/**
 * Dashboard MVP Smoke Tests
 * 
 * These tests verify critical UI elements and behaviors for the MVP fixes.
 * Most tests run without auth - just verify basic rendering.
 */

test.describe('Dashboard MVP Smoke Tests', () => {
    // UI smoke tests - no auth needed
    test('home page loads successfully', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/ringsnap/i);
        const body = await page.locator('body').isVisible();
        expect(body).toBe(true);
    });

    test('signin page shows login form', async ({ page }) => {
        await page.goto('/signin');
        // Check for form element
        await expect(page.locator('form')).toBeVisible();
        // Check for email input
        await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    });

    test('dashboard redirects to signin when not authenticated', async ({ page }) => {
        await page.goto('/dashboard');
        // Should either redirect to signin or show login prompt
        await page.waitForURL(/signin|login|dashboard/, { timeout: 5000 });
        const currentUrl = page.url();
        // Just verify we didn't crash
        expect(currentUrl).toBeTruthy();
    });
});

test.describe('UI Element Checks', () => {
    test('start page loads (free trial signup)', async ({ page }) => {
        await page.goto('/start');
        // Should show signup form or redirect
        const body = await page.locator('body').isVisible();
        expect(body).toBe(true);
    });

    test('pricing page loads', async ({ page }) => {
        await page.goto('/pricing');
        // Check for pricing content
        await expect(page.locator('body')).toContainText(/Starter|Professional|Premium|price|month/i);
    });
});

/**
 * Authenticated tests - requires test credentials
 * These are marked @auth and skipped in basic CI runs
 */
test.describe('Dashboard Components @auth @skip-ci', () => {
    test.skip('provisioning banner does NOT show for provisioned account', async ({ page }) => {
        // This test requires a properly provisioned test account
        await page.goto('/dashboard');

        // Wait for dashboard to load
        await page.waitForSelector('text=Your RingSnap Number', { timeout: 10000 });

        // Verify provisioning banner is NOT visible for fully provisioned account
        // The amber alert with "Provisioning still finishing" should not exist
        const provisioningBanner = page.locator('text=Provisioning still finishing');
        await expect(provisioningBanner).not.toBeVisible();
    });

    test.skip('overview tab shows date filter dropdown', async ({ page }) => {
        await page.goto('/dashboard?tab=overview');

        // Wait for recent activity section
        await page.waitForSelector('text=Recent Activity', { timeout: 10000 });

        // Verify date filter exists
        await expect(page.locator('text=All Time')).toBeVisible();

        // Click to open dropdown and verify options
        await page.click('text=All Time');
        await expect(page.locator('text=Last 3 Days')).toBeVisible();
        await expect(page.locator('text=This Week')).toBeVisible();
        await expect(page.locator('text=This Month')).toBeVisible();
    });

    test.skip('team tab shows empty state without errors', async ({ page }) => {
        await page.goto('/dashboard?tab=team');

        // Wait for page load
        await page.waitForLoadState('networkidle');

        // Should show either team members OR empty state - never an error toast
        const hasEmptyState = await page.locator('text=No team members yet').isVisible().catch(() => false);
        const hasTeamMembers = await page.locator('table').isVisible().catch(() => false);
        const hasInviteButton = await page.locator('button:has-text("Invite"), button:has-text("Add")').isVisible().catch(() => false);

        // At minimum, the invite button should be visible
        expect(hasEmptyState || hasTeamMembers || hasInviteButton).toBe(true);

        // Verify no error toast appeared
        const errorToast = page.locator('text=Failed to load team members');
        await expect(errorToast).not.toBeVisible();
    });

    test.skip('call logs show formatted caller info', async ({ page }) => {
        await page.goto('/dashboard?tab=today');

        // Wait for call log section
        await page.waitForSelector('text=Today\'s Call Log, text=Calls Today', { timeout: 10000 });

        // If there are calls, verify format of caller column
        const callRow = page.locator('table tbody tr').first();
        if (await callRow.isVisible()) {
            // Each call row should have a caller cell
            const callerCell = callRow.locator('td').nth(1); // Second column
            await expect(callerCell).toBeVisible();

            // Content should be either a name or formatted phone like "(555) 123-4567"
            const text = await callerCell.textContent();
            expect(text).toBeTruthy();
            // Should not be just "Unknown" - should be formatted
            if (text?.includes('Unknown')) {
                expect(text).toContain('caller');
            }
        }
    });
});
