import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

export type WebsiteCheck = {
  status: 'Online' | 'Issue' | 'Offline';
  checkedAt: string;
  httpStatus: number | null;
  responseMs: number | null;
  finalUrl: string;
  error: string;
};

const blockedHostname = /(^|\.)(localhost|local|internal|home|lan)$/i;

function blockedIpv4(address: string) {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part))) return true;
  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0) ||
    a >= 224
  );
}

export function isPublicIp(address: string) {
  const version = isIP(address);
  if (version === 4) return !blockedIpv4(address);
  if (version !== 6) return false;
  const normalized = address.toLowerCase();
  if (normalized === '::' || normalized === '::1') return false;
  if (/^(fc|fd)/.test(normalized) || /^fe[89ab]/.test(normalized)) return false;
  const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? !blockedIpv4(mapped[1]) : true;
}

export async function validatePublicWebsiteUrl(value: string) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol))
    throw new Error('Only HTTP or HTTPS is allowed.');
  if (url.username || url.password) throw new Error('Website URLs cannot contain credentials.');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (blockedHostname.test(hostname)) throw new Error('Private network addresses are not allowed.');
  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicIp(address))) {
    throw new Error('Private or unresolved network addresses are not allowed.');
  }
  url.hash = '';
  return url;
}

export async function checkWebsite(value: string): Promise<WebsiteCheck> {
  const checkedAt = new Date().toISOString();
  const started = performance.now();
  let current: URL | null = null;
  try {
    current = await validatePublicWebsiteUrl(value);
    for (let redirect = 0; redirect <= 4; redirect += 1) {
      let response = await fetch(current, {
        method: 'HEAD',
        redirect: 'manual',
        cache: 'no-store',
        signal: AbortSignal.timeout(12_000),
        headers: { 'user-agent': 'Infonits-Website-Monitor/1.0' },
      });
      if (response.status === 405 || response.status === 501) {
        response = await fetch(current, {
          method: 'GET',
          redirect: 'manual',
          cache: 'no-store',
          signal: AbortSignal.timeout(12_000),
          headers: { 'user-agent': 'Infonits-Website-Monitor/1.0' },
        });
        await response.body?.cancel();
      }
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) break;
        if (redirect === 4) throw new Error('Too many redirects.');
        current = await validatePublicWebsiteUrl(new URL(location, current).toString());
        continue;
      }
      return {
        status: response.status < 400 ? 'Online' : 'Issue',
        checkedAt,
        httpStatus: response.status,
        responseMs: Math.max(1, Math.round(performance.now() - started)),
        finalUrl: current.toString(),
        error: response.status < 400 ? '' : `HTTP ${response.status}`,
      };
    }
    throw new Error('Redirect response did not include a destination.');
  } catch (error) {
    return {
      status: 'Offline',
      checkedAt,
      httpStatus: null,
      responseMs: Math.max(1, Math.round(performance.now() - started)),
      finalUrl: current?.toString() ?? value,
      error: error instanceof Error ? error.message : 'Website check failed.',
    };
  }
}

function monitorSecret() {
  const secret = process.env.WEBSITE_MONITOR_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('Website monitoring is not configured.');
  return secret;
}

function signature(payload: string) {
  return createHmac('sha256', monitorSecret()).update(payload).digest('base64url');
}

export function createAgentToken(userId: string, siteId: string, tokenVersion: string) {
  const payload = Buffer.from(
    JSON.stringify({ userId, siteId, tokenVersion, version: 1 }),
  ).toString('base64url');
  return `${payload}.${signature(payload)}`;
}

export function verifyAgentToken(token: string) {
  const [payload, supplied, extra] = token.split('.');
  if (!payload || !supplied || extra) throw new Error('Invalid agent token.');
  const expected = signature(payload);
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new Error('Invalid agent token.');
  }
  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
    userId?: unknown;
    siteId?: unknown;
    tokenVersion?: unknown;
    version?: unknown;
  };
  if (
    typeof decoded.userId !== 'string' ||
    typeof decoded.siteId !== 'string' ||
    typeof decoded.tokenVersion !== 'string' ||
    decoded.version !== 1
  ) {
    throw new Error('Invalid agent token.');
  }
  return {
    userId: decoded.userId,
    siteId: decoded.siteId,
    tokenVersion: decoded.tokenVersion,
  };
}
