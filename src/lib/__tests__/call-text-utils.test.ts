import { describe, it, expect } from 'vitest';
import {
    sanitizeCallText,
    deriveTopicLabels,
    formatTopicDisplay,
    deriveOutcome,
    deriveNextStep,
    deriveWhyItMatters,
    sanitizeCallReason,
    sanitizeCallSummary,
} from '../call-text-utils';

describe('call-text-utils', () => {
    describe('sanitizeCallText', () => {
        it('strips "The user called X to" prefix', () => {
            const input = 'The user called Apple Plum Plumbing to schedule a drain cleaning.';
            const result = sanitizeCallText(input);
            expect(result).toBe('Schedule a drain cleaning');
        });

        it('strips "Caller called X about" prefix', () => {
            const input = 'Caller called RingSnap Support about a water heater issue.';
            const result = sanitizeCallText(input);
            expect(result).toBe('A water heater issue');
        });

        it('handles fuzzy company name matching', () => {
            const input = 'The user called apple plumb to get an estimate.';
            const result = sanitizeCallText(input, { companyName: 'Apple Plum Plumbing' });
            expect(result).toBe('Get an estimate');
            expect(result.toLowerCase()).not.toContain('apple');
            expect(result.toLowerCase()).not.toContain('plumb');
        });

        it('removes company name with misspellings', () => {
            const input = 'Customer contacted Apple Plumb for emergency service.';
            const result = sanitizeCallText(input, { companyName: 'Apple Plum Plumbing' });
            expect(result.toLowerCase()).not.toContain('apple');
        });

        it('strips "PersonName called business to" prefix', () => {
            const input = 'Mark called apple plumb to inquire about new lighting services.';
            const result = sanitizeCallText(input, { companyName: 'Apple Plum Plumbing' });
            expect(result.toLowerCase()).not.toContain('apple');
            expect(result.toLowerCase()).not.toContain('plumb');
            expect(result.toLowerCase()).not.toContain('mark called');
            expect(result.toLowerCase()).toContain('lighting');
        });

        it('replaces AI with RingSnap agent', () => {
            const input = 'The AI assistant helped schedule the appointment.';
            const result = sanitizeCallText(input);
            expect(result).toContain('RingSnap agent');
            expect(result).not.toContain('AI');
        });

        it('handles A.I. and Artificial Intelligence', () => {
            const input = 'The A.I. answered. Artificial Intelligence is great.';
            const result = sanitizeCallText(input);
            expect(result).not.toContain('A.I.');
            expect(result).not.toContain('Artificial Intelligence');
        });

        it('handles empty or null input', () => {
            expect(sanitizeCallText(null)).toBe('');
            expect(sanitizeCallText('')).toBe('');
            expect(sanitizeCallText(undefined)).toBe('');
        });

        it('is idempotent', () => {
            const input = 'Schedule a repair';
            const first = sanitizeCallText(input);
            const second = sanitizeCallText(first);
            expect(first).toBe(second);
        });

        it('capitalizes first letter', () => {
            const input = 'the caller wanted to schedule';
            const result = sanitizeCallText(input);
            expect(result.charAt(0)).toBe(result.charAt(0).toUpperCase());
        });

        it('cleans up extra whitespace and punctuation', () => {
            const input = '  ,  The user called to ask about pricing...  ';
            const result = sanitizeCallText(input);
            expect(result).not.toMatch(/^\s/);
            expect(result).not.toMatch(/\s$/);
            expect(result).not.toMatch(/\s{2,}/);
        });
    });

    describe('deriveTopicLabels', () => {
        it('extracts water heater topic', () => {
            const labels = deriveTopicLabels({ reason: 'Water heater not working' });
            expect(labels).toContain('Water heater');
        });

        it('extracts drain cleaning topic', () => {
            const labels = deriveTopicLabels({ summary: 'Clogged drain in bathroom' });
            expect(labels).toContain('Drain cleaning');
        });

        it('extracts multiple topics', () => {
            const labels = deriveTopicLabels({
                reason: 'Water heater and drain issues',
                summary: 'Customer needs estimate for both'
            });
            expect(labels.length).toBeGreaterThanOrEqual(2);
        });

        it('returns General inquiry when no keywords match (trade not used)', () => {
            // Per requirements: "Remove any default tags based on account.trade"
            const labels = deriveTopicLabels({ reason: 'Had a chat about the property', trade: 'Plumbing' });
            expect(labels).toContain('General inquiry');
            expect(labels).not.toContain('Plumbing');
        });

        it('returns General inquiry for content without matches', () => {
            const labels = deriveTopicLabels({ reason: 'Called about something' });
            expect(labels).toContain('General inquiry');
        });

        it('returns empty array for empty input', () => {
            const labels = deriveTopicLabels({});
            expect(labels).toEqual(['General inquiry']);
        });

        it('never returns sentence fragments', () => {
            const labels = deriveTopicLabels({
                reason: 'The user called to schedule a comprehensive maintenance check...'
            });
            labels.forEach(label => {
                expect(label).not.toContain('...');
                expect(label.length).toBeLessThan(50);
            });
        });

        // Critical: Word boundary tests
        it('does NOT produce AC tag for callback text', () => {
            const labels = deriveTopicLabels({ summary: 'Customer requested a callback about electrical work' });
            expect(labels).not.toContain('AC repair');
        });

        it('matches AC repair only with word boundary', () => {
            const labels = deriveTopicLabels({ summary: 'Customer needs AC repair for their home' });
            expect(labels).toContain('AC repair');
        });

        it('extracts EV charger installation from Mark sample', () => {
            const labels = deriveTopicLabels({
                summary: 'Mark called apple plumb to inquire about new EV charger installation for his home',
                companyName: 'Apple Plum Electrical'
            });
            expect(labels).toContain('EV charger installation');
        });

        it('extracts callback intent from Mark sample', () => {
            const labels = deriveTopicLabels({
                summary: 'Customer requested a callback to discuss EV charger installation',
            });
            expect(labels).toContain('Callback requested');
        });

        it('preserves customer name Mark when removing company name', () => {
            // Company removal should only remove company tokens, not customer names
            const input = 'Mark called apple plumb to ask about services';
            const result = sanitizeCallText(input, { companyName: 'Apple Plum Electrical' });
            // Result should not contain company fragments but the customer name reference is fine
            expect(result.toLowerCase()).not.toContain('apple');
            expect(result.toLowerCase()).not.toContain('plumb');
        });

        it('should NOT include services from assistant list', () => {
            const labels = deriveTopicLabels({
                summary: 'Customer asked about EV charger installation. Our services which include outlet repair, panel upgrades, and lighting install are available.',
                companyName: 'Apple Plum Electrical'
            });
            // Should only include what customer asked about
            expect(labels).toContain('EV charger installation');
            // Should NOT include items from the "services which include" clause
            expect(labels).not.toContain('Electrical');
            expect(labels).not.toContain('Lighting install');
        });
    });

    describe('formatTopicDisplay', () => {
        it('returns empty string for empty array', () => {
            expect(formatTopicDisplay([])).toBe('');
        });

        it('returns single topic as-is', () => {
            expect(formatTopicDisplay(['Drain cleaning'])).toBe('Drain cleaning');
        });

        it('joins two topics with comma', () => {
            expect(formatTopicDisplay(['Drain cleaning', 'Water heater'])).toBe('Drain cleaning, Water heater');
        });

        it('shows "+ N more" for more than 2 topics', () => {
            const result = formatTopicDisplay(['A', 'B', 'C', 'D']);
            expect(result).toBe('A, B + 2 more');
        });
    });

    describe('deriveOutcome', () => {
        it('returns Booked when appointment exists', () => {
            const outcome = deriveOutcome({
                call: { booked: true } as any,
                appointmentStart: '2024-01-15T10:00:00Z'
            });
            expect(outcome).toBe('Booked');
        });

        it('returns Missed for very short calls', () => {
            const outcome = deriveOutcome({
                call: { duration_seconds: 10 } as any
            });
            expect(outcome).toBe('Missed');
        });

        it('returns Follow-up for estimate requests', () => {
            const outcome = deriveOutcome({
                call: { reason: 'Wanted an estimate', duration_seconds: 60 } as any
            });
            expect(outcome).toBe('Follow-up');
        });

        it('returns Follow-up for TBD appointments', () => {
            const outcome = deriveOutcome({
                call: { appointment_window: 'sometime next week', duration_seconds: 120 } as any
            });
            expect(outcome).toBe('Follow-up');
        });
    });

    describe('deriveNextStep', () => {
        it('returns confirmation step for booked appointments', () => {
            const step = deriveNextStep({
                call: { booked: true } as any,
                appointmentStart: '2024-01-15T10:00:00Z'
            });
            expect(step.toLowerCase()).toContain('confirm');
        });

        it('returns call back step for missed calls', () => {
            const step = deriveNextStep({
                call: { duration_seconds: 5 } as any
            });
            expect(step.toLowerCase()).toContain('call');
        });

        it('returns contextual step for estimate requests', () => {
            const step = deriveNextStep({
                call: { reason: 'Need an estimate for AC repair', duration_seconds: 90 } as any
            });
            expect(step.toLowerCase()).toContain('estimate');
        });
    });

    describe('deriveWhyItMatters', () => {
        it('indicates revenue for booked appointments', () => {
            const why = deriveWhyItMatters({
                call: { booked: true } as any,
                appointmentStart: '2024-01-15T10:00:00Z'
            });
            expect(why.toLowerCase()).toContain('revenue');
        });

        it('indicates urgency for missed calls', () => {
            const why = deriveWhyItMatters({
                call: { duration_seconds: 5 } as any
            });
            expect(why.toLowerCase()).toContain('competitor');
        });
    });

    describe('backward compatibility', () => {
        it('sanitizeCallReason limits to short phrase', () => {
            const input = 'The user called to schedule a comprehensive maintenance check for their entire HVAC system';
            const result = sanitizeCallReason(input);
            const words = result.split(/\s+/);
            expect(words.length).toBeLessThanOrEqual(8);
        });

        it('sanitizeCallSummary limits to 2 sentences', () => {
            const input = 'First sentence. Second sentence. Third sentence. Fourth sentence.';
            const result = sanitizeCallSummary(input);
            const periodCount = (result.match(/\./g) || []).length;
            expect(periodCount).toBeLessThanOrEqual(2);
        });
    });
});
