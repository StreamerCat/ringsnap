import { describe, expect, it } from 'vitest';
import { extractCallDetails } from '../../supabase/functions/vapi-webhook/call_parser';

describe('Critical runtime smoke (tool payload + call routing extraction)', () => {
  it('extracts booked appointment state for downstream dashboard and analytics', () => {
    const result = extractCallDetails(
      {
        id: 'call_123',
        customer: { name: 'Jane Caller', number: '+15551234567' },
        transcript: 'Hi my name is Jane Caller and I need water heater repair tomorrow',
        analysis: {
          structuredData: {
            reason: 'water heater repair',
            booked: true,
            appointmentStart: '2026-02-01T15:00:00.000Z',
            appointmentEnd: '2026-02-01T16:00:00.000Z',
          },
          successEvaluation: true,
        },
      },
      {
        type: 'end-of-call-report',
      }
    );

    expect(result.leadCaptured).toBe(true);
    expect(result.reason?.toLowerCase()).toContain('water heater');
    expect(result.outcome).toBe('booked');
  });

  it('does not derive tags from summary-only payloads (prevents false positives)', () => {
    const result = extractCallDetails(
      {
        id: 'call_234',
        analysis: { summary: 'Caller might want appointment', structuredData: {} },
      },
      {
        type: 'end-of-call-report',
        summary: 'Caller discussed options but no clear request',
      }
    );

    expect(result.reason).toBeNull();
    expect(result.tagSource).toBe('none');
  });
});
