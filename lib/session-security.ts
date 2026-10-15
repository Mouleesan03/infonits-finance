export const maximumSessionAgeMs = 2 * 60 * 60 * 1000;

export function sessionExpiresAt(lastSignInAt: string | null | undefined) {
  if (!lastSignInAt) return 0;
  const signedInAt = Date.parse(lastSignInAt);
  return Number.isFinite(signedInAt) ? signedInAt + maximumSessionAgeMs : 0;
}

export function isSessionExpired(lastSignInAt: string | null | undefined, now = Date.now()) {
  const expiresAt = sessionExpiresAt(lastSignInAt);
  return expiresAt === 0 || now >= expiresAt;
}
