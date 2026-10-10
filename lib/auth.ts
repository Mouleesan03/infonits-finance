export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isSixDigitPin(value: string) {
  return /^\d{6}$/.test(value);
}

export async function pinCredential(email: string, pin: string) {
  if (!isSixDigitPin(pin)) throw new Error('PIN_INVALID');
  const identity = normalizeEmail(email);
  const input = new TextEncoder().encode(`infonits-finance-pin:v1:${identity}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', input);
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  return `If!${hash}aA1`;
}
