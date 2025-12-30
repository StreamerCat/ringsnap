#!/usr/bin/env node

/**
 * Backfill Appointments from Booked Call Logs
 * 
 * This script scans call_logs for booked calls (outcome='booked' OR booked=true)
 * and creates corresponding appointments entries for any that don't already exist.
 * 
 * Features:
 * - Idempotent: Uses call_log_id to prevent duplicate appointments
 * - Dry run mode: Reports what would be created without making changes
 * - Account filtering: Can target specific accounts or all
 * - Logging: Outputs detailed JSON logs for each action
 * 
 * Usage:
 *   # Dry run (default)
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill-appointments.mjs
 * 
 *   # Execute for real
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... EXECUTE=true node scripts/backfill-appointments.mjs
 * 
 *   # Specific account only
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ACCOUNT_ID=... node scripts/backfill-appointments.mjs
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EXECUTE = process.env.EXECUTE === "true";
const TARGET_ACCOUNT_ID = process.env.ACCOUNT_ID || null;
const BATCH_SIZE = 100;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log(JSON.stringify({
        event: "backfill_started",
        mode: EXECUTE ? "EXECUTE" : "DRY_RUN",
        targetAccount: TARGET_ACCOUNT_ID || "all",
        batchSize: BATCH_SIZE
    }));

    // Step 1: Find booked call_logs that don't have a linked appointment
    let query = supabase
        .from("call_logs")
        .select("id, account_id, caller_name, from_number, summary, appointment_start, appointment_window, address, outcome, booked, created_at")
        .or("outcome.eq.booked,booked.eq.true");

    if (TARGET_ACCOUNT_ID) {
        query = query.eq("account_id", TARGET_ACCOUNT_ID);
    }

    query = query.order("created_at", { ascending: false }).limit(BATCH_SIZE * 10);

    const { data: bookedCalls, error: callsError } = await query;

    if (callsError) {
        console.error(JSON.stringify({ event: "error_fetching_calls", error: callsError.message }));
        process.exit(1);
    }

    console.log(JSON.stringify({ event: "found_booked_calls", count: bookedCalls?.length || 0 }));

    if (!bookedCalls || bookedCalls.length === 0) {
        console.log(JSON.stringify({ event: "backfill_complete", created: 0, skipped: 0, message: "No booked calls found" }));
        return;
    }

    // Step 2: Check which call_logs already have appointments
    const callLogIds = bookedCalls.map(c => c.id);

    const { data: existingAppointments, error: aptError } = await supabase
        .from("appointments")
        .select("call_log_id")
        .in("call_log_id", callLogIds);

    if (aptError) {
        // Column might not exist yet - that's OK, we'll try to create all
        console.warn(JSON.stringify({ event: "warning_checking_appointments", error: aptError.message }));
    }

    const existingCallLogIds = new Set((existingAppointments || []).map(a => a.call_log_id));

    // Step 3: Filter to calls that need appointments
    const callsNeedingAppointments = bookedCalls.filter(c => !existingCallLogIds.has(c.id));

    console.log(JSON.stringify({
        event: "analysis_complete",
        totalBooked: bookedCalls.length,
        alreadyHaveAppointments: existingCallLogIds.size,
        needingAppointments: callsNeedingAppointments.length
    }));

    if (callsNeedingAppointments.length === 0) {
        console.log(JSON.stringify({ event: "backfill_complete", created: 0, skipped: bookedCalls.length, message: "All booked calls already have appointments" }));
        return;
    }

    // Step 4: Create appointments
    let created = 0;
    let failed = 0;

    for (const call of callsNeedingAppointments) {
        // Build appointment data
        const appointmentData = {
            account_id: call.account_id,
            call_log_id: call.id,
            caller_name: call.caller_name || "Unknown Caller",
            caller_phone: call.from_number,
            scheduled_start_at: call.appointment_start || getDefaultStartTime(call.created_at),
            window_description: call.appointment_window,
            status: "scheduled",
            notes: call.summary,
            address: call.address,
            source: "backfill"
        };

        console.log(JSON.stringify({
            event: EXECUTE ? "creating_appointment" : "would_create_appointment",
            callLogId: call.id,
            accountId: call.account_id,
            scheduledFor: appointmentData.scheduled_start_at,
            callerName: appointmentData.caller_name
        }));

        if (EXECUTE) {
            try {
                const { error: insertError } = await supabase
                    .from("appointments")
                    .insert(appointmentData);

                if (insertError) {
                    // Try without problematic columns
                    const safeData = { ...appointmentData };
                    delete safeData.address;
                    delete safeData.window_description;
                    delete safeData.source;

                    const { error: retryError } = await supabase
                        .from("appointments")
                        .insert(safeData);

                    if (retryError) {
                        console.error(JSON.stringify({
                            event: "insert_failed",
                            callLogId: call.id,
                            error: retryError.message
                        }));
                        failed++;
                    } else {
                        created++;
                    }
                } else {
                    created++;
                }
            } catch (e) {
                console.error(JSON.stringify({ event: "exception", callLogId: call.id, error: String(e) }));
                failed++;
            }
        } else {
            created++; // Count as "would create" in dry run
        }
    }

    console.log(JSON.stringify({
        event: "backfill_complete",
        mode: EXECUTE ? "EXECUTE" : "DRY_RUN",
        created: created,
        failed: failed,
        skippedAlreadyExist: existingCallLogIds.size,
        totalProcessed: callsNeedingAppointments.length
    }));
}

function getDefaultStartTime(callCreatedAt) {
    // Default: Next day 9am from when the call was made
    const callDate = new Date(callCreatedAt);
    const nextDay = new Date(callDate);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(9, 0, 0, 0);
    return nextDay.toISOString();
}

main().catch(e => {
    console.error(JSON.stringify({ event: "fatal_error", error: String(e) }));
    process.exit(1);
});
