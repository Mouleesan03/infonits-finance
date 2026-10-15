import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { createAgentToken, isPublicIp, verifyAgentToken } from '@/lib/website-monitor';

beforeAll(() => {
  process.env.WEBSITE_MONITOR_SECRET = 'test-secret-that-is-long-enough-for-hmac';
});

describe('website monitoring security', () => {
  it('rejects loopback and private network addresses', () => {
    expect(isPublicIp('127.0.0.1')).toBe(false);
    expect(isPublicIp('10.1.2.3')).toBe(false);
    expect(isPublicIp('172.20.1.1')).toBe(false);
    expect(isPublicIp('192.168.1.1')).toBe(false);
    expect(isPublicIp('::1')).toBe(false);
    expect(isPublicIp('fd00::1')).toBe(false);
  });

  it('allows public addresses', () => {
    expect(isPublicIp('1.1.1.1')).toBe(true);
    expect(isPublicIp('2606:4700:4700::1111')).toBe(true);
  });

  it('verifies signed agent identity and rejects tampering', () => {
    const token = createAgentToken('user-1', 'site-1', 'version-1');
    expect(verifyAgentToken(token)).toEqual({
      userId: 'user-1',
      siteId: 'site-1',
      tokenVersion: 'version-1',
    });
    expect(() => verifyAgentToken(`${token}x`)).toThrow(/Invalid agent token/);
  });
});
