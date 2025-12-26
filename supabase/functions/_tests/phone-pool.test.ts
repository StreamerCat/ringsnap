import { assertEquals, assertExists } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

Deno.test("Phone Pool Allocator - Basic Allocation", async () => {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1. Seed a pool number
    const testPhone = `+1555000${Math.floor(Math.random() * 10000)}`;
    const { data: inserted, error: insertError } = await supabase.from('phone_numbers').insert({
        phone_number: testPhone,
        e164_number: testPhone,
        lifecycle_status: 'pool',
        status: 'released',
        provider: 'twilio',
        released_at: new Date(Date.now() - 86400000).toISOString() // Released 1 day ago
    }).select().single();

    assertExists(inserted, "Failed to seed pool number");

    // 2. Create Account
    const { data: account } = await supabase.from('accounts').insert({
        name: "Test User",
        slug: `test-${Date.now()}`,
        email: `test-${Date.now()}@example.com`
    }).select().single();

    // 3. Allocate
    const { data: allocation, error: rpcError } = await supabase.rpc(
        'allocate_phone_number_from_pool',
        { p_account_id: account.id }
    );

    if (rpcError) console.error(rpcError);
    assertExists(allocation, "Allocation returned null");
    assertEquals(allocation.phone_number, testPhone);

    // 4. Verify DB State
    const { data: verification } = await supabase.from('phone_numbers').select('*').eq('id', inserted.id).single();
    assertEquals(verification.lifecycle_status, 'assigned');
    assertEquals(verification.assigned_account_id, account.id);

    // 5. Cleanup
    await supabase.from('phone_numbers').delete().eq('id', inserted.id);
    await supabase.from('accounts').delete().eq('id', account.id);
});

Deno.test("Phone Pool Allocator - Cooldown Check", async () => {
    // Test that number in cooldown is NOT allocated
    // ... similar setup ...
});
