/**
 * scripts/backfill_calls.ts
 * 
 * Backfills enhanced call data (caller_name, reason, outcome) for recent calls
 * by parsing the raw_payload (or transcript/summary) using the new parser logic.
 * 
 * Usage: deno run --allow-net --allow-env scripts/backfill_calls.ts
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { extractCallDetails, VapiCall, VapiMessage } from "../supabase/functions/vapi-webhook/call_parser.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runBackfill() {
    console.log("Starting backfill for recent calls...");

    // 1. Fetch recent calls that might need backfilling (last 7 days)
    // We check for calls where outcome is null OR outcome is 'other' but might be something else
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data: calls, error } = await supabase
        .from('call_logs')
        .select('*')
        .gte('created_at', weekAgo.toISOString())
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching calls:", error);
        return;
    }

    console.log(`Found ${calls.length} calls to review.`);

    let updatedCount = 0;

    for (const row of calls) {
        let needsUpdate = false;
        let updateData: any = {};

        // Parse raw payload if available
        let vapiCall: VapiCall | null = null;
        let vapiMessage: VapiMessage | null = null;

        if (row.raw_payload) {
            // raw_payload structure varies. Sometimes it's the whole body { message: ... }, sometimes just message.
            const payload = row.raw_payload as any;
            if (payload.message) {
                vapiMessage = payload.message;
                vapiCall = vapiMessage?.call || null;
            } else if (payload.call) {
                // assume it's the message object directly
                vapiMessage = payload;
                vapiCall = payload.call;
            }
        }

        // If no raw payload, reconstruct minimal VapiCall from DB columns for transcript/summary parsing
        if (!vapiCall) {
            vapiCall = {
                transcript: row.transcript,
                analysis: {
                    summary: row.summary,
                    structuredData: {} // we lost structured data if no raw payload
                }
            };
            vapiMessage = { type: 'reconstructed', call: vapiCall };
        }

        // Run Extraction
        if (vapiCall && vapiMessage) {
            const details = extractCallDetails(vapiCall, vapiMessage);

            // Compare and prepare update
            if (!row.caller_name && details.callerName) {
                updateData.caller_name = details.callerName;
                needsUpdate = true;
            }
            if (!row.reason && details.reason) {
                updateData.reason = details.reason;
                needsUpdate = true;
            }
            if (!row.appointment_window && details.appointmentWindow) {
                updateData.appointment_window = details.appointmentWindow;
                needsUpdate = true;
            }
            if (!row.booked && details.booked) {
                updateData.booked = true;
                updateData.outcome = 'booked';
                needsUpdate = true;
            } else if (!row.outcome && details.outcome) {
                updateData.outcome = details.outcome;
                needsUpdate = true;
            }
            // Fix existing "other" outcomes if we found a lead
            if (row.outcome === 'other' && details.outcome === 'lead') {
                updateData.outcome = 'lead';
                updateData.lead_captured = true;
                needsUpdate = true;
            }
        }

        if (needsUpdate) {
            console.log(`Updating call ${row.id} (${row.vapi_call_id}):`, updateData);
            const { error: updateError } = await supabase
                .from('call_logs')
                .update(updateData)
                .eq('id', row.id);

            if (updateError) {
                console.error("Failed to update:", updateError);
            } else {
                updatedCount++;
            }
        }
    }

    console.log(`Backfill complete. Updated ${updatedCount} calls.`);
}

runBackfill();
