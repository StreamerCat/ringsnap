/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FUNCTION: vapi-tools-availability
 *
 * PURPOSE: Vapi Tool Handler for checking available appointment slots.
 *          Called by the AI assistant before offering times to callers.
 *
 * TOOL NAME: check_availability
 *
 * INPUT (from Vapi tool call):
 *   date: string (YYYY-MM-DD or natural language like "tomorrow")
 *   timeZone?: string (IANA timezone)
 *   durationMinutes?: number (default: 60)
 *   serviceType?: string (for future service-specific availability)
 *
 * OUTPUT:
 *   Structured response with available slots for Vapi to read to caller.
 *
 * MULTI-TENANT:
 *   Uses assistantId from message.call to resolve account_id.
 *
 * PHASE 1: DB-only availability (excludes existing appointments)
 * PHASE 2: Will add Google Calendar busy times
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { createClient } from "supabase";
import { withSentryEdge } from "../_shared/sentry.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { logInfo, logError, logWarn } from "../_shared/logging.ts";
import { getAvailableSlots, TimeSlot } from "../_shared/availability.ts";

const FUNCTION_NAME = "vapi-tools-availability";
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

// Feature flag for enforcement
const CONFLICT_ENFORCEMENT_ENABLED =
    Deno.env.get("APPOINTMENT_CONFLICT_ENFORCEMENT") !== "false"; // Default ON

