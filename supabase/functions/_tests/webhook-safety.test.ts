
import { assertEquals, assertObjectMatch } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// SIMULATE resolveMapping logic (copied from vapi-webhook/index.ts for independent verification)
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

    // 3. (REMOVED) Metadata Override
    // We strictly rely on DB state. Metadata in 'assistant' might be stale.
    // Legacy fallback (step 4) handles active legacy accounts.

    // 4. Legacy Fallback (Active Account Only)
    if (!matchedPhone.lifecycle_status && matchedPhone.account_id) {
        const acc = matchedPhone.accounts;
        const isActive = acc && (
            ['active', 'trialing', 'past_due'].includes(acc.subscription_status) &&
            acc.account_status !== 'banned'
        );

        if (isActive) {
            return { accountId: matchedPhone.account_id, phoneNumberId: matchedPhone.id, method: "legacy_active_fallback" };
        } else {
            return { accountId: null, phoneNumberId: matchedPhone.id, method: "blocked_legacy_inactive" };
        }
    }

    return { accountId: null, phoneNumberId: matchedPhone.id, method: "no_valid_assignment" };
}

Deno.test("Webhook Hardened: Block Pool Even With Metadata", async () => {
    const matched = { id: "p2", account_id: "a1", lifecycle_status: "cooldown" };
    const call = { assistant: { metadata: { account_id: "a1" } } };

    // Legacy logic would have returned metadata match. New logic MUST block.
    const result = await resolveMapping(null, call, matched);

    assertEquals(result.accountId, null);
    assertEquals(result.method, "blocked_lifecycle");
});

Deno.test("Webhook Hardened: Use Assigned Account ID (Canonical)", async () => {
    // Scenario: account_id column is old 'a1', but assigned_account_id is 'a2'
    const matched = { id: "p1", account_id: "a1", assigned_account_id: "a2", lifecycle_status: "assigned" };
    const call = {};

    const result = await resolveMapping(null, call, matched);

    assertEquals(result.accountId, "a2"); // Must pick a2
    assertEquals(result.method, "assigned_native");
});

Deno.test("Webhook Hardened: Legacy Fallback BLOCKED if Inactive", async () => {
    const matched = {
        id: "p3",
        account_id: "a3",
        lifecycle_status: null,
        accounts: { subscription_status: "canceled", account_status: "active" }
    };
    const call = {};

    const result = await resolveMapping(null, call, matched);

    assertEquals(result.accountId, null); // Blocked because subscription is canceled
    assertEquals(result.method, "blocked_legacy_inactive");
});

Deno.test("Webhook Hardened: Legacy Fallback ALLOWED if Active", async () => {
    const matched = {
        id: "p4",
        account_id: "a4",
        lifecycle_status: null,
        accounts: { subscription_status: "active", account_status: "active" }
    };
    const call = {};

    const result = await resolveMapping(null, call, matched);

    assertEquals(result.accountId, "a4");
    assertEquals(result.method, "legacy_active_fallback");
});
