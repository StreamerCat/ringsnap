/**
 * Call Text Utilities
 * 
 * Comprehensive utilities for sanitizing call text, deriving topics,
 * outcomes, and actionable next steps. Applied at UI layer to ensure
 * consistent display for all call logs (existing and new).
 */

import { type CallLog as BaseCallLog, calculateLeadScore, getLeadScoreLabel } from './leadScore';
import { type CallLogWithAppointment, isBookedCall, hasStructuredAppointment, hasBookingIntent } from './appointments';

// ============================================================================
// TYPES
// ============================================================================

export interface SanitizeOptions {
    companyName?: string;
}

export interface TopicDerivationInput {
    reason?: string | null;
    summary?: string | null;
    transcript?: string | null;
    trade?: string | null;
    companyName?: string | null;
}

export interface OutcomeInput {
    call: CallLogWithAppointment;
    hasAppointment?: boolean;
    appointmentStart?: string | null;
}

export type CallOutcome = 'Booked' | 'Follow-up' | 'Info-only' | 'Missed';

// ============================================================================
// SERVICE AND INTENT PHRASE MAPPING (word-boundary safe)
// ============================================================================

/**
 * Service phrases - what the caller asked about.
 * Each phrase is matched with word boundaries to prevent substring issues.
 * E.g., "ac" must match as a full word, not inside "callback".
 */
const SERVICE_PHRASES: Record<string, string[]> = {
    'EV charger installation': ['ev charger', 'ev charging', 'electric vehicle charger', 'car charger', 'tesla charger'],
    'Water heater': ['water heater', 'hot water', 'tankless', 'water tank'],
    'Drain cleaning': ['drain cleaning', 'clogged drain', 'backed up drain', 'slow drain'],
    'Plumbing repair': ['plumbing repair', 'leaky pipe', 'leaky faucet', 'leaking pipe', 'leaking faucet', 'toilet repair'],
    'AC repair': ['air conditioning', 'air conditioner', 'hvac repair', 'cooling system'],  // Note: "ac" handled separately
    'Heating repair': ['furnace repair', 'heater repair', 'heating system', 'heat pump', 'boiler repair'],
    'Electrical': ['electrical work', 'electrical repair', 'outlet repair', 'panel upgrade', 'breaker'],
    'Lighting install': ['lighting installation', 'light fixture', 'chandelier', 'recessed light', 'recessed lighting'],
    'Roofing': ['roof repair', 'roofing', 'shingle', 'gutter'],
    'Generator': ['generator', 'standby power', 'backup power'],
};

/**
 * Intent phrases - what the caller wants to do.
 */
const INTENT_PHRASES: Record<string, string[]> = {
    'Callback requested': ['call back', 'callback', 'call me back', 'return my call', 'please call'],
    'Estimate requested': ['estimate', 'quote', 'pricing', 'how much', 'cost'],
    'Scheduling': ['schedule', 'appointment', 'book', 'available', 'availability'],
    'Emergency': ['emergency', 'urgent', 'asap', 'right away', 'immediately'],
    'Consultation': ['consultation', 'consult', 'advice', 'assessment'],
    'General inquiry': ['question', 'information', 'wondering', 'inquiry'],
};

/**
 * Phrases that indicate we should ignore the clause (service list, not caller request).
 */
const IGNORE_AFTER_PHRASES = ['which include', 'including', 'we offer', 'our services', 'services include'];

// Common business name suffixes to strip
const BUSINESS_SUFFIXES = ['inc', 'llc', 'co', 'company', 'corp', 'corporation', 'services', 'service', 'plumbing', 'hvac', 'electric', 'electrical', 'roofing'];

// ============================================================================
// TEXT NORMALIZATION HELPERS
// ============================================================================

/**
 * Normalize text for comparison: lowercase, remove punctuation, collapse whitespace.
 */
function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Tokenize normalized text into words.
 */
function tokenize(text: string): string[] {
    return normalizeText(text).split(' ').filter(Boolean);
}

/**
 * Calculate token overlap ratio between two token sets.
 */
function tokenOverlap(tokens1: string[], tokens2: string[]): number {
    if (tokens1.length === 0 || tokens2.length === 0) return 0;
    const set1 = new Set(tokens1);
    const matches = tokens2.filter(t => set1.has(t)).length;
    return matches / Math.min(tokens1.length, tokens2.length);
}

