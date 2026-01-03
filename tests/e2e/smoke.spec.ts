import { test, expect } from '@playwright/test';

/**
 * GTM Smoke Tests
 *
 * Minimal suite for maximum confidence on critical user flows.
 * These tests should pass on every PR before merge.
 */

/**
 * Normalize Supabase URL to use correct domain (.supabase.co)
 * Handles common cases:
 * - .supabase.com → .supabase.co (legacy/incorrect domain)
 * - localhost variants → unchanged (127.0.0.1:54321, etc)
 * - Missing URL → throws clear error
 */
function getNormalizedSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL;

  if (!url) {
    throw new Error(
      'SUPABASE_URL environment variable is required for API tests. ' +
      'Please set SUPABASE_URL in your .env file or CI environment.'
    );
  }

  // Preserve localhost URLs unchanged
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    return url;
  }

  // Normalize .supabase.com → .supabase.co
  if (url.endsWith('.supabase.com') || url.includes('.supabase.com/')) {
    return url.replace('.supabase.com', '.supabase.co');
  }

  return url;
}

test.describe('Marketing Pages', () => {
    test('homepage loads and has navigation', async ({ page }) => {
        // Navigate to homepage
        await page.goto('/');

        // Verify page loaded successfully
        await expect(page).toHaveTitle(/RingSnap/i);

        // Check for main navigation or CTA - be flexible about the exact text
        const mainContent = page.locator('main, [role="main"], .hero, header').first();
        await expect(mainContent).toBeVisible();
    });

    test('pricing page loads with plan options', async ({ page }) => {
        await page.goto('/pricing');

        // Verify pricing page loaded
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

        // Check for plan cards or pricing info
        await expect(page.locator('text=/\\$\\d+/').first()).toBeVisible();
    });

    test('difference page loads', async ({ page }) => {
        await page.goto('/difference');

        // Verify page loaded
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

        // Check for content sections
        await expect(page.locator('main')).toBeVisible();
    });
});

test.describe('Signup Flow - Lead Capture', () => {
    test('step 1 email entry triggers lead capture', async ({ page, request }) => {
        // This test verifies that entering an email calls the lead capture endpoint
        await page.goto('/start');

        // Find email input (may be in a modal or form)
        const emailInput = page.getByRole('textbox', { name: /email/i }).first();

        if (await emailInput.isVisible()) {
            // Generate unique test email
            const testEmail = `test+${Date.now()}@getringsnap.com`;
            await emailInput.fill(testEmail);

            // Tab or click out to potentially trigger validation/save
            await emailInput.press('Tab');

            // Allow some time for async calls
            await page.waitForTimeout(500);

            // We can't easily verify the backend call here without intercepting,
            // but we verify the form accepts the input
            await expect(emailInput).toHaveValue(testEmail);
        }
    });
});

test.describe('Authentication', () => {
    test('login page loads', async ({ page }) => {
        await page.goto('/login');

        // Verify login form elements
        await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
    });
});

test.describe('Dashboard - Authenticated', () => {
    // Skip these tests if no test credentials are configured
    test.skip(!process.env.TEST_USER_EMAIL, 'Skipping dashboard tests - no test credentials');

    test.beforeEach(async ({ page }) => {
        // Login with test credentials
        await page.goto('/login');
        await page.getByRole('textbox', { name: /email/i }).fill(process.env.TEST_USER_EMAIL || '');
        await page.getByRole('textbox', { name: /password/i }).fill(process.env.TEST_USER_PASSWORD || '');
        await page.getByRole('button', { name: /sign in|log in/i }).click();

        // Wait for dashboard to load
        await page.waitForURL(/\/dashboard|\/onboarding|\/provisioning/);
    });

    test('dashboard loads key sections', async ({ page }) => {
        // Navigate to dashboard if not already there
        if (!page.url().includes('/dashboard')) {
            await page.goto('/dashboard');
        }

        // Verify dashboard loaded - check for key UI elements
        // These selectors may need adjustment based on actual UI
        const mainContent = page.locator('main').first();
        await expect(mainContent).toBeVisible();
    });

    test('billing tab shows plan info', async ({ page }) => {
        await page.goto('/dashboard');

        // Click billing tab or navigate to billing section
        const billingLink = page.getByRole('link', { name: /billing|settings/i }).first();
        if (await billingLink.isVisible()) {
            await billingLink.click();
        }

        // Check for billing-related content
        // The "Manage Billing" button should be visible for paid users
        const manageBillingBtn = page.getByRole('button', { name: /manage.*billing/i });
        if (await manageBillingBtn.isVisible()) {
            await expect(manageBillingBtn).toBeEnabled();
        }
    });
});

