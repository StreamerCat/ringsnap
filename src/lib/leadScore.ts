/**
 * Lead Score Calculation
 * 
 * Rule-based scoring system for call outcomes.
 * Transparent rules with tooltip explanations.
 */

export interface CallLog {
    id?: string;
    booked?: boolean;
    lead_captured?: boolean;
    outcome?: string;
    reason?: string;
    duration_seconds?: number;
    transcript_summary?: string;
    caller_name?: string;
    caller_phone?: string;
}

/**
 * Calculate a lead score from 0-100 based on call outcome.
 * 
 * Scoring rules (highest match wins):
 * - Booked appointment: 95
 * - Lead captured: 75
 * - Engaged call (>60s with reason): 50
 * - Short call (<30s): 15
 * - Default: 35
 */
export function calculateLeadScore(call: CallLog): number {
    // Highest priority: booking
    if (call.booked || call.outcome === 'booked' || call.outcome === 'appointment_booked') {
        return 95;
    }

    // Lead captured or qualified
    if (call.lead_captured || call.outcome === 'lead' || call.outcome === 'lead_captured') {
        return 75;
    }

    // Engaged call - meaningful duration and extracted reason
    if (call.reason && (call.duration_seconds ?? 0) > 60) {
        return 50;
    }

    // Short call - likely not valuable
    if ((call.duration_seconds ?? 0) < 30) {
        return 15;
    }

    // Default middle score
    return 35;
}

/**
 * Get a human-readable label for the lead score.
 */
export function getLeadScoreLabel(score: number): 'Hot' | 'Qualified' | 'Warm' | 'Cold' {
    if (score >= 90) return 'Hot';
    if (score >= 70) return 'Qualified';
    if (score >= 30) return 'Warm';
    return 'Cold';
}

/**
 * Get the explanation for why a call received its score.
 */
export function getLeadScoreReason(call: CallLog): string {
    if (call.booked || call.outcome === 'booked' || call.outcome === 'appointment_booked') {
        return 'Appointment was booked during this call';
    }
    if (call.lead_captured || call.outcome === 'lead' || call.outcome === 'lead_captured') {
        return 'Contact info was captured as a lead';
    }
    if (call.reason && (call.duration_seconds ?? 0) > 60) {
        return 'Engaged conversation with identified intent';
    }
    if ((call.duration_seconds ?? 0) < 30) {
        return 'Brief call, may be inquiry or wrong number';
    }
    return 'Standard call with moderate engagement';
}

/**
 * Get CSS classes for the score badge.
 */
export function getLeadScoreClasses(score: number): string {
    if (score >= 90) return 'bg-green-100 text-green-800 border-green-200';
    if (score >= 70) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (score >= 30) return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
}
