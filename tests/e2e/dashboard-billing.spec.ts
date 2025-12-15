import { test, expect } from '@playwright/test';

/**
 * Dashboard Billing Smoke Tests
 * 
 * These tests verify critical UI elements render correctly.
 * They do NOT complete real Stripe payments in CI.
 */

test.describe('Dashboard Billing', () => {
    // Skip auth for smoke tests - just verify UI rendering
    // In a real setup, you'd inject auth cookies or use Supabase test tokens

    test('dashboard page loads', async ({ page }) => {
        // This will redirect to login if not authenticated
        // We're just checking the page doesn't crash
        await page.goto('/dashboard');

        // Check for either dashboard content or login redirect
        const hasContent = await page.locator('body').isVisible();
        expect(hasContent).toBe(true);
    });

    test.describe('with mocked auth @skip-ci', () => {
        // These tests require auth setup - mark as skip-ci for now

        test.skip('billing tab shows current plan card', async ({ page }) => {
            await page.goto('/dashboard?tab=billing');

            // Verify billing section elements
            await expect(page.getByText('Current Plan')).toBeVisible();
            await expect(page.getByRole('button', { name: /upgrade|change plan/i })).toBeVisible();
        });

        test.skip('upgrade modal opens with plan cards', async ({ page }) => {
            await page.goto('/dashboard?tab=billing');

            // Click upgrade button
            await page.getByRole('button', { name: /upgrade|change plan/i }).click();

            // Verify modal opens
            await expect(page.getByRole('dialog')).toBeVisible();

            // Verify 3 plan cards exist
            const planCards = page.locator('[data-testid="plan-card"]');
            // Fallback: check for plan names
            await expect(page.getByText('Starter')).toBeVisible();
            await expect(page.getByText('Professional')).toBeVisible();
            await expect(page.getByText('Premium')).toBeVisible();
        });

        test.skip('invoices section renders', async ({ page }) => {
            await page.goto('/dashboard?tab=billing');

            // Verify billing history section
            await expect(page.getByText('Billing History')).toBeVisible();

            // Check for either invoice list or "No invoices" message
            const hasInvoices = await page.getByRole('table').isVisible().catch(() => false);
            const hasNoInvoicesMessage = await page.getByText(/no invoices/i).isVisible().catch(() => false);

            expect(hasInvoices || hasNoInvoicesMessage).toBe(true);
        });
    });
});

test.describe('UI Smoke Tests', () => {
    test('home page loads', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/ringsnap/i);
    });

    test('login page loads', async ({ page }) => {
        await page.goto('/signin');
        const hasLoginForm = await page.locator('form').isVisible();
        expect(hasLoginForm).toBe(true);
    });
});