Deno.serve(
    withSentryEdge({ functionName: FUNCTION_NAME }, async (req, ctx) => {
        // 1. CORS Preflight
        if (req.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        const { correlationId } = ctx;

        try {
            // 2. Authentication (Shared Secret)
            const authHeader = req.headers.get("x-ringsnap-secret");
            const expectedSecret = Deno.env.get("VAPI_WEBHOOK_SECRET");

            if (expectedSecret && authHeader !== expectedSecret) {
                logError("Unauthorized tool request", {
                    functionName: FUNCTION_NAME,
                    correlationId,
                    context: { error: "Invalid secret" },
                });
                return new Response(JSON.stringify({ error: "Unauthorized" }), {
                    status: 401,
                    headers: jsonHeaders,
                });
            }

            // 3. Parse Request
            const payload = await req.json();
            const message = payload.message;
            const toolCall = payload.toolCall;

            if (!message || !toolCall) {
                throw new Error("Invalid payload: missing message or toolCall");
            }

            const { date, timeZone, durationMinutes, serviceType } =
                toolCall.function.arguments || {};

            if (!date) {
                throw new Error("Missing required argument: date");
            }

            // 4. Resolve Account from Assistant
            const vapiAssistantId = message.call?.assistantId;

            if (!vapiAssistantId) {
                throw new Error("Missing assistantId in call metadata");
            }

            const supabase = createClient(
                Deno.env.get("SUPABASE_URL") ?? "",
                Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
            );

            const { data: assistant, error: assistantError } = await supabase
                .from("vapi_assistants")
                .select("account_id, id")
                .eq("vapi_assistant_id", vapiAssistantId)
                .single();

            if (assistantError || !assistant) {
                logError("Assistant lookup failed", {
                    functionName: FUNCTION_NAME,
                    correlationId,
                    context: { vapiAssistantId },
                });
                throw new Error("Assistant not found");
            }

            const accountId = assistant.account_id;

            // 5. Normalize date input
            let normalizedDate = date;
            if (typeof date === "string") {
                // Handle natural language dates
                const today = new Date();
                const lowerDate = date.toLowerCase().trim();

                if (lowerDate === "today") {
                    normalizedDate = today.toISOString().split("T")[0];
                } else if (lowerDate === "tomorrow") {
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    normalizedDate = tomorrow.toISOString().split("T")[0];
                } else if (lowerDate.match(/^next\s+\w+day$/i)) {
                    // Handle "next monday", "next tuesday", etc.
                    const dayNames = [
                        "sunday",
                        "monday",
                        "tuesday",
                        "wednesday",
                        "thursday",
                        "friday",
                        "saturday",
                    ];
                    const targetDayMatch = lowerDate.match(/next\s+(\w+)/i);
                    if (targetDayMatch) {
                        const targetDayName = targetDayMatch[1].toLowerCase();
                        const targetDayIndex = dayNames.indexOf(targetDayName);
                        if (targetDayIndex >= 0) {
                            const currentDay = today.getDay();
                            let daysUntil = (targetDayIndex - currentDay + 7) % 7;
                            if (daysUntil === 0) daysUntil = 7; // "next" means next week
                            const targetDate = new Date(today);
                            targetDate.setDate(targetDate.getDate() + daysUntil);
                            normalizedDate = targetDate.toISOString().split("T")[0];
                        }
                    }
                } else if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    // Already YYYY-MM-DD format
                    normalizedDate = date;
                } else {
                    // Try to parse various date formats
                    const parsed = new Date(date);
                    if (!isNaN(parsed.getTime())) {
                        normalizedDate = parsed.toISOString().split("T")[0];
                    } else {
                        throw new Error(
                            `Could not parse date: ${date}. Please use YYYY-MM-DD format.`
                        );
                    }
                }
            }

            logInfo("Checking availability", {
                functionName: FUNCTION_NAME,
                correlationId,
                accountId,
                context: {
                    requestedDate: date,
                    normalizedDate,
                    timeZone,
                    durationMinutes,
                    assistantId: vapiAssistantId,
                    enforcementEnabled: CONFLICT_ENFORCEMENT_ENABLED,
                },
            });

            // 6. Get Available Slots
            const result = await getAvailableSlots(
                supabase,
                {
                    accountId,
                    date: normalizedDate,
                    timezone: timeZone,
                    durationMinutes: durationMinutes || 60,
                    serviceType,
                },
                correlationId
            );

            if (!result.success) {
                logError("Failed to get available slots", {
                    functionName: FUNCTION_NAME,
                    correlationId,
                    accountId,
                    context: { error: result.error },
                });

                return new Response(
                    JSON.stringify({
                        results: [
                            {
                                toolCallId: toolCall.id,
                                result:
                                    "I apologize, but I'm having trouble checking availability right now. Let me take your information and someone will call you back to schedule.",
                            },
                        ],
                    }),
                    {
                        headers: jsonHeaders,
                    }
                );
            }

            // 7. Format Response for Vapi
            let responseMessage: string;

            if (result.slots.length === 0) {
                responseMessage = `I don't have any available slots for ${normalizedDate}. Would you like me to check a different day?`;
            } else {
                // Format slots in a natural way for voice
                const slotDescriptions = result.slots.map((slot) => {
                    const startTime = new Date(slot.start);
                    const hours = startTime.getHours();
                    const minutes = startTime.getMinutes();
                    const period = hours >= 12 ? "PM" : "AM";
                    const displayHour = hours % 12 || 12;
                    const displayMinutes =
                        minutes > 0 ? `:${minutes.toString().padStart(2, "0")}` : "";
                    return `${displayHour}${displayMinutes} ${period}`;
                });

                if (slotDescriptions.length === 1) {
                    responseMessage = `I have one opening available at ${slotDescriptions[0]}. Would that work for you?`;
                } else if (slotDescriptions.length <= 3) {
                    const lastSlot = slotDescriptions.pop();
                    responseMessage = `I have openings at ${slotDescriptions.join(", ")} and ${lastSlot}. Which time works best for you?`;
                } else {
                    // Group by morning/afternoon
                    const morning = result.slots.filter((s) => new Date(s.start).getHours() < 12);
                    const afternoon = result.slots.filter((s) => new Date(s.start).getHours() >= 12);

                    if (morning.length > 0 && afternoon.length > 0) {
                        responseMessage = `I have ${morning.length} openings in the morning and ${afternoon.length} in the afternoon. Do you prefer morning or afternoon?`;
                    } else {
                        const first3 = slotDescriptions.slice(0, 3);
                        responseMessage = `I have several openings. The earliest are at ${first3.join(", ")}. Would any of those work, or would you prefer a different time?`;
                    }
                }
            }

            logInfo("Returning availability", {
                functionName: FUNCTION_NAME,
                correlationId,
                accountId,
                context: {
                    slotsReturned: result.slots.length,
                    date: normalizedDate,
                },
            });

            // Return structured response
            return new Response(
                JSON.stringify({
                    results: [
                        {
                            toolCallId: toolCall.id,
                            result: responseMessage,
                            // Include structured data for advanced use
                            data: {
                                availableSlots: result.slots,
                                date: normalizedDate,
                                timezone: result.timezone,
                            },
                        },
                    ],
                }),
                {
                    headers: jsonHeaders,
                }
            );
        } catch (err: any) {
            logError("Availability tool failed", {
                functionName: FUNCTION_NAME,
                correlationId,
                error: err,
            });

            return new Response(
                JSON.stringify({
                    error: "Internal Server Error",
                }),
                { status: 500, headers: jsonHeaders }
            );
        }
    })
);
