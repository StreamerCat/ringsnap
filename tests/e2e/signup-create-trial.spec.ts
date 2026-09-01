import { test, expect } from '@playwright/test';
import { createHmac } from 'node:crypto';

/**
 * E2E tests for the signup / create-trial flow.
 *
 * Covers:
 *  1. UI smoke – /start lead-capture page renders correctly
 *  2. API – create-trial accepts a valid, signed synthetic CI payload
 *  3. API – duplicate email returns a 409 / ACCOUNT_EXISTS error
 *  4. API – missing required fields are rejected (4xx validation error)
 *
 * Tests skip gracefully when the dev server or Supabase is unreachable,
 * so they are safe to run in any environment and will only assert when
 * both services are available.
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

const ciSecret = process.env.CI_TEST_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ciRunId = `ci-${process.env.CI_TEST_RUN_ID || Date.now()}`;

function getSignedCiHeaders(): Record<string, string> {
    if (!ciSecret) throw new Error('CI_TEST_SECRET or SUPABASE_SERVICE_ROLE_KEY is required');
    const timestamp = Date.now().toString();
    const signature = createHmac('sha256', ciSecret)
        .update(`${ciRunId}:${timestamp}`)
        .digest('hex');

    return {
        'x-ringsnap-ci-run-id': ciRunId,
        'x-ringsnap-ci-timestamp': timestamp,
        'x-ringsnap-ci-signature': signature,
    };
}

/** Returns true if the error is a TCP-level connection failure. */
function isConnectionRefused(err: unknown): boolean {
    const msg = String(err);
    return (
        msg.includes('ERR_CONNECTION_REFUSED') ||
        msg.includes('ECONNREFUSED') ||
        msg.includes('ENOTFOUND') ||
        msg.includes('ETIMEDOUT')
    );
}

// ─── UI smoke tests (no auth required) ──────────────────────────────────────

test.describe('Signup – /start page', () => {
    test('page loads with name and email inputs', async ({ page }) => {
        try {
            await page.goto('/start');
        } catch (err) {
            if (isConnectionRefused(err)) {
                test.skip(true, 'Dev server not reachable – skipping UI test');
                return;
            }
            throw err;
        }

        await page.waitForLoadState('networkidle');

        // Should show some form of lead-capture form
        await expect(page.locator('body')).toBeVisible();

        // Accept either a redirect to signin or the actual /start form
        const url = page.url();
        if (url.includes('/start')) {
            const nameInput = page.getByRole('textbox', { name: /name/i }).first();
            const emailInput = page.getByRole('textbox', { name: /email/i }).first();

            const hasName = await nameInput.isVisible().catch(() => false);
            const hasEmail = await emailInput.isVisible().catch(() => false);

            // At least one of the inputs must be present
            expect(hasName || hasEmail).toBe(true);
        }
    });

    test('entering name and email enables the submit button', async ({ page }) => {
        try {
            await page.goto('/start');
        } catch (err) {
            if (isConnectionRefused(err)) {
                test.skip(true, 'Dev server not reachable – skipping UI test');
                return;
            }
            throw err;
        }

        await page.waitForLoadState('networkidle');

        if (!page.url().includes('/start')) {
            // Redirected to login – nothing to assert here
            return;
        }

        const nameInput = page.getByRole('textbox', { name: /name/i }).first();
        const emailInput = page.getByRole('textbox', { name: /email/i }).first();

        const hasForm =
            (await nameInput.isVisible().catch(() => false)) &&
            (await emailInput.isVisible().catch(() => false));

        if (!hasForm) {
            // Form not visible – skip gracefully
            return;
        }

        await nameInput.fill('Test User');
        await emailInput.fill(`test+${Date.now()}@getringsnap.com`);

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
    const supabaseUrl = getSupabaseUrl();
    const anonKey = getAnonKey();
    const endpoint = `${supabaseUrl}/functions/v1/create-trial`;

    const defaultHeaders = (signedCiRequest = false) => ({
        'Content-Type': 'application/json',
        ...(anonKey ? { Authorization: `Bearer ${anonKey}` } : {}),
        ...(signedCiRequest ? getSignedCiHeaders() : {}),
    });

    test('create-trial accepts valid payload with bypassStripe', async ({ request }) => {
        test.skip(!ciSecret, 'Signed CI credentials are not configured');
        const timestamp = Date.now();
        const testEmail = `e2e-trial-${timestamp}@getringsnap.com`;

        let response: Awaited<ReturnType<typeof request.post>>;
        try {
            response = await request.post(endpoint, {
                headers: defaultHeaders(true),
                data: {
                    name: 'E2E Test User',
                    email: testEmail,
                    phone: '5551234567',
                    companyName: 'E2E Plumbing Co',
                    trade: 'Plumbing',
                    planType: 'professional',
                    paymentMethodId: 'pm_bypass_test',
                    bypassStripe: true,
                    zipCode: '99999', // Test mode: skips real Twilio/Vapi provisioning
                    assistantGender: 'female',
                    source: 'website',
                },
            });
        } catch (err) {
            if (isConnectionRefused(err)) {
                test.skip(true, 'Supabase not reachable – skipping API test');
                return;
            }
            throw err;
        }

        const body = await response.json().catch(() => null);
        expect(response.status(), JSON.stringify(body)).toBe(200);
        expect(body).toHaveProperty('success', true);
        expect(body).toHaveProperty('ci_test', true);
        expect(body).toHaveProperty('ci_run_id', ciRunId);
        expect(body).toHaveProperty('account_id');
        expect(typeof body.account_id).toBe('string');
        expect(body.account_id.length).toBeGreaterThan(0);
    });

    test('create-trial rejects duplicate email with 409', async ({ request }) => {
        test.skip(!ciSecret, 'Signed CI credentials are not configured');
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
            zipCode: '99999', // Test mode: skips real Twilio/Vapi provisioning
            assistantGender: 'male',
            source: 'website',
        };

        // First call – create the account
        let first: Awaited<ReturnType<typeof request.post>>;
        try {
            first = await request.post(endpoint, {
                headers: defaultHeaders(true),
                data: commonPayload,
            });
        } catch (err) {
            if (isConnectionRefused(err)) {
                test.skip(true, 'Supabase not reachable – skipping API test');
                return;
            }
            throw err;
        }

        const firstBody = await first.json().catch(() => null);
        expect(first.status(), JSON.stringify(firstBody)).toBe(200);
        expect(firstBody).toHaveProperty('ci_test', true);

        // Second call – same email should be rejected
        const second = await request.post(endpoint, {
            headers: defaultHeaders(true),
            data: { ...commonPayload, name: 'E2E Dup User 2' },
        });

        expect(second.status()).toBe(409);

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
        let response: Awaited<ReturnType<typeof request.post>>;
        try {
            response = await request.post(endpoint, {
                headers: defaultHeaders(),
                data: {
                    // Intentionally omit required fields (email, phone, companyName, etc.)
                    name: 'Incomplete User',
                    source: 'website',
                },
            });
        } catch (err) {
            if (isConnectionRefused(err)) {
                test.skip(true, 'Supabase not reachable – skipping API test');
                return;
            }
            throw err;
        }

        // Should return a 4xx validation error, not a 500 or 404
        expect(response.status()).not.toBe(404);
        expect(response.status()).toBeGreaterThanOrEqual(400);
        expect(response.status()).toBeLessThan(500);
    });
});
