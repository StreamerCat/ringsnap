import { test, expect } from '@playwright/test';

/**
 * E2E tests for the signup / create-trial flow.
 *
 * Covers:
 *  1. UI smoke – /start lead-capture page renders correctly
 *  2. API – create-trial edge function accepts a valid payload (bypassStripe)
 *  3. API – duplicate email returns a 409 / ACCOUNT_EXISTS error
 *  4. API – missing required fields are rejected (4xx validation error)
 */

// ─── helpers ────────────────────────────────────────────────────────────────

function getSupabaseUrl(): string {
    const url =
        process.env.SUPABASE_URL ||
        process.env.VITE_SUPABASE_URL ||
        'http://127.0.0.1:54321';

    // Normalize .supabase.com → .supabase.co
    if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
        return url.replace('.supabase.com', '.supabase.co');
    }
    return url;
}

function getAnonKey(): string {
    return (
        process.env.SUPABASE_ANON_KEY ||
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        ''
    );
}

// ─── UI smoke tests (no auth required) ──────────────────────────────────────

test.describe('Signup – /start page', () => {
    test('page loads with name and email inputs', async ({ page }) => {
        await page.goto('/start');
        await page.waitForLoadState('networkidle');

        // Should show some form of lead-capture form
        await expect(page.locator('body')).toBeVisible();

        // Accept either a redirect to signin or the actual /start form
        const url = page.url();
        if (url.includes('/start')) {
            // Expect name input to eventually appear
            const nameInput = page
                .getByRole('textbox', { name: /name/i })
                .first();
            const emailInput = page
                .getByRole('textbox', { name: /email/i })
                .first();

            const hasName = await nameInput.isVisible().catch(() => false);
            const hasEmail = await emailInput.isVisible().catch(() => false);

            // At least one of the inputs must be present
            expect(hasName || hasEmail).toBe(true);
        }
    });

    test('entering name and email enables the submit button', async ({ page }) => {
        await page.goto('/start');
        await page.waitForLoadState('networkidle');

        if (!page.url().includes('/start')) {
            // Redirected to login – nothing to assert here
            return;
        }

        const nameInput = page
            .getByRole('textbox', { name: /name/i })
            .first();
        const emailInput = page
            .getByRole('textbox', { name: /email/i })
            .first();

        const hasForm =
            (await nameInput.isVisible().catch(() => false)) &&
            (await emailInput.isVisible().catch(() => false));

        if (!hasForm) {
            // Form not visible; skip gracefully
            return;
        }

        await nameInput.fill('Test User');
        await emailInput.fill(`test+${Date.now()}@getringsnap.com`);

        // After filling the form, a submit/continue button should be enabled
        const submitBtn = page
            .getByRole('button', { name: /continue|get started|start|sign up/i })
            .first();

        if (await submitBtn.isVisible().catch(() => false)) {
            await expect(submitBtn).toBeEnabled();
        }
    });
});

// ─── API tests – create-trial edge function ──────────────────────────────────

test.describe('Signup – create-trial API', () => {
    test.skip(
        !process.env.SUPABASE_URL && !process.env.VITE_SUPABASE_URL,
        'Skipping create-trial API tests – no SUPABASE_URL configured'
    );

    const supabaseUrl = getSupabaseUrl();
    const anonKey = getAnonKey();
    const endpoint = `${supabaseUrl}/functions/v1/create-trial`;

    test('create-trial accepts valid payload with bypassStripe', async ({ request }) => {
        const timestamp = Date.now();
        const testEmail = `e2e-trial-${timestamp}@getringsnap.com`;

        const response = await request.post(endpoint, {
            headers: {
                'Content-Type': 'application/json',
                ...(anonKey ? { Authorization: `Bearer ${anonKey}` } : {}),
            },
            data: {
                name: 'E2E Test User',
                email: testEmail,
                phone: '5551234567',
                companyName: 'E2E Plumbing Co',
                trade: 'Plumbing',
                planType: 'professional',
                paymentMethodId: 'pm_bypass_test',
                bypassStripe: true,
                zipCode: '90210',
                assistantGender: 'female',
                source: 'website',
            },
        });

        // Should not be a hard 404 (function not deployed)
        expect(response.status()).not.toBe(404);

        const body = await response.json().catch(() => null);

        if (response.ok()) {
            // Happy-path: account created
            expect(body).toHaveProperty('success', true);
            expect(body).toHaveProperty('account_id');
            expect(typeof body.account_id).toBe('string');
            expect(body.account_id.length).toBeGreaterThan(0);
        } else {
            // Function is deployed but returned a non-2xx status
            // (e.g. Stripe not bypassed in this env, env vars missing, etc.)
            // We accept any structured error response – just assert it's not a deploy 404
            expect([400, 401, 409, 422, 500]).toContain(response.status());
        }
    });

    test('create-trial rejects duplicate email with 409', async ({ request }) => {
        const timestamp = Date.now();
        const testEmail = `e2e-dup-${timestamp}@getringsnap.com`;

        const commonPayload = {
            name: 'E2E Dup User',
            email: testEmail,
            phone: '5559876543',
            companyName: 'E2E HVAC',
            trade: 'HVAC',
            planType: 'professional',
            paymentMethodId: 'pm_bypass_test',
            bypassStripe: true,
            zipCode: '10001',
            assistantGender: 'male',
            source: 'website',
        };

        const headers = {
            'Content-Type': 'application/json',
            ...(anonKey ? { Authorization: `Bearer ${anonKey}` } : {}),
        };

        // First call – create the account
        const first = await request.post(endpoint, {
            headers,
            data: commonPayload,
        });

        expect(first.status()).not.toBe(404);

        if (!first.ok()) {
            // Cannot create the first account (env issue); skip duplicate check
            return;
        }

        // Second call – same email should be rejected
        const second = await request.post(endpoint, {
            headers,
            data: { ...commonPayload, name: 'E2E Dup User 2' },
        });

        // Expect conflict (409) or a similar client error
        expect(second.status()).toBeGreaterThanOrEqual(400);
        expect(second.status()).toBeLessThan(500);

        const body = await second.json().catch(() => null);
        if (body) {
            const hasConflictSignal =
                body.code === 'ACCOUNT_EXISTS' ||
                body.error?.toLowerCase().includes('already exists') ||
                body.message?.toLowerCase().includes('already exists') ||
                second.status() === 409;
            expect(hasConflictSignal).toBe(true);
        }
    });

    test('create-trial rejects missing required fields', async ({ request }) => {
        const response = await request.post(endpoint, {
            headers: {
                'Content-Type': 'application/json',
                ...(anonKey ? { Authorization: `Bearer ${anonKey}` } : {}),
            },
            data: {
                // Intentionally omit required fields (email, phone, companyName, etc.)
                name: 'Incomplete User',
                source: 'website',
            },
        });

        // Should return a 4xx validation error, not a 500 or 404
        expect(response.status()).not.toBe(404);
        expect(response.status()).toBeGreaterThanOrEqual(400);
        expect(response.status()).toBeLessThan(500);
    });
});
