import { z } from "zod";

/**
 * An id in a path: a positive whole number. Over HTTP it is written as plain
 * decimal digits, which `StrictOpenAPICodec` holds every path id to.
 */
export const PathIdSchema = z.number().int().min(1);

const CANONICAL_ID = /^[1-9][0-9]*$/;

/**
 * Whether a path segment writes an id the one way ids are written: digits
 * with no sign, point, exponent, hex prefix or padding, so every address
 * names an id one way only. `Number()` also reads `7.4e1`, `0x4A`, `074` and
 * ` 74` as 74.
 */
export function isCanonicalId(value: string) {
  return CANONICAL_ID.test(value) && Number.isSafeInteger(Number(value));
}
