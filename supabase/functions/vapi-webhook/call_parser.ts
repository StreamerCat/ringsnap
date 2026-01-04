/**
 * call_parser.ts
 * 
 * Logic for extracting rich data from Vapi call payloads.
 * Pure functions only - easy to unit test.
 */

// ==========================================
// Interfaces
// ==========================================

export interface VapiCall {
    id?: string;
    type?: string;
    status?: string;
    startedAt?: string;
    createdAt?: string;
    endedAt?: string;
    durationSeconds?: number;
    phoneNumberId?: string;
    transport?: {
        to?: string;
        from?: string;
    };
    customer?: {
        number?: string;
        name?: string;
    };
    phoneNumber?: {
        id?: string;
        number?: string;
    };
    assistant?: {
        id?: string;
        metadata?: {
            account_id?: string;
        };
    };
    transcript?: string;
    recordingUrl?: string;
    cost?: number;
    analysis?: {
        summary?: string;
        successEvaluation?: boolean | string;
        structuredData?: Record<string, unknown>;
    };
    messages?: Array<{
        role?: string;
        toolCalls?: Array<{
            function?: {
                name?: string;
                arguments?: string;
            };
        }>;
        toolCallResult?: {
            name?: string;
            result?: string;
        };
    }>;
    toolCalls?: Array<{
        name?: string;
        arguments?: Record<string, unknown>;
        result?: unknown;
    }>;
}

export interface VapiMessage {
    type: string;
    call?: VapiCall;
    transcript?: string;
    summary?: string;
    endedAt?: string;
    recordingUrl?: string;
    cost?: number;
}

export type TagSourceType = 'structured' | 'transcript' | 'none';

export interface CallExtractionResult {
    callerName: string | null;
    reason: string | null;
    reasonSource: TagSourceType;
    tagSource: TagSourceType;
    booked: boolean;
    appointmentStart: string | null;
    appointmentEnd: string | null;
    appointmentWindow: string | null;
    outcome: 'booked' | 'lead' | 'other' | null;
    leadCaptured: boolean;
    address: string | null;
}

// ==========================================
// Main Extraction Function
// ==========================================

export function extractCallDetails(call: VapiCall, message: VapiMessage): CallExtractionResult {
    // 1. Normalize Data Sources
    // Priority: Message Analysis > Call Analysis
    const analysis = (message as any).analysis ?? call.analysis;
    const structuredData = analysis?.structuredData ?? {};
    const successEval = analysis?.successEvaluation; // boolean or string "true"

    // Priority: Message Transcript > Call Transcript
    const rawTranscript = message.transcript ?? call.transcript ?? "";
    const transcript = rawTranscript.toLowerCase();
    const summary = (message.summary ?? analysis?.summary ?? "").toLowerCase();

    // Determine if transcript is meaningful (has actual content)
    const hasTranscript = rawTranscript.length >= 50;

    // 2. Extract Fields
    const fromNumber = call.customer?.number ?? call.transport?.from ?? null;
    const callerName = extractCallerName(call, transcript, structuredData, summary, fromNumber);
    const address = extractAddress(structuredData, summary);

    // 3. Extract Reason with Source Tracking
    // Priority: structured > transcript > none (NEVER from summary alone)
    const { reason, reasonSource } = extractReasonWithSource(call, transcript, structuredData, hasTranscript);

    // 4. Determine Tag Source
    // Only allow tagging from structured data or transcript, not summary
    let tagSource: TagSourceType = 'none';
    if (structuredData.reason || structuredData.callReason || structuredData.intent) {
        tagSource = 'structured';
    } else if (hasTranscript) {
        tagSource = 'transcript';
    }
    // If neither, tagSource stays 'none' and frontend should not derive tags

    const { booked, appointmentStart, appointmentEnd, appointmentWindow } = detectBooking(
        call,
        message,
        transcript,
        summary,
        structuredData,
        successEval
    );

    // 5. Determine Outcome
    // Lead Captured if we have Name AND Phone
    const leadCaptured = !!callerName;

    let outcome: 'booked' | 'lead' | 'other' = 'other';
    if (booked) {
        outcome = 'booked';
    } else if (leadCaptured) {
        outcome = 'lead';
    }

    return {
        callerName,
        reason,
        reasonSource,
        tagSource,
        booked,
        appointmentStart,
        appointmentEnd,
        appointmentWindow,
        outcome,
        leadCaptured,
        address
    };
}

