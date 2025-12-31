/**
 * Utility for sanitizing and formatting call log reason and summary text.
 * This is applied at the UI layer to ensure consistent, concise, and useful copy
 * for both existing and new call logs.
 */

/**
 * Sanitizes the "Reason for Call" field.
 * - Removes common prefixes like "the user called [Business] to " or "caller called to ".
 * - Replaces AI mentions with "RingSnap".
 * - Limits length to roughly 6-12 words.
 */
export function sanitizeCallReason(text: string | null | undefined): string {
    if (!text) return "";

    let cleaned = text.trim();

    // 1. Remove common prefixes like "The user called [Business] to " or "Caller called to "
    // We use a more specific regex for the prefix to avoid stripping "Talk to" etc.
    const prefixRegex = /^(the user called|the caller called|caller called|user called).*?\s+to\s+/i;
    const match = cleaned.match(prefixRegex);

    if (match) {
        cleaned = cleaned.substring(match[0].length);
    } else {
        // If no " to ", still try to strip basic "The user called " prefix
        cleaned = cleaned.replace(/^(the user called|the caller called|caller called|user called)\s+/i, "");
    }

    // 2. Replace "AI", "A.I.", "Artificial Intelligence" with "RingSnap"
    cleaned = cleaned.replace(/\b(AI|A\.I\.|Artificial Intelligence)\b/gi, "RingSnap");

    // 3. Cleanup trailing punctuation and capitalize
    cleaned = cleaned.replace(/[.!?]+$/, "");
    if (cleaned.length > 0) {
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    // 4. Trim to a short phrase (approx 6-12 words)
    const words = cleaned.split(/\s+/);
    if (words.length > 12) {
        cleaned = words.slice(0, 12).join(" ") + "...";
    }

    return cleaned;
}

/**
 * Sanitizes the "Call Summary" field.
 * - Removes introductory sentences about who called whom.
 * - Replaces "AI" with "RingSnap agent".
 * - Limits to max 2 sentences.
 * - Focuses on outcome and next steps.
 */
export function sanitizeCallSummary(text: string | null | undefined): string {
    if (!text) return "";

    let cleaned = text.trim();

    // 1. Replace "AI", "A.I.", "Artificial Intelligence" with "RingSnap agent"
    cleaned = cleaned.replace(/\b(AI|A\.I\.|Artificial Intelligence)\b/gi, "RingSnap agent");

    // 2. Split into sentences
    const sentences = cleaned.split(/(?<=[.!?])\s+/);

    // 3. Filter out introductory sentences like "The user called [Business]."
    // or "The RingSnap agent answered the call."
    const filteredSentences = sentences.filter(s => {
        const lowerS = s.toLowerCase();
        const isIntro =
            lowerS.includes("user called") ||
            lowerS.includes("caller called") ||
            (lowerS.includes("ringsnap agent answered") && lowerS.length < 50);
        return !isIntro;
    });

    // 4. Take first 2 meaningful sentences
    let result = filteredSentences.slice(0, 2).join(" ");

    // 5. Ensure it's not too long but informative
    if (result.length > 250) {
        // If still very long, we might need more aggressive truncation, but 2 sentences is usually okay.
    }

    return result;
}
