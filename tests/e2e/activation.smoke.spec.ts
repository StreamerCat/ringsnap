import { test, expect } from '@playwright/test';

/**
 * Activation & Dashboard Smoke Tests
 * 
 * These are authenticated tests that verify:
 * - Activation page renders key UI elements
 * - Dashboard Today tab renders table or empty state
 * - Dashboard Billing tab loads
 */

test.describe('Activation Flow', () => {
    test.use({ storageState: 'tests/.auth/user.json' });

    test('activation page renders key UI or redirects', async ({ page }) => {
        await page.goto('/activation');

        // Wait for page to settle
        await page.waitForLoadState('networkidle');

        const url = page.url();

        if (url.includes('/activation')) {
            // Should see key activation UI elements
            // Phone number display OR "Almost ready" state
            const hasPhoneDisplay = await page.locator('text=/Your RingSnap/i').isVisible().catch(() => false);
            const hasAlmostReady = await page.locator('text=/Almost ready/i').isVisible().catch(() => false);
            const hasContinueButton = await page.getByRole('button', { name: /continue/i }).isVisible().catch(() => false);

            expect(hasPhoneDisplay || hasAlmostReady || hasContinueButton).toBe(true);
        } else {
            // Redirected to dashboard or login is acceptable
            expect(url).toMatch(/\/dashboard|\/auth\/login/);
        }
    });

    test('dashboard today tab renders table or empty state', async ({ page }) => {
        await page.goto('/dashboard?tab=today');

        await page.waitForLoadState('networkidle');

        // Verify we're on dashboard
        await expect(page).toHaveURL(/\/dashboard/);

        // Either table headers or empty state message should be present
        const hasTableHeaders = await page.locator('table th').count() > 0;
        const hasEmptyState = await page.getByText(/no calls/i).isVisible().catch(() => false);
        const hasLoadingState = await page.getByText(/loading/i).isVisible().catch(() => false);

        // At least one of these should be true
        expect(hasTableHeaders || hasEmptyState || hasLoadingState).toBe(true);
    });

    test('dashboard billing tab loads plan info', async ({ page }) => {
        await page.goto('/dashboard?tab=billing');

        await page.waitForLoadState('networkidle');

        // Verify we're on dashboard
        await expect(page).toHaveURL(/\/dashboard/);

        // Should see current plan section
        await expect(page.getByText(/Current Plan|Plan/i).first()).toBeVisible({ timeout: 10000 });
    });

    test('dashboard overview tab has key stats', async ({ page }) => {
        await page.goto('/dashboard?tab=overview');

        await page.waitForLoadState('networkidle');

        // Should see stats cards
        await expect(page.getByText(/RingSnap Number|Usage|Plan/i).first()).toBeVisible({ timeout: 10000 });
    });
});
