/**
 * detect-test-call-alert Edge Function
 * 
 * Runs on a schedule (every 10-15 minutes) to detect accounts that:
 * - Were created in the last 24 hours
 * - Have an active primary phone number
 * - Have NOT completed a test call
 * - Were activated more than 30-60 minutes ago
 * 
 * Rate limits alerts to one per account per type via system_events.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logInfo, logWarn, extractCorrelationId } from "../_shared/logging.ts";
import * as Sentry from "https://deno.land/x/sentry@8.33.1/index.mjs";

const FUNCTION_NAME = "detect-test-call-alert";
const ALERT_EVENT_NAME = "onboarding.alert.test_call_missing";
const ACCOUNT_AGE_HOURS = 24;
const ACTIVATION_THRESHOLD_MINUTES = 45; // Alert after 45 min without test call

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    const correlationId = extractCorrelationId(req);
    const baseLogOptions = { functionName: FUNCTION_NAME, correlationId };

    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

        logInfo("Starting test call detection sweep", baseLogOptions);

        // Calculate time boundaries
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - ACCOUNT_AGE_HOURS * 60 * 60 * 1000);
        const activationThreshold = new Date(now.getTime() - ACTIVATION_THRESHOLD_MINUTES * 60 * 1000);

        // Find accounts that need alerting
        // 1. Created in last 24h
        // 2. Have active primary phone number
        // 3. No test call detected (via call_logs join on phone_number_id)
        // 4. Not already alerted (via system_events)
        const { data: candidateAccounts, error: queryError } = await supabase
            .from("accounts")
            .select(`
        id,
        company_name,
        created_at,
        provisioning_status,
        phone_numbers!inner(id, phone_number, is_primary, status, activated_at),
        system_events(id, event_name)
      `)
            .gte("created_at", twentyFourHoursAgo.toISOString())
            .eq("provisioning_status", "completed")
            .eq("phone_numbers.is_primary", true)
            .eq("phone_numbers.status", "active");

        if (queryError) {
            throw new Error(`Query error: ${queryError.message}`);
        }

        logInfo(`Found ${candidateAccounts?.length || 0} candidate accounts`, baseLogOptions);

        let alertsSent = 0;
        const alertedAccounts: string[] = [];

        for (const account of candidateAccounts || []) {
            const primaryPhone = account.phone_numbers?.[0];
            if (!primaryPhone?.id) continue;

            // Check if already alerted
            const hasAlert = account.system_events?.some(
                (e: any) => e.event_name === ALERT_EVENT_NAME
            );
            if (hasAlert) continue;

            // Check activation time threshold (if activated_at exists)
            if (primaryPhone.activated_at) {
                const activatedAt = new Date(primaryPhone.activated_at);
                if (activatedAt > activationThreshold) {
                    // Activated recently, give more time
                    continue;
                }
            }

            // Check for test call via call_logs
            const { data: testCalls, error: callError } = await supabase
                .from("call_logs")
                .select("id")
                .eq("phone_number_id", primaryPhone.id)
                .eq("direction", "inbound")
                .gte("duration_seconds", 10)
                .limit(1);

            if (callError) {
                logWarn(`Error checking call logs for account ${account.id}`, {
                    ...baseLogOptions,
                    error: callError.message,
                });
                continue;
            }

            // If test call exists, skip
            if (testCalls && testCalls.length > 0) {
                continue;
            }

            // No test call detected - send alert
            logWarn(`Test call missing for account ${account.id}`, {
                ...baseLogOptions,
                context: {
                    accountId: account.id,
                    companyName: account.company_name,
                    phoneNumberId: primaryPhone.id,
                },
            });

            // Insert alert event (rate limiting via system_events)
            const { error: insertError } = await supabase.from("system_events").insert({
                event_name: ALERT_EVENT_NAME,
                level: "warn",
                account_id: account.id,
                metadata: {
                    phone_number_id: primaryPhone.id,
                    phone_number: primaryPhone.phone_number,
                    account_age_hours: Math.round(
                        (now.getTime() - new Date(account.created_at).getTime()) / (60 * 60 * 1000)
                    ),
                },
            });

            if (insertError) {
                logWarn(`Failed to insert alert event for ${account.id}`, {
                    ...baseLogOptions,
                    error: insertError.message,
                });
                continue;
            }

            alertsSent++;
            alertedAccounts.push(account.id);

            // Report to Sentry
            Sentry.captureMessage(`Test call missing for account ${account.id}`, {
                level: "warning",
                tags: { function: FUNCTION_NAME },
                extra: {
                    accountId: account.id,
                    companyName: account.company_name,
                    phoneNumber: primaryPhone.phone_number,
                },
            });
        }

        logInfo(`Test call detection complete`, {
            ...baseLogOptions,
            context: {
                candidatesChecked: candidateAccounts?.length || 0,
                alertsSent,
                alertedAccounts,
            },
        });

        return new Response(
            JSON.stringify({
                success: true,
                candidatesChecked: candidateAccounts?.length || 0,
                alertsSent,
                alertedAccounts,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logWarn(`Detection sweep failed: ${errorMessage}`, baseLogOptions);

        Sentry.captureException(error, {
            tags: { function: FUNCTION_NAME },
        });

        return new Response(
            JSON.stringify({ error: errorMessage }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
