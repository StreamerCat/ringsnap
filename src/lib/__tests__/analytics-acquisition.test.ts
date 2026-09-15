import { describe, expect, it } from 'vitest';
import { classifyAcquisition } from '../analytics';

describe('classifyAcquisition', () => {
  it('prioritizes explicit campaign attribution', () => {
    expect(classifyAcquisition('google', 'cpc', '')).toBe('paid_search');
    expect(classifyAcquisition('perplexity', 'referral', '')).toBe('ai_assistant');
    expect(classifyAcquisition('partner-name', 'partner', '')).toBe('partner');
  });

  it('classifies known search and AI referrers without UTMs', () => {
    expect(classifyAcquisition(null, null, 'https://www.google.com/search?q=ai+receptionist')).toBe('organic_search');
    expect(classifyAcquisition(null, null, 'https://www.perplexity.ai/search?q=ringsnap')).toBe('ai_assistant');
  });

  it('handles direct and ordinary referral traffic', () => {
    expect(classifyAcquisition(null, null, '')).toBe('direct');
    expect(classifyAcquisition(null, null, 'https://example.com/article')).toBe('referral');
  });
});
