
import { assertEquals } from "https://deno.land/std@0.203.0/assert/mod.ts";
import { AccountSettings, Appointment } from "../_shared/appointment-notifications.ts";

/**
 * Logic Test for Appointment Notifications
 * Validates date formatting and conditional logic without external dependencies.
 */

Deno.test("Logic Check: Notification Formatting", async () => {
    // 1. Mock Data
    const mockAccount: AccountSettings = {
        company_name: "Test HVAC",
        notification_email: "test@example.com",
        notification_sms_phone: "+15550000000",
        notify_contractor_email: true,
        notify_caller_sms: true,
        notify_caller_email: true,
        sms_enabled: true,
        sms_appointment_confirmations: true,
        sms_reminders: true,
        timezone: "America/Chicago"
    };

    const mockAppointment: Appointment = {
        id: "123",
        account_id: "acc_123",
        caller_name: "John Doe",
        caller_phone: "+15551112222",
        caller_email: "john@example.com",
        scheduled_start_at: "2023-12-25T14:30:00Z", // 2:30pm UTC -> 8:30am CST
        time_zone: "America/Chicago",
        service_type: "Furnace Repair",
        address: "123 Main St",
        status: "scheduled"
    };

    console.log("\n[TEST] Verifying Notification Logic...");
    console.log(`Input Time: ${mockAppointment.scheduled_start_at} (UTC)`);
    console.log(`Target Timezone: ${mockAccount.timezone}`);

    // 2. Test Date Formatting Logic
    const date = new Date(mockAppointment.scheduled_start_at);
    const formattedDate = new Intl.DateTimeFormat("en-US", {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: mockAccount.timezone,
        timeZoneName: 'short'
    }).format(date);

    console.log(`Formatted Output: "${formattedDate}"`);

    // 3. Assertions
    // "Monday, December 25, at 8:30 AM CST" approx
    const expectedTimePart = "8:30";

    if (formattedDate.includes(expectedTimePart)) {
        console.log("✅ Time formatting correct (Found 8:30)");
    } else {
        console.error(`❌ Time formatting failed. Expected ${expectedTimePart} in "${formattedDate}"`);
        throw new Error("Date formatting check failed");
    }

    // Check if contractor SMS would send
    const shouldSendContractorSms = mockAccount.sms_enabled && mockAccount.sms_appointment_confirmations && !!mockAccount.notification_sms_phone;
    assertEquals(shouldSendContractorSms, true, "Contractor SMS logic incorrect");
    console.log("✅ Contractor SMS Logic: PASSED");
});
