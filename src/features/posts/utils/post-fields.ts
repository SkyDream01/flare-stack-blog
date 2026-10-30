import { hasControlCharacter, uniqueKeyOf } from "@/lib/unicode-text";

/**
 * Rules for a Post's title and slug, shared by the API schemas and the admin
 * editor, which leaves a value out of its autosave until it follows them.
 */

export const POST_TITLE_MAX_LENGTH = 200;
export const POST_SLUG_MAX_LENGTH = 200;

/**
 * A slug made from a title is cut to this length, leaving room for the number
 * or random suffix that makes it unique.
 */
const GENERATED_SLUG_MAX_LENGTH = 180;

// URL delimiters (/ ? # %), the backslash, whitespace (no-break spaces too),
// and control and format characters (zero width, bidirectional controls).
// The caret is forbidden too: a request path carries it as %5E or raw
// depending on who parses it, so the router's canonical-path redirect sends
// its page to itself forever. Every other printable ASCII symbol opens its
// page (checked against the running app).
const SLUG_FORBIDDEN_CHARACTER = /[/?#%\\^\s\p{Cc}\p{Cf}]/u;

/**
 * Slugs the public API keeps for itself: GET /api/posts/pinned and
 * /api/posts/popular are lists, so a Post with either slug could not be read
 * by slug there. Compared by unique key, so case and fullwidth forms count.
 */
export const RESERVED_POST_SLUGS: ReadonlyArray<string> = ["pinned", "popular"];

/** Whether `slug`, already trimmed, can be a Post's slug. */
export function isPostSlugFormat(slug: string) {
  return !SLUG_FORBIDDEN_CHARACTER.test(slug) && slug !== "." && slug !== "..";
}

/** Whether `slug`, already trimmed, is one the public API keeps for itself. */
export function isReservedPostSlug(slug: string) {
  return RESERVED_POST_SLUGS.includes(uniqueKeyOf(slug));
}

/**
 * Whether `title`, already trimmed, has no control or format character
 * (Unicode Cc or Cf), such as NUL, a tab or a zero width space. A zero width
 * joiner inside an emoji is part of it.
 */
export function isPostTitleFormat(title: string) {
  return !hasControlCharacter(title, { emoji: true });
}

/**
 * Whether `summary` has no control or format character (Unicode Cc or Cf)
 * besides tab, line feed and carriage return, which a multi-line summary
 * needs. A zero width joiner inside an emoji is part of it.
 */
export function isPostSummaryFormat(summary: string) {
  return !hasControlCharacter(summary.replace(/[\t\n\r]/g, ""), {
    emoji: true,
  });
}

/** Whether the API would take `title` as a Post's title. */
export function isValidPostTitle(title: string) {
  const trimmed = title.trim();
  return (
    trimmed.length > 0 &&
    trimmed.length <= POST_TITLE_MAX_LENGTH &&
    isPostTitleFormat(trimmed)
  );
}

/** Whether the API would take `slug` as a Post's slug. */
export function isValidPostSlug(slug: string) {
  const trimmed = slug.trim();
  return (
    trimmed.length > 0 &&
    trimmed.length <= POST_SLUG_MAX_LENGTH &&
    isPostSlugFormat(trimmed) &&
    !isReservedPostSlug(trimmed)
  );
}

/** `slug`, made from a title, cut short enough to take a suffix. */
export function truncateGeneratedSlug(slug: string) {
  if (slug.length <= GENERATED_SLUG_MAX_LENGTH) return slug;
  return slug.slice(0, GENERATED_SLUG_MAX_LENGTH).replace(/-+$/, "");
}
