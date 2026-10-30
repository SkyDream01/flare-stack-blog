/*
 * D1 stores a string, a BLOB or a whole table row up to 2,000,000 bytes. A
 * Post's row holds the draft body (`content_json`) and the Public Content
 * Snapshot (`public_snapshot_json`, which carries its own copy of the body
 * with highlighted code HTML) side by side, so each gets under half of that,
 * leaving the rest for the title, summary, slug and the other columns.
 *
 * The request body limit (2 MiB) cannot stand in for this: Markdown grows
 * when it becomes TipTap JSON, and a snapshot grows again when its code is
 * highlighted.
 */

/** Largest serialized `contentJson` a Post stores, in bytes. */
export const POST_CONTENT_JSON_LIMIT_BYTES = 800_000;

/** Largest serialized Public Content Snapshot a Post stores, in bytes. */
export const PUBLIC_SNAPSHOT_LIMIT_BYTES = 800_000;

/**
 * The most characters of code one publish highlights; code blocks past it go
 * into the Public Content Snapshot as plain HTML. Highlighting is the costliest
 * step of publishing (Shiki takes about 7 ms of CPU per 1,000 characters of
 * code, and longer to load a grammar) and its HTML takes about 20 bytes per
 * character of code, so code past this could seldom fit in the snapshot
 * highlighted anyway. The bound keeps a publish to a fraction of a second of
 * CPU however much code a post holds, where a 280 KB block once took seconds
 * and ran past what a Worker may spend.
 */
export const HIGHLIGHT_BUDGET_CHARS = 30_000;

/** For the descriptions of the operations and fields that write a body. */
export const CONTENT_SIZE_RULES = `A post stores at most ${POST_CONTENT_JSON_LIMIT_BYTES} bytes of serialized contentJson, measured after any Markdown is converted, which makes it larger. A body over that is refused with 413 POST_CONTENT_TOO_LARGE, whose data holds the limit and the size, and nothing is written.`;

/** The bytes `value` takes once stored as JSON text. */
export function serializedBytes(value: unknown) {
  if (value === null || value === undefined) return 0;
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

/** The two stored values the limits apply to. */
export type PostContentField = "contentJson" | "publicSnapshot";

/**
 * Checks `value` against the limit of `field`: null when it fits, otherwise
 * what a refusal reports.
 */
export function contentTooLarge(field: PostContentField, value: unknown) {
  const limit =
    field === "contentJson"
      ? POST_CONTENT_JSON_LIMIT_BYTES
      : PUBLIC_SNAPSHOT_LIMIT_BYTES;
  const size = serializedBytes(value);
  return size > limit
    ? ({ reason: "POST_CONTENT_TOO_LARGE", field, limit, size } as const)
    : null;
}
