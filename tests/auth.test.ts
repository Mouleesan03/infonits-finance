import { describe, expect, it } from 'vitest';
import { isSixDigitPin, normalizeEmail, pinCredential } from '@/lib/auth';

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

  it('derives a stable strong credential without exposing the PIN', async () => {
    const first = await pinCredential('Admin@Infonits.IO', '042691');
    const second = await pinCredential('admin@infonits.io', '042691');
    const differentUser = await pinCredential('finance@infonits.io', '042691');

    expect(first).toBe(second);
    expect(first).not.toBe(differentUser);
    expect(first).not.toContain('042691');
    expect(first.length).toBeGreaterThan(60);
  });
});