// ============================================================================
// SANITIZE CALL TEXT (3-LAYER)
// ============================================================================

/**
 * Sanitizes call text with 3-layer approach:
 * 1. Pattern removal for narrative prefixes
 * 2. Fuzzy company name scrubber
 * 3. Final guardrail to ensure no company name tokens remain
 */
export function sanitizeCallText(text: string | null | undefined, options: SanitizeOptions = {}): string {
    if (!text) return '';

    let cleaned = text.trim();
    const { companyName } = options;

    // -------------------------------------------------------------------------
    // Layer 1: Pattern removal for narrative prefixes
    // -------------------------------------------------------------------------

    // Pattern: "\{person\} called \{business\} to/about ..."
    // Remove everything from start up to and including "to " or "about "
    const prefixPatterns = [
        // Standard user/caller patterns
        /^the (user|caller) called\s+.*?\s+(to|about)\s+/i,
        /^(user|caller) called\s+.*?\s+(to|about)\s+/i,
        /^the (user|caller) called\s+/i,
        /^(user|caller) called\s+/i,
        /^called\s+.*?\s+(to|about)\s+/i,
        // Person name patterns: "Mark called Apple Plumb to inquire..."
        /^\w+\s+called\s+.*?\s+(to|about)\s+/i,
        // Customer patterns
        /^(customer|client|person)\s+called\s+.*?\s+(to|about)\s+/i,
        /^a\s+(customer|client|person)\s+called\s+.*?\s+(to|about)\s+/i,
    ];

    for (const pattern of prefixPatterns) {
        const match = cleaned.match(pattern);
        if (match) {
            cleaned = cleaned.substring(match[0].length);
            break;
        }
    }

    // -------------------------------------------------------------------------
    // Layer 2: Fuzzy company name scrubber
    // -------------------------------------------------------------------------

    if (companyName) {
        // Get company name tokens (without common suffixes)
        const companyTokens = tokenize(companyName).filter(t => !BUSINESS_SUFFIXES.includes(t));

        if (companyTokens.length > 0) {
            // Split text into words and check for company name token sequences
            const words = cleaned.split(/\s+/);
            const filteredWords: string[] = [];
            let i = 0;

            while (i < words.length) {
                // Check if the next N words match company tokens
                let matchLength = 0;
                for (let len = Math.min(companyTokens.length + 1, words.length - i); len >= 1; len--) {
                    const candidateTokens = tokenize(words.slice(i, i + len).join(' '));
                    const overlap = tokenOverlap(companyTokens, candidateTokens);

                    // High overlap threshold for fuzzy matching
                    if (overlap >= 0.6 && candidateTokens.length >= 1) {
                        matchLength = len;
                        break;
                    }
                }

                if (matchLength > 0) {
                    // Skip these words (company name match)
                    i += matchLength;
                } else {
                    filteredWords.push(words[i]);
                    i++;
                }
            }

            cleaned = filteredWords.join(' ');
        }
    }

    // Also remove phrase between "called" and "to/about" if it still exists
    cleaned = cleaned.replace(/called\s+[\w\s]+?\s+(to|about)\s+/gi, '');

    // -------------------------------------------------------------------------
    // Layer 3: AI replacement, phrasing cleanup, and final polish
    // -------------------------------------------------------------------------

    // Replace AI mentions (handle A.I. separately due to punctuation)
    cleaned = cleaned.replace(/A\.I\./g, 'RingSnap agent');
    cleaned = cleaned.replace(/\b(AI|Artificial Intelligence)\b/gi, 'RingSnap agent');

    // Replace awkward phrasing
    cleaned = cleaned.replace(/\binquire(?:d)? about\b/gi, 'asked about');
    cleaned = cleaned.replace(/\binquir(?:e|ing) about\b/gi, 'asking about');
    cleaned = cleaned.replace(/\bto inquire\b/gi, 'asking');

    // Remove residual "{company} to" patterns that might have survived
    if (companyName) {
        const companyTokens = tokenize(companyName).filter(t => t.length > 2);
        for (const token of companyTokens) {
            // Pattern: "token to inquire/ask/call" or "token to get"
            cleaned = cleaned.replace(new RegExp(`\\b${token}\\s+to\\s+`, 'gi'), '');
        }
    }

    // Clean up leading/trailing punctuation and whitespace
    cleaned = cleaned.replace(/^[\s,.:;-]+/, '').replace(/[\s,.:;-]+$/, '');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // Capitalize first letter
    if (cleaned.length > 0) {
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    // -------------------------------------------------------------------------
    // Final guardrail: Check company name tokens not present
    // -------------------------------------------------------------------------

    if (companyName && process.env.NODE_ENV === 'development') {
        const companyTokens = tokenize(companyName).filter(t => !BUSINESS_SUFFIXES.includes(t) && t.length > 2);
        const outputTokens = tokenize(cleaned);
        const overlap = tokenOverlap(companyTokens, outputTokens);
        if (overlap > 0.5) {
            console.warn(`[sanitizeCallText] Company name may still be present: "${cleaned}"`);
        }
    }

    return cleaned;
}

// ============================================================================
// TOPIC DERIVATION (Word-Boundary Safe)
// ============================================================================

/**
 * Check if a phrase exists in text using word boundaries.
 * Prevents "callback" from matching "ac".
 */
function matchPhrase(text: string, phrase: string): boolean {
    // Escape special regex chars in phrase
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Special handling for "ac" and "a/c" - must be word boundary
    if (phrase === 'ac' || phrase === 'a/c') {
        const pattern = new RegExp(`\\b${escaped}\\b`, 'i');
        return pattern.test(text);
    }
    // For multi-word phrases, use word boundary at start/end
    const pattern = new RegExp(`\\b${escaped}\\b`, 'i');
    return pattern.test(text);
}

/**
 * Extract caller-intent sentences from text.
 * Filters out service list sentences (after "which include", "we offer", etc.)
 */
function extractCallerIntentText(text: string): string {
    const sentences = text.split(/[.!?]+/).filter(Boolean);
    const callerIntentPatterns = [
        /\b(need|want|looking for|interested in)\b/i,
        /\b(request|asked|inquire|enquire)\b/i,
        /\b(call back|callback|call me)\b/i,
        /\b(estimate|quote|price)\b/i,
        /\b(schedule|book|appointment)\b/i,
    ];

    const relevantSentences: string[] = [];

    for (const sentence of sentences) {
        const trimmed = sentence.trim().toLowerCase();

        // Skip sentences that list services (assistant's services, not caller's request)
        let skipSentence = false;
        for (const ignorePhrase of IGNORE_AFTER_PHRASES) {
            if (trimmed.includes(ignorePhrase)) {
                skipSentence = true;
                break;
            }
        }
        if (skipSentence) continue;

        // Include sentences that match caller intent patterns
        for (const pattern of callerIntentPatterns) {
            if (pattern.test(trimmed)) {
                relevantSentences.push(trimmed);
                break;
            }
        }
    }

    // If no intent sentences found, return first part of text (before service lists)
    if (relevantSentences.length === 0) {
        const firstPart = text.split(/which include|including|we offer/i)[0];
        return firstPart?.toLowerCase() || text.toLowerCase();
    }

    return relevantSentences.join(' ');
}

/**
 * Derive service tags from call text.
 * Returns tags for services the CALLER asked about (not assistant's service list).
 */
export function deriveServiceTags(input: TopicDerivationInput): string[] {
    const { reason, summary, transcript, companyName } = input;

    // Combine and clean text
    let combinedText = [reason, summary, transcript].filter(Boolean).join(' ');

    // Remove company name fragments
    if (companyName) {
        const companyTokens = companyName.toLowerCase().split(/\s+/).filter(t => t.length > 2);
        for (const token of companyTokens) {
            if (!['the', 'and', 'for', 'inc', 'llc', 'co'].includes(token)) {
                combinedText = combinedText.replace(new RegExp(`\\b${token}\\b`, 'gi'), '');
            }
        }
    }

    // Extract caller-intent focused text
    const intentText = extractCallerIntentText(combinedText);

    const matchedServices: string[] = [];

    // Match service phrases with word boundaries
    for (const [service, phrases] of Object.entries(SERVICE_PHRASES)) {
        for (const phrase of phrases) {
            if (matchPhrase(intentText, phrase)) {
                if (!matchedServices.includes(service)) {
                    matchedServices.push(service);
                }
                break;
            }
        }
    }

    // Special: "ac" standalone check (must be word boundary)
    if (matchPhrase(intentText, 'ac') && !matchedServices.includes('AC repair')) {
        matchedServices.push('AC repair');
    }

    return matchedServices;
}

/**
 * Derive intent tags from call text.
 * Returns tags for what the caller wants to do (callback, estimate, schedule).
 */
export function deriveIntentTags(input: TopicDerivationInput): string[] {
    const { reason, summary, transcript, companyName } = input;

    let combinedText = [reason, summary, transcript].filter(Boolean).join(' ').toLowerCase();

    // Remove company name
    if (companyName) {
        const companyTokens = companyName.toLowerCase().split(/\s+/).filter(t => t.length > 2);
        for (const token of companyTokens) {
            if (!['the', 'and', 'for', 'inc', 'llc', 'co'].includes(token)) {
                combinedText = combinedText.replace(new RegExp(`\\b${token}\\b`, 'gi'), '');
            }
        }
    }

    const matchedIntents: string[] = [];

    for (const [intent, phrases] of Object.entries(INTENT_PHRASES)) {
        for (const phrase of phrases) {
            if (matchPhrase(combinedText, phrase)) {
                if (!matchedIntents.includes(intent)) {
                    matchedIntents.push(intent);
                }
                break;
            }
        }
    }

    return matchedIntents;
}

/**
 * Derive topic labels (combined service + intent for backward compatibility).
 */
export function deriveTopicLabels(input: TopicDerivationInput): string[] {
    const services = deriveServiceTags(input);
    const intents = deriveIntentTags(input);

    // Return services first, then relevant intents
    const combined = [...services];

    // Only add certain intents as visible tags
    const displayableIntents = ['Callback requested', 'Estimate requested', 'Emergency'];
    for (const intent of intents) {
        if (displayableIntents.includes(intent) && !combined.includes(intent)) {
            combined.push(intent);
        }
    }

    if (combined.length === 0) {
        return ['General inquiry'];
    }

    return combined;
}

/**
 * Derive reason label for display (short, derived not raw prose).
 */
export function deriveReasonLabel(serviceTags: string[], intentTags: string[]): string {
    if (serviceTags.length > 0) {
        return serviceTags[0];
    }
    if (intentTags.length > 0) {
        // Map intent to reason label
        const intentMap: Record<string, string> = {
            'Callback requested': 'Requested callback',
            'Estimate requested': 'Requested estimate',
            'Scheduling': 'Scheduling inquiry',
            'Emergency': 'Emergency service',
            'Consultation': 'Consultation request',
            'General inquiry': 'General inquiry',
        };
        return intentMap[intentTags[0]] || intentTags[0];
    }
    return 'General inquiry';
}

/**
 * Format topic labels for display: up to 2 topics + "+ N more".
 */
export function formatTopicDisplay(labels: string[]): string {
    if (labels.length === 0) return '';
    if (labels.length === 1) return labels[0];
    if (labels.length === 2) return labels.join(', ');
    return `${labels[0]}, ${labels[1]} + ${labels.length - 2} more`;
}

// ============================================================================
// OUTCOME DERIVATION
// ============================================================================

/**
 * Derive call outcome based on appointment status and call data.
 * Booked = ONLY if structured appointment exists (deterministic).
 * TBD/text-based appointment windows = Follow-up.
 */
export function deriveOutcome(input: OutcomeInput): CallOutcome {
    const { call, hasAppointment, appointmentStart } = input;

    // TBD: Has booking intent but NO structured time = Follow-up
    const hasIntent = hasBookingIntent(call);
    const hasStructured = !!appointmentStart || hasStructuredAppointment(call);

    if (hasIntent && !hasStructured) {
        return 'Follow-up';
    }

    // Booked: ONLY with structured appointment (deterministic)
    if (hasStructured || hasAppointment) {
        return 'Booked';
    }

    // Missed: Very short call with no meaningful content
    const duration = call.duration_seconds ?? 0;
    if (duration < 15 && !call.summary && !call.reason) {
        return 'Missed';
    }

    // Follow-up indicators
    const textContent = `${call.reason || ''} ${call.summary || ''}`.toLowerCase();
    const followUpKeywords = ['estimate', 'quote', 'call back', 'callback', 'follow up', 'get back', 'think about', 'check schedule'];
    const hasFollowUpIntent = followUpKeywords.some(kw => textContent.includes(kw));

    // Lead captured but no booking
    const isLead = call.lead_captured || call.outcome === 'lead';

    if (hasFollowUpIntent || isLead || duration > 30) {
        return 'Follow-up';
    }

    return 'Info-only';
}

// ============================================================================
// NEXT STEP DERIVATION
// ============================================================================

/**
 * Derive actionable next step based on outcome and call context.
 */
export function deriveNextStep(input: OutcomeInput): string {
    const outcome = deriveOutcome(input);
    const { call, appointmentStart } = input;
    const textContent = `${call.reason || ''} ${call.summary || ''}`.toLowerCase();

    switch (outcome) {
        case 'Booked':
            if (appointmentStart) {
                return 'Confirm details and prepare for appointment';
            }
            return 'Confirm appointment time with customer';

        case 'Missed':
            return 'Call back to connect with caller';

        case 'Follow-up':
            // Contextual next steps
            if (textContent.includes('estimate') || textContent.includes('quote')) {
                return 'Call to discuss scope and provide estimate';
            }
            if (textContent.includes('address') || textContent.includes('location')) {
                return 'Call to collect service address';
            }
            if (textContent.includes('schedule') || textContent.includes('time')) {
                return 'Call to confirm availability and schedule';
            }
            if (call.appointment_window && !appointmentStart) {
                return 'Call to confirm exact appointment time';
            }
            return 'Call back to complete booking';

        case 'Info-only':
        default:
            return 'Review call details if follow-up needed';
    }
}

// ============================================================================
// WHY IT MATTERS
// ============================================================================

/**
 * Derive "why this matters" explanation for prioritization.
 */
export function deriveWhyItMatters(input: OutcomeInput): string {
    const { call } = input;
    const outcome = deriveOutcome(input);
    const textContent = `${call.reason || ''} ${call.summary || ''}`.toLowerCase();
    const leadScore = calculateLeadScore(call);
    const scoreLabel = getLeadScoreLabel(leadScore);

    switch (outcome) {
        case 'Booked':
            return 'Appointment confirmed - revenue opportunity';

        case 'Missed':
            return 'Caller may try competitor if not contacted';

        case 'Follow-up':
            if (textContent.includes('emergency') || textContent.includes('urgent')) {
                return 'Urgent request - high conversion potential';
            }
            if (textContent.includes('estimate') || textContent.includes('quote')) {
                const topics = deriveTopicLabels({ reason: call.reason, summary: call.summary });
                const topicName = topics[0] || 'service';
                return `Requested estimate for ${topicName.toLowerCase()}`;
            }
            if (scoreLabel === 'Hot' || scoreLabel === 'Qualified') {
                return 'High-intent caller ready to book';
            }
            return 'Interest shown - needs follow-up to convert';

        case 'Info-only':
        default:
            return 'Inquiry received - may convert later';
    }
}

// ============================================================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================================================

/**
 * @deprecated Use sanitizeCallText instead
 */
export function sanitizeCallReason(text: string | null | undefined): string {
    const cleaned = sanitizeCallText(text);
    // Limit to short phrase for reason display
    const words = cleaned.split(/\s+/);
    if (words.length > 8) {
        return words.slice(0, 8).join(' ');
    }
    return cleaned;
}

/**
 * @deprecated Use sanitizeCallText instead
 */
export function sanitizeCallSummary(text: string | null | undefined): string {
    if (!text) return '';

    let cleaned = sanitizeCallText(text);

    // Limit to 2 sentences
    const sentences = cleaned.split(/([.!?])\s+/).reduce((acc: string[], part, i, arr) => {
        if (i % 2 === 0) {
            const punct = arr[i + 1] || '';
            const sentence = (part + punct).trim();
            if (sentence) acc.push(sentence);
        }
        return acc;
    }, []);

    return sentences.slice(0, 2).join(' ');
}
