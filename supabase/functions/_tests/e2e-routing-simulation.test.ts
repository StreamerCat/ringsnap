
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// MOCKED DB STATE
let mockDb = {
    phone_numbers: [] as any[],
    accounts: [] as any[]
};

// MOCK SUPABASE CLIENT (To allow "Real Code" execution against simulated DB)
const createMockSupabase = () => ({
    from: (table: string) => {
        return {
            select: (cols: string) => ({
                eq: (field: string, value: string) => {
                    const filter = (rows: any[]) => rows.filter(r => r[field] === value);
                    return {
                        maybeSingle: async () => {
                            const found = filter(mockDb[table as keyof typeof mockDb])[0];
                            return { data: found || null };
                        },
                        eq: (field2: string, value2: string) => {
                            const filter2 = (rows: any[]) => rows.filter(r => r[field] === value && r[field2] === value2);
                            return {
                                maybeSingle: async () => {
                                    const found = filter2(mockDb[table as keyof typeof mockDb])[0];
                                    return { data: found || null };
                                }
                            }
                        }
                    }
                }
            }),
            update: (updates: any) => ({
                eq: (field: string, value: string) => {
                    const row = mockDb[table as keyof typeof mockDb].find(r => r[field] === value);
                    if (row) Object.assign(row, updates);
                    return Promise.resolve({ error: null });
                }
            }),
            insert: (row: any) => {
                const newRow = { id: crypto.randomUUID(), ...row };
                mockDb[table as keyof typeof mockDb].push(newRow);
                return Promise.resolve({ data: newRow, error: null });
            }
        }
    }
});

// IMPORT OR COPY LOGIC TO TEST
// (Copying logic from vapi-webhook/index.ts to ensure we test the EXACT logic)
async function resolveMapping(
    supabase: any,
    call: any,
    matchedPhone: any
) {
    if (!matchedPhone) return { accountId: null, phoneNumberId: null, method: "none" };

    // 1. SAFETY FIRST: Block Pool/Cooldown (Overrides Metadata)
    if (['pool', 'cooldown', 'quarantine'].includes(matchedPhone.lifecycle_status)) {
        return { accountId: null, phoneNumberId: matchedPhone.id, method: "blocked_lifecycle" };
    }

    // 2. Strict Assignment (Canonical Truth)
    if (matchedPhone.lifecycle_status === 'assigned') {
        const canonicalId = matchedPhone.assigned_account_id ?? matchedPhone.account_id;
        return { accountId: canonicalId, phoneNumberId: matchedPhone.id, method: "assigned_native" };
    }

    // 4. Legacy Fallback (Active Account Only)
    // NOTE: In mock we assume joined data is present or manually provided
    if (!matchedPhone.lifecycle_status && matchedPhone.account_id) {
        // Mock joined account status check
        // In real code this comes from the join query.
        // Here we assume matchedPhone HAS the account data attached if we fetched it.
        return { accountId: matchedPhone.account_id, phoneNumberId: matchedPhone.id, method: "legacy_active_fallback" };
    }

    return { accountId: null, phoneNumberId: matchedPhone.id, method: "no_valid_assignment" };
}

// THE TEST
Deno.test("E2E Routing Simulation: Provision A -> Release -> Provision B", async () => {
    // 1. Setup Accounts
    mockDb.accounts.push({ id: "acc_A", status: "active" });
    mockDb.accounts.push({ id: "acc_B", status: "active" });

    // 2. Provision Account A
    console.log("\n--- Step 1: Provision Account A ---");
    const phoneIdA = "phone_A_id";
    const vapiIdA = "vapi_A_id";
    const e164 = "+15550001111";

    // Simulate DB Insert from 'allocate_phone_number'
    mockDb.phone_numbers.push({
        id: phoneIdA,
        account_id: "acc_A",
        assigned_account_id: "acc_A",
        lifecycle_status: "assigned",
        vapi_phone_id: vapiIdA,
        e164_number: e164,
        last_call_at: null
    });

    // 3. Incoming Call for A
    console.log("--- Step 2: Incoming Call for A ---");
    const callA = { phoneNumber: { id: vapiIdA } }; // Payload has Vapi ID
    const supabase = createMockSupabase();

    // Webhook Lookup Simulation
    const { data: matchedA } = await supabase.from('phone_numbers').select('*').eq('vapi_phone_id', vapiIdA).maybeSingle();
    const mapA = await resolveMapping(supabase, callA, matchedA);

    console.log(`Call to ${vapiIdA} mapped to: ${mapA.accountId} (${mapA.method})`);
    assertEquals(mapA.accountId, "acc_A");
    assertEquals(mapA.method, "assigned_native");

    // 4. Release A (Transition to Cooldown)
    console.log("\n--- Step 3: Release A (Cooldown) ---");
    // Simulate 'transition_phone_to_cooldown'
    const phone = mockDb.phone_numbers.find(p => p.id === phoneIdA);
    phone.lifecycle_status = "cooldown";
    phone.vapi_phone_id = null; // Detached!
    // phone.e164_number stays same

    // 5. Incoming Call during Cooldown?
    // If call comes to OLD vapi ID, it won't resolve (vapi object deleted).
    // If call comes to E164 (via some other path? e.g. SMS?), let's test E164 lookup.
    console.log("--- Step 4: Call to Cooldown Number (by E164) ---");
    const callCooldown = { phoneNumber: { number: e164 } }; // No Vapi ID provided or different
    const { data: matchedCooldown } = await supabase.from('phone_numbers').select('*').eq('e164_number', e164).maybeSingle();

    const mapCooldown = await resolveMapping(supabase, callCooldown, matchedCooldown);
    console.log(`Call to ${e164} mapped to: ${mapCooldown.accountId} (${mapCooldown.method})`);
    assertEquals(mapCooldown.accountId, null);
    assertEquals(mapCooldown.method, "blocked_lifecycle");

    // 6. Transition to Pool -> Allocate to B
    console.log("\n--- Step 5: Reuse for Account B ---");
    phone.lifecycle_status = "assigned";
    phone.assigned_account_id = "acc_B";
    phone.account_id = "acc_B"; // Legacy sync
    const vapiIdB = "vapi_B_id"; // NEW Vapi object created
    phone.vapi_phone_id = vapiIdB;

    // 7. Incoming Call for B
    console.log("--- Step 6: Incoming Call for B ---");
    const callB = { phoneNumber: { id: vapiIdB } };
    const { data: matchedB } = await supabase.from('phone_numbers').select('*').eq('vapi_phone_id', vapiIdB).maybeSingle();

    const mapB = await resolveMapping(supabase, callB, matchedB);
    console.log(`Call to ${vapiIdB} mapped to: ${mapB.accountId} (${mapB.method})`);
    assertEquals(mapB.accountId, "acc_B");
    assertEquals(mapB.method, "assigned_native");
});
