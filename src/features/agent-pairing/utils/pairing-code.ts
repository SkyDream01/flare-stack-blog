// A Pairing Code is read aloud, retyped and pasted, so its alphabet leaves out
// the characters people confuse: 0 and O, 1, I and L.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const LENGTH = 8;
const NORMALIZED = new RegExp(`^[${ALPHABET}]{${LENGTH}}$`);

/** How long a Pairing Code can be exchanged after it is generated. */
export const PAIRING_CODE_TTL_MS = 10 * 60 * 1000;

/** A new Pairing Code as it is shown, `ABCD-EFGH`. */
export function newPairingCode() {
  // 256 is not a multiple of the alphabet's length, so bytes past the last
  // whole multiple are drawn again to keep every character equally likely.
  const limit = 256 - (256 % ALPHABET.length);
  let code = "";
  while (code.length < LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(LENGTH))) {
      if (byte < limit && code.length < LENGTH) {
        code += ALPHABET[byte % ALPHABET.length];
      }
    }
  }
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * The code as typed, without case, hyphens or spaces, or null when it cannot
 * be a Pairing Code.
 */
export function normalizePairingCode(input: string) {
  const code = input.replace(/[\s-]/g, "").toUpperCase();
  return NORMALIZED.test(code) ? code : null;
}

/** What is stored of a code, given in its normalized form. */
export async function hashPairingCode(normalized: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(normalized),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
