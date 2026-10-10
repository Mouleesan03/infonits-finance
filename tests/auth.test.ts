import { describe, expect, it } from 'vitest';
import { isSixDigitPin, normalizeEmail } from '@/lib/auth';

describe('login helpers', () => {
  it('normalizes email addresses before authentication', () => {
    expect(normalizeEmail('  Admin@Infonits.IO ')).toBe('admin@infonits.io');
  });

  it('accepts only an exact six-digit PIN', () => {
    expect(isSixDigitPin('042691')).toBe(true);
    expect(isSixDigitPin('42691')).toBe(false);
    expect(isSixDigitPin('1234567')).toBe(false);
    expect(isSixDigitPin('12a456')).toBe(false);
  });
});