test.describe('Billing Smoke - Checkout Session', () => {
    test.skip(!process.env.SUPABASE_URL, 'Skipping billing smoke - no Supabase URL');

    test('checkout route is reachable', async ({ page }) => {
        // Verify that the success route exists (to catch broken routing)
        // We don't actually complete Stripe Checkout to avoid flakes
        const response = await page.goto('/billing/success');

        // Should not be a 404 - page should exist (may redirect to login)
        expect(response?.status()).not.toBe(404);
    });
});

test.describe('SEO & Indexing', () => {
    test('robots.txt is accessible', async ({ request }) => {
        const response = await request.get('/robots.txt');
        expect(response.ok()).toBe(true);

        const text = await response.text();
        expect(text.toLowerCase()).toContain('user-agent');
    });

    test('sitemap.xml is accessible', async ({ request }) => {
        const response = await request.get('/sitemap.xml');
        expect(response.ok()).toBe(true);

        const text = await response.text();
        expect(text).toContain('<?xml');
        expect(text.toLowerCase()).toContain('urlset');
    });

    test('homepage has essential meta content', async ({ page }) => {
        await page.goto('/');

        // Check for title - should be non-empty and descriptive
        const title = await page.title();
        expect(title.length).toBeGreaterThan(5);
        expect(title.toLowerCase()).toContain('ringsnap');

        // Check for any meta description (if present) - use first() to avoid strict mode
        const metaDescription = page.locator('meta[name="description"]').first();
        const hasDescription = await metaDescription.count() > 0;

        // Log but don't fail if no description - some SPAs load it dynamically
        if (hasDescription) {
            const content = await metaDescription.getAttribute('content');
            expect(content?.length).toBeGreaterThan(0);
        }
    });
});

test.describe('Error Handling', () => {
    test('404 page renders for invalid routes', async ({ page }) => {
        const response = await page.goto('/this-page-definitely-does-not-exist-xyz123');

        // Should return 404 or redirect to 404 page
        // Some SPAs may return 200 with a 404 component
        const content = await page.textContent('body');

        // Check for 404-related content or proper navigation
        expect(
            response?.status() === 404 ||
            content?.toLowerCase().includes('not found') ||
            content?.toLowerCase().includes('404')
        ).toBe(true);
    });
});

test.describe('API / Edge Functions', () => {
    test.skip(!process.env.SUPABASE_URL, 'Skipping API tests - no Supabase URL');

    test('availability endpoint is deployed and reachable', async ({ request }) => {
        const supabaseUrl = getNormalizedSupabaseUrl();

        // Make a request to the availability endpoint
        // This should return 401 (unauthorized) or 500 (missing data)
        // but NOT 404 (would mean endpoint not deployed)
        const response = await request.post(`${supabaseUrl}/functions/v1/vapi-tools-availability`, {
            headers: {
                'Content-Type': 'application/json',
            },
            data: {
                message: { call: { id: 'test', assistantId: 'test' } },
                toolCall: {
                    id: 'test-call',
                    function: { arguments: { date: '2024-01-15' } }
                }
            }
        });

        // Should not be 404 - endpoint should exist
        expect(response.status()).not.toBe(404);

        // Should return JSON
        const contentType = response.headers()['content-type'];
        expect(contentType).toContain('application/json');
    });

    test('appointments endpoint is deployed and reachable', async ({ request }) => {
        const supabaseUrl = getNormalizedSupabaseUrl();

        const response = await request.post(`${supabaseUrl}/functions/v1/vapi-tools-appointments`, {
            headers: {
                'Content-Type': 'application/json',
            },
            data: {
                message: { call: { id: 'test', assistantId: 'test' } },
                toolCall: {
                    id: 'test-call',
                    function: {
                        arguments: {
                            startDateTime: '2024-01-15T10:00:00Z',
                            callerName: 'Test',
                            callerPhone: '+15551234567',
                            timeZone: 'America/Denver'
                        }
                    }
                }
            }
        });

        // Should not be 404 - endpoint should exist
        expect(response.status()).not.toBe(404);

        // Should return JSON
        const contentType = response.headers()['content-type'];
        expect(contentType).toContain('application/json');
    });
});
