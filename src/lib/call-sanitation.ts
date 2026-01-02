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
 * - Strips introductory phrases like "The user called..." from sentences.
 * - Replaces "AI" with "RingSnap agent".
 * - Limits to max 2 sentences.
 * - Focuses on outcome and next steps.
 */
export function sanitizeCallSummary(text: string | null | undefined): string {
    if (!text) return "";

    let cleaned = text.trim();

    // 1. Replace "AI", "A.I.", "Artificial Intelligence" with "RingSnap agent"
    cleaned = cleaned.replace(/\b(AI|A\.I\.|Artificial Intelligence)\b/gi, "RingSnap agent");

    // 2. Strip intro phrases from the beginning of the text (preserves the rest)
    // e.g., "The user called to book a cleaning and the agent scheduled Tuesday."
    // becomes "Book a cleaning and the agent scheduled Tuesday."
    const introPatterns = [
        /^the (user|caller) called\s+to\s+/i,                    // "The user called to ..."
        /^the (user|caller) called [^.]*?\s+to\s+/i,             // "The user called RingSnap to ..."
        /^the (user|caller) called [^.]*?\.\s*/i,                // "The user called RingSnap."
        /^the ringsnap agent answered the call\.\s*/i,           // "The RingSnap agent answered the call."
        /^(user|caller) called\s+to\s+/i,                        // "Caller called to ..."
    ];
    for (const pattern of introPatterns) {
        cleaned = cleaned.replace(pattern, "");
    }

    // 3. Split into sentences using a lookbehind-free approach for browser compatibility
    // Match sentence-ending punctuation followed by whitespace, then split
    const sentences = cleaned.split(/([.!?])\s+/).reduce((acc: string[], part, i, arr) => {
        // Reconstruct sentences: odd indices are punctuation, combine with previous
        if (i % 2 === 0) {
            const punct = arr[i + 1] || "";
            const sentence = (part + punct).trim();
            if (sentence) acc.push(sentence);
        }
        return acc;
    }, []);

    // 4. Take first 2 meaningful sentences
    let result = sentences.slice(0, 2).join(" ");

    // 5. Capitalize first letter if needed
    if (result.length > 0) {
        result = result.charAt(0).toUpperCase() + result.slice(1);
    }

    return result;
}
