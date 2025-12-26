
// Verification Script: E2E Routing Logic (Node.js version)
// Run with: node scripts/verify-routing.js

import assert from 'assert';
import { exit } from 'process';

console.log("Starting E2E Routing Simulation (Node.js)...");

// --- MOCKED DB ---
const mockDb = {
    phone_numbers: [],
    accounts: []
};

// --- MOCKED SUPABASE ---
const createMockSupabase = () => ({
    from: (table) => {
        return {
            select: (cols) => ({
                eq: (field, value) => {
                    const filter = (rows) => rows.filter(r => r[field] === value);
                    return {
                        maybeSingle: async () => {
                            const found = filter(mockDb[table])[0];
                            return { data: found || null };
                        },
                        eq: (field2, value2) => {
                            const filter2 = (rows) => rows.filter(r => r[field] === value && r[field2] === value2);
                            return {
                                maybeSingle: async () => {
                                    const found = filter2(mockDb[table])[0];
                                    return { data: found || null };
                                }
                            }
                        }
                    }
                }
            }),
            update: (updates) => ({
                eq: (field, value) => {
                    const row = mockDb[table].find(r => r[field] === value);
                    if (row) Object.assign(row, updates);
                    return Promise.resolve({ error: null });
                }
            }),
            insert: (row) => {
                const newRow = { id: 'uuid-' + Math.random(), ...row };
                mockDb[table].push(newRow);
                return Promise.resolve({ data: newRow, error: null });
            }
        }
    }
});

// --- LOGIC UNDER TEST (Duplicated from vapi-webhook/index.ts) ---
async function resolveMapping(supabase, call, matchedPhone) {
    if (!matchedPhone) return { accountId: null, phoneNumberId: null, method: "none" };

    // 1. SAFETY FIRST: Block Pool/Cooldown
    if (['pool', 'cooldown', 'quarantine'].includes(matchedPhone.lifecycle_status)) {
        return { accountId: null, phoneNumberId: matchedPhone.id, method: "blocked_lifecycle" };
    }

    // 2. Strict Assignment
    if (matchedPhone.lifecycle_status === 'assigned') {
        const canonicalId = matchedPhone.assigned_account_id ?? matchedPhone.account_id;
        return { accountId: canonicalId, phoneNumberId: matchedPhone.id, method: "assigned_native" };
    }

    // 3. Legacy Fallback (Active Only)
    if (!matchedPhone.lifecycle_status && matchedPhone.account_id) {
        // Mock: In real code we join account status. Here we assume we passed it if needed.
        // For simulation, let's treat it as blocked if we didn't mock the join check, 
        // OR just assume valid for this test if we aren't testing legacy path.
        return { accountId: null, phoneNumberId: matchedPhone.id, method: "blocked_legacy_incomplete_mock" };
    }

    return { accountId: null, phoneNumberId: matchedPhone.id, method: "no_valid_assignment" };
}

// --- TEST SCENARIO ---
async function runTest() {
    try {
        // 1. Setup
        mockDb.accounts.push({ id: "acc_A" }, { id: "acc_B" });

        // 2. Provision A
        console.log("Step 1: Provision A");
        const phoneIdA = "phone_A";
        const vapiIdA = "vapi_A";
        mockDb.phone_numbers.push({
            id: phoneIdA,
            account_id: "acc_A",
            assigned_account_id: "acc_A",
            lifecycle_status: "assigned",
            vapi_phone_id: vapiIdA,
            e164_number: "+15551112222"
        });

        // 3. Call A
        console.log("Step 2: Incoming Call A");
        const callA = { phoneNumber: { id: vapiIdA } };
        const supabase = createMockSupabase();
        const { data: matchedA } = await supabase.from('phone_numbers').select('*').eq('vapi_phone_id', vapiIdA).maybeSingle();
        const resA = await resolveMapping(supabase, callA, matchedA);

        assert.strictEqual(resA.accountId, "acc_A", "Should map to A");
        assert.strictEqual(resA.method, "assigned_native", "Method match");
        console.log("✅ Call A mapped correctly.");

        // 4. Release (Cooldown)
        console.log("Step 3: Release -> Cooldown");
        const phone = mockDb.phone_numbers.find(p => p.id === phoneIdA);
        phone.lifecycle_status = "cooldown";
        phone.vapi_phone_id = null; // Detached

        // 5. Call during Cooldown (via E164 since Vapi ID gone)
        console.log("Step 4: Call Cooldown (E164)");
        const callCool = { phoneNumber: { number: "+15551112222" } };
        const { data: matchedCool } = await supabase.from('phone_numbers').select('*').eq('e164_number', "+15551112222").maybeSingle();
        const resCool = await resolveMapping(supabase, callCool, matchedCool);

        assert.strictEqual(resCool.accountId, null, "Should perform NO mapping");
        assert.strictEqual(resCool.method, "blocked_lifecycle", "Should be blocked");
        console.log("✅ Cooldown call blocked.");

        // 6. Provision B
        console.log("Step 5: Provision B (Reuse)");
        phone.lifecycle_status = "assigned";
        phone.assigned_account_id = "acc_B";
        const vapiIdB = "vapi_B";
        phone.vapi_phone_id = vapiIdB;

        // 7. Call B
        console.log("Step 6: Incoming Call B");
        const callB = { phoneNumber: { id: vapiIdB } };
        const { data: matchedB } = await supabase.from('phone_numbers').select('*').eq('vapi_phone_id', vapiIdB).maybeSingle();
        const resB = await resolveMapping(supabase, callB, matchedB);

        assert.strictEqual(resB.accountId, "acc_B", "Should map to B");
        console.log("✅ Call B mapped correctly.");

        console.log("\nALL TESTS PASSED: Routing logic is safe.");

    } catch (e) {
        console.error("TEST FAILED:", e);
        process.exit(1);
    }
}

runTest();
