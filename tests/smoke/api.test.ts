import { describe, it, expect } from 'vitest';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const EDGE_FUNCTION_BASE_URL = `${SUPABASE_URL}/functions/v1`;

describe('GTM API Smoke Tests', () => {
    const correlationId = `test-${crypto.randomUUID()}`;

    const headers = {
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    };

    it('create-trial should return 400 on invalid payload', async () => {
        const response = await fetch(`${EDGE_FUNCTION_BASE_URL}/create-trial`, {
            method: 'POST',
            headers,
            body: JSON.stringify({})
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBeDefined();
    });

    it('get-billing-summary should require auth', async () => {
        const response = await fetch(`${EDGE_FUNCTION_BASE_URL}/get-billing-summary`, {
            method: 'GET',
            headers
        });

        // Without a valid user token, it should be 401
        expect(response.status).toBe(401);
    });

    it('stripe-webhook should handle GET as 405 or 401', async () => {
        const response = await fetch(`${EDGE_FUNCTION_BASE_URL}/stripe-webhook`, {
            method: 'GET',
            headers
        });

        expect([401, 405]).toContain(response.status);
    });
});