/**
 * Extract reason with source tracking
 * NEVER derive reason from summary alone - that causes incorrect auto-tagging
 */
function extractReasonWithSource(
    call: VapiCall,
    transcript: string,
    structuredData: Record<string, any>,
    hasTranscript: boolean
): { reason: string | null; reasonSource: TagSourceType } {
    // 1. Structured Data (Highest Priority)
    if (typeof structuredData.reason === 'string') {
        return { reason: cleanReason(structuredData.reason), reasonSource: 'structured' };
    }
    if (typeof structuredData.callReason === 'string') {
        return { reason: cleanReason(structuredData.callReason), reasonSource: 'structured' };
    }
    if (typeof structuredData.intent === 'string') {
        return { reason: cleanReason(structuredData.intent), reasonSource: 'structured' };
    }

    // 2. Transcript-based extraction (if transcript is available)
    if (hasTranscript) {
        // Look for explicit reason patterns in transcript
        const reasonPatterns = [
            /(?:i'm calling|i am calling|calling) (?:about|for|to|regarding)\s+([^.!?]+)/i,
            /(?:i need|i want|looking for)\s+([^.!?]+)/i,
            /(?:my|the)\s+([^.!?]+)\s+(?:is|are|isn't|aren't|needs|need)/i,
        ];

        for (const pattern of reasonPatterns) {
            const match = transcript.match(pattern);
            if (match && match[1]) {
                const extracted = match[1].trim();
                if (extracted.length > 5 && extracted.length < 100) {
                    return { reason: cleanReason(extracted), reasonSource: 'transcript' };
                }
            }
        }

        // No explicit pattern found, but we have transcript
        // Return null reason but mark source as transcript (tags can still be derived)
        return { reason: null, reasonSource: 'transcript' };
    }

    // 3. No valid source - do not use summary
    return { reason: null, reasonSource: 'none' };
}

// ==========================================
// Helper Functions
// ==========================================

export function extractCallerName(
    call: VapiCall,
    transcript: string,
    structuredData: Record<string, any>,
    summary: string,
    fromNumber: string | null = null
): string | null {
    // 1. Structured Data (Highest Priority)
    if (typeof structuredData.callerName === 'string') return structuredData.callerName;
    if (typeof structuredData.customerName === 'string') return structuredData.customerName;
    if (typeof structuredData.name === 'string') return structuredData.name;

    // 2. Customer Object
    if (call.customer?.name) return call.customer.name;

    // 3. Tool Arguments (e.g. if 'saveContact' tool was called)
    if (call.toolCalls) {
        for (const tc of call.toolCalls) {
            const args = tc.arguments;
            if (args) {
                if (typeof args.customerName === 'string') return args.customerName;
                if (typeof args.name === 'string') return args.name;
            }
        }
    }

    // 4. Transcript Regex Fallback
    // Matches: "my name is John Doe", "this is Jane"
    // Be careful with false positives, stick to strong patterns
    const namePatterns = [
        /my name is ([a-z\s]+?)(?:$|\.|,|and)/i,
        /this is ([a-z\s]+?)(?:$|\.|,|and)/i,
        /speaking with ([a-z\s]+?)(?:$|\.|,|and)/i
    ];

    for (const pattern of namePatterns) {
        const match = transcript.toLowerCase().match(pattern);
        if (match && match[1]) {
            const name = match[1].trim();
            // Filter out common false positives
            if (
                name.length > 2 &&
                name.length < 30 &&
                !name.startsWith('a ') && // "this is a home"
                !name.startsWith('the ') && // "this is the manager"
                !name.includes('to help') &&
                !name.includes('vapi')
            ) {
                return capitalize(name);
            }
        }
    }

    // 5. Summary Extraction (NEW)
    // Matches: "booked for [Name]"
    if (summary) {
        // Look for "booked for [Name]" or "appointment for [Name]"
        // But avoid "booked for tomorrow" or "booked for inspection"
        const summaryPatterns = [
            /booked for ([a-z\s]+?)(?:at|on|for|with|\.|$)/i,
            /appointment for ([a-z\s]+?)(?:at|on|for|with|\.|$)/i
        ];

        for (const pattern of summaryPatterns) {
            const match = summary.match(pattern);
            if (match && match[1]) {
                const name = match[1].trim();
                const lower = name.toLowerCase();
                // Heuristic filtering: name should likely be 2+ words, and not common nouns
                if (
                    name.length > 3 &&
                    name.length < 30 &&
                    !lower.includes('inspection') &&
                    !lower.includes('repair') &&
                    !lower.includes('estimate') &&
                    !lower.includes('tomorrow') &&
                    !lower.includes('today') &&
                    !lower.includes('week') &&
                    // Ensure it looks like a name (no numbers, etc)
                    /^[a-z\s]+$/i.test(name)
                ) {
                    return capitalize(name);
                }
            }
        }
    }

    // 6. Fallback to phone number if no name found
    if (fromNumber) {
        return fromNumber;
    }

    return null;
}

export function extractReason(
    call: VapiCall,
    transcript: string,
    structuredData: Record<string, any>,
    summary: string
): string | null {
    // 1. Structured Data
    if (typeof structuredData.reason === 'string') return cleanReason(structuredData.reason);
    if (typeof structuredData.callReason === 'string') return cleanReason(structuredData.callReason);
    if (typeof structuredData.intent === 'string') return cleanReason(structuredData.intent);

    // 2. Summary Heuristic
    // Often the summary starts with "The user called to..."
    if (summary) {
        let cleaned = cleanReason(summary);
        // If summary is short, use it entirely
        if (cleaned.length < 150) return cleaned;
        // Otherwise try to extract the first sentence
        const firstSentence = cleaned.split('.')[0];
        if (firstSentence.length > 10) return firstSentence;
    }

    return null;
}


export function detectBooking(
    call: VapiCall,
    message: VapiMessage,
    transcript: string,
    summary: string,
    structuredData: Record<string, any>,
    successEval: boolean | string | undefined
): { booked: boolean, appointmentStart: string | null, appointmentEnd: string | null, appointmentWindow: string | null } {

    // ==================================================
    // PRIORITY 1: Structured Output
    // ==================================================
    if (structuredData.booked === true || structuredData.appointmentBooked === true) {
        return {
            booked: true,
            appointmentStart: asString(structuredData.appointmentStart),
            appointmentEnd: asString(structuredData.appointmentEnd),
            appointmentWindow: asString(structuredData.appointmentWindow)
                ?? (asString(structuredData.appointmentTime) && !isIsoDate(asString(structuredData.appointmentTime)) ? asString(structuredData.appointmentTime) : null)
        };
    }

    // ==================================================
    // PRIORITY 2: Tool Call Success
    // ==================================================
    // Check main call tool calls
    if (call.toolCalls) {
        for (const tc of call.toolCalls) {
            if (isBookingTool(tc.name)) {
                // If the tool returned success
                if (isToolSuccess(tc.result)) {
                    const args = tc.arguments ?? {};
                    return {
                        booked: true,
                        // If tool args have ISO times, use them. If they have text, maybe put in window.
                        appointmentStart: asString(args.startTime),
                        appointmentEnd: asString(args.endTime),
                        appointmentWindow: null // assume tools use specific times usually
                    };
                }
            }
        }
    }
    // Check message history tool calls (sometimes newer Vapi format puts them here)
    if (call.messages) {
        for (const msg of call.messages) {
            if (msg.toolCallResult) {
                if (isBookingTool(msg.toolCallResult.name)) {
                    const result = parseToolResult(msg.toolCallResult.result);
                    if (isToolSuccess(result)) {
                        return { booked: true, appointmentStart: null, appointmentEnd: null, appointmentWindow: null };
                    }
                }
            }
        }
    }

    // ==================================================
    // PRIORITY 3: Success Eval + Confirmation Phrases
    // ==================================================
    const isSuccess = successEval === true || successEval === 'true';

    // Strong booking phrases in transcript
    const bookingPhrases = [
        "you're all set for",
        "you remain all set for",
        "i have you down for",
        "scheduled for",
        "booked for",
        "see you on",
        "see you then"
    ];

    const hasBookingPhrase = bookingPhrases.some(phrase => transcript.includes(phrase));
    const summaryIndicatesBooking = summary.includes("book") || summary.includes("schedul") || summary.includes("appointment");

    if ((isSuccess && summaryIndicatesBooking) || hasBookingPhrase) {
        // Try to capture window from transcript
        // Logic: "You're all set for Wednesday afternoon" -> capture "Wednesday afternoon"
        let window: string | null = null;
        for (const phrase of bookingPhrases) {
            const regex = new RegExp(`${phrase}\\s+([a-zA-Z0-9\\s]+?)(?:\\.|$)`, 'i');
            const match = transcript.match(regex);
            if (match && match[1]) {
                window = match[1].trim();
                break;
            }
        }

        return {
            booked: true,
            appointmentStart: null,
            appointmentEnd: null,
            appointmentWindow: window ?? "Booked (Time not parsed)"
        };
    }

    return { booked: false, appointmentStart: null, appointmentEnd: null, appointmentWindow: null };
}

// --------------------------------------------------------------------------
// Utilities
// --------------------------------------------------------------------------

function asString(val: unknown): string | null {
    if (typeof val === 'string') return val;
    return null;
}

function isIsoDate(str: string | null): boolean {
    if (!str) return false;
    // Simple check for ISO-like structure (YYYY-MM-DD...)
    return /^\d{4}-\d{2}-\d{2}T/.test(str);
}

function capitalize(str: string): string {
    return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function isBookingTool(name?: string): boolean {
    if (!name) return false;
    const n = name.toLowerCase();
    return n.includes('schedule') || n.includes('book') || n.includes('appointment') || n.includes('calendar');
}

function isToolSuccess(result: unknown): boolean {
    if (!result) return false;
    if (typeof result === 'object' && (result as any).success === true) return true;
    return false;
}

function parseToolResult(resultStr?: string): any {
    if (!resultStr) return {};
    try {
        return JSON.parse(resultStr);
    } catch {
        return {};
    }
}

/**
 * Clean up reason text by removing company names, assistant references, and common prefixes
 */
function cleanReason(text: string): string {
    let cleaned = text.trim();

    // Remove common prefixes (case-insensitive)
    cleaned = cleaned.replace(/^(the user called|the caller called|caller called|user called)\s+/i, '');

    // Remove company/assistant name patterns like "rs support" or "[company] support"
    // Match pattern: "[word(s)] support/assistant/service" followed by "to"
    cleaned = cleaned.replace(/^[a-z\s]+?\s+(support|assistant|service|team)\s+to\s+/i, '');

    // Capitalize first letter
    if (cleaned.length > 0) {
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    return cleaned;
}

export function extractAddress(structuredData: Record<string, any>, summary: string): string | null {
    if (typeof structuredData.address === 'string') return structuredData.address;

    // Fallback: Summary
    // "at 7707 West Main Street"
    if (summary) {
        // Look for "at [Address]" pattern
        // Matches number followed by words ending in common street suffixes
        const addressPattern = /\bat\s+(\d+\s+[A-Za-z0-9\s,]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Way|Blvd|Boulevard|Court|Ct|Circle|Cir))/i;
        const match = summary.match(addressPattern);
        if (match && match[1]) {
            // Basic cleanup: remove trailing punctuation
            return match[1].trim().replace(/[\.,]$/, '');
        }
    }
    return null;
}
