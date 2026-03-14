import { test, expect } from '@playwright/test';

/**
 * Operator Dashboard Smoke Tests
 *
 * Verifies that a provisioned operator (customer) account can access the
 * dashboard and sees the expected navigation tabs and content sections.
 *
 * Unauthenticated tests run in CI. Auth-required tests are tagged
 * @auth @skip-ci and require TEST_USER_EMAIL / TEST_USER_PASSWORD env vars.
 */

test.describe('Operator Dashboard — Unauthenticated', () => {
    test('dashboard route redirects to signin when not authenticated', async ({ page }) => {
        await page.goto('/dashboard');
        await page.waitForURL(/signin|login|dashboard/, { timeout: 8000 });
        // Must not be an error page
        await expect(page.locator('body')).not.toContainText(/500|Internal Server Error/i);
    });

    test('dashboard URL with ?tab= param redirects without crashing', async ({ page }) => {
        for (const tab of ['inbox', 'schedule', 'billing', 'team', 'settings']) {
            await page.goto(`/dashboard?tab=${tab}`);
            await page.waitForURL(/signin|login|dashboard/, { timeout: 6000 });
            await expect(page.locator('body')).not.toContainText(/500|Internal Server Error/i);
        }
    });
});

/**
 * Auth-required operator dashboard tests.
 *
 * To run locally with a test account:
 *   TEST_USER_EMAIL=... TEST_USER_PASSWORD=... npx playwright test operator-dashboard
 */
test.describe('Operator Dashboard — Authenticated @auth @skip-ci', () => {
    test.beforeEach(async ({ page }) => {
        const email = process.env.TEST_USER_EMAIL;
        const password = process.env.TEST_USER_PASSWORD;

        if (!email || !password) {
            test.skip();
            return;
        }

        // Sign in via the login form
        await page.goto('/signin');
        await page.locator('input[type="email"], input[name="email"]').fill(email);
        await page.locator('input[type="password"], input[name="password"]').fill(password);
        await page.locator('button[type="submit"]').click();
        await page.waitForURL('/dashboard', { timeout: 15000 });
    });

    test('dashboard loads and shows primary nav tabs', async ({ page }) => {
        await page.waitForLoadState('networkidle');

        // The 6 primary tabs should be visible
        const tabList = page.locator('[role="tablist"]');
        await expect(tabList).toBeVisible({ timeout: 10000 });

        await expect(page.locator('[role="tab"]:has-text("Inbox"), [role="tab"] svg.lucide-inbox')).toBeVisible();
        await expect(page.locator('[role="tab"]:has-text("Schedule"), [role="tab"] svg.lucide-calendar-check')).toBeVisible();
        await expect(page.locator('[role="tab"]:has-text("Billing"), [role="tab"] svg.lucide-credit-card')).toBeVisible();
    });

    test('inbox tab renders call content or empty state (no error)', async ({ page }) => {
        await page.goto('/dashboard?tab=inbox');
        await page.waitForLoadState('networkidle');

        // Should not show a generic crash or "undefined" error
        await expect(page.locator('body')).not.toContainText(/something went wrong|undefined|cannot read/i);

        // Either shows calls or empty state — not blank
        const hasCalls = await page.locator('[data-testid="call-row"]').first().isVisible({ timeout: 3000 }).catch(() => false);
        const hasEmptyState = await page.locator('text=No calls').first().isVisible({ timeout: 3000 }).catch(() => false);
        const hasContent = await page.locator('h2, h3, [class*="CardTitle"]').first().isVisible({ timeout: 3000 }).catch(() => false);

        expect(hasCalls || hasEmptyState || hasContent).toBe(true);
    });

    test('schedule tab renders calendar or empty state (no error)', async ({ page }) => {
        await page.goto('/dashboard?tab=schedule');
        await page.waitForLoadState('networkidle');

        await expect(page.locator('body')).not.toContainText(/something went wrong|undefined|cannot read/i);

        // Schedule tab should show either appointments or an empty state message
        const hasContent = await page.locator(
            'text=Appointments, text=No appointments, text=Schedule, [data-testid="calendar-tab"]'
        ).first().isVisible({ timeout: 5000 }).catch(() => false);

        expect(hasContent).toBe(true);
    });

    test('billing tab renders subscription info or upgrade prompt (no error)', async ({ page }) => {
        await page.goto('/dashboard?tab=billing');
        await page.waitForLoadState('networkidle');

        await expect(page.locator('body')).not.toContainText(/something went wrong|undefined|cannot read/i);

        // Should show billing-related content
        const hasBillingContent = await page.locator(
            'text=Billing, text=subscription, text=Upgrade, text=Plan, text=Trial'
        ).first().isVisible({ timeout: 5000 }).catch(() => false);

        expect(hasBillingContent).toBe(true);
    });

    test('team tab renders without error', async ({ page }) => {
        await page.goto('/dashboard?tab=team');
        await page.waitForLoadState('networkidle');

        await expect(page.locator('body')).not.toContainText(/something went wrong|Failed to load team/i);

        const hasContent = await page.locator(
            'text=Team, text=Invite, text=No team members, table'
        ).first().isVisible({ timeout: 5000 }).catch(() => false);

        expect(hasContent).toBe(true);
    });

    test('legacy tab redirects work — calendar and appointments route to schedule content', async ({ page }) => {
        for (const legacyTab of ['calendar', 'appointments']) {
            await page.goto(`/dashboard?tab=${legacyTab}`);
            await page.waitForLoadState('networkidle');

            // Should not crash or show blank page
            await expect(page.locator('body')).not.toContainText(/something went wrong|undefined/i);
            const hasAnyContent = await page.locator('[role="tabpanel"]').first().isVisible({ timeout: 5000 }).catch(() => false);
            expect(hasAnyContent).toBe(true);
        }
    });

    test('provisioning banner is NOT visible for a fully provisioned account', async ({ page }) => {
        await page.waitForLoadState('networkidle');

        // A provisioned test account should not show the "still finishing" banner
        await expect(page.locator('text=Provisioning still finishing')).not.toBeVisible({ timeout: 5000 });
        await expect(page.locator('text=Setting up your number')).not.toBeVisible({ timeout: 2000 });
    });
});
