import { describe, expect, it } from 'vitest';
import { isSixDigitPin, normalizeEmail, pinCredential } from '@/lib/auth';
import { isSessionExpired, maximumSessionAgeMs, sessionExpiresAt } from '@/lib/session-security';

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

describe('session security', () => {
  const signedInAt = '2026-10-15T08:00:00.000Z';

  it('sets an absolute two-hour limit from the last sign-in', () => {
    expect(sessionExpiresAt(signedInAt)).toBe(Date.parse(signedInAt) + maximumSessionAgeMs);
    expect(isSessionExpired(signedInAt, Date.parse('2026-10-15T09:59:59.999Z'))).toBe(false);
    expect(isSessionExpired(signedInAt, Date.parse('2026-10-15T10:00:00.000Z'))).toBe(true);
  });

  it('treats a missing or invalid sign-in time as expired', () => {
    expect(isSessionExpired(undefined)).toBe(true);
    expect(isSessionExpired('not-a-date')).toBe(true);
  });
});
