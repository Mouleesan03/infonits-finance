export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isSixDigitPin(value: string) {
  return /^\d{6}$/.test(value);
}
