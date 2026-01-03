import { describe, it, expect } from 'vitest';
import { extractCallbackPhone } from '../appointments';

describe('appointments', () => {
    describe('extractCallbackPhone', () => {
        it('returns null for empty input', () => {
            expect(extractCallbackPhone(null)).toBeNull();
            expect(extractCallbackPhone('')).toBeNull();
            expect(extractCallbackPhone(undefined)).toBeNull();
        });

        it('extracts number from "call back at" pattern', () => {
            expect(extractCallbackPhone('Please call back at 555-123-4567')).toBe('+15551234567');
            expect(extractCallbackPhone('call back at (555) 123-4567')).toBe('+15551234567');
            expect(extractCallbackPhone('dial back at 5551234567')).toBe('+15551234567');
        });

        it('extracts number from "callback number is" pattern', () => {
            expect(extractCallbackPhone('My callback number is 555-987-6543')).toBe('+15559876543');
            expect(extractCallbackPhone('Callback num is 555 987 6543')).toBe('+15559876543');
        });

        it('extracts number from "reach me at" pattern', () => {
            expect(extractCallbackPhone('You can reach me at 555-555-5555')).toBe('+15555555555');
            expect(extractCallbackPhone('Reach him at 5555555555')).toBe('+15555555555');
        });

        it('extracts number from "number is" pattern', () => {
            expect(extractCallbackPhone('The number is 555-222-3333')).toBe('+15552223333');
            // Ensure longer numbers or international format logic (current implementation assumes US 10 or 11 starting with 1)
            expect(extractCallbackPhone('number is 1-555-222-3333')).toBe('+15552223333');
        });

        it('ignores text without valid patterns', () => {
            expect(extractCallbackPhone('Call me later')).toBeNull();
            expect(extractCallbackPhone('My phone is broken')).toBeNull();
            // Should verify that only finding a number without prompt words returns null?
            // "I have 5 apples" -> null?
            // The regex looks for prompt words, so "I have 555-123-4567 apples" shouldn't match unless it hits "number is" etc.
            // But "The number is 555..." is a pattern.
            expect(extractCallbackPhone('Just wanted to say hi')).toBeNull();
        });

        it('validates length (10 digits)', () => {
            // 9 digits -> null
            expect(extractCallbackPhone('call back at 555-123-456')).toBeNull();
        });
    });
});
