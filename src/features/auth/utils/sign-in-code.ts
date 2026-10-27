export const SIGN_IN_CODE_LENGTH = 6;
export const RESEND_COOLDOWN_MS = 60_000;

/** Drops the spaces and dashes people paste along with a code. */
export function normalizeSignInCode(raw: string) {
  return raw.replace(/[\s-]/g, "");
}

export function isSignInCode(raw: string) {
  return new RegExp(`^\\d{${SIGN_IN_CODE_LENGTH}}$`).test(
    normalizeSignInCode(raw),
  );
}

/** Wait at least a minute before a resend, longer if the server asks for it. */
export function getResendCooldownMs(retryAfterMs?: number) {
  return Math.max(RESEND_COOLDOWN_MS, retryAfterMs ?? 0);
}

export function getSecondsLeft(until: number, now: number) {
  return Math.max(0, Math.ceil((until - now) / 1000));
}
