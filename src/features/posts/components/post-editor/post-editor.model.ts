import { ORPCError } from "@orpc/client";
import type { JSONContent } from "@tiptap/react";
import { m } from "@/paraglide/messages";
import type { EditConflict } from "./types";

const CJK_CHAR =
  /[\u4E00-\u9FFF\u3400-\u4DBF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/g;

export const BLOB_UPLOADING_ERROR = "BLOB_UPLOADING";
/** What `flush` throws once a save was refused; the conflict notice is shown. */
export const EDIT_CONFLICT_ERROR = "EDIT_CONFLICT";

/** What autosave reports when another post already uses the slug. */
export const SLUG_TAKEN_ERROR = "SLUG_TAKEN";

/** Whether a failed save was refused because another post uses the slug. */
export function isSlugTaken(error: unknown) {
  return error instanceof ORPCError && error.code === "SLUG_TAKEN";
}

/** What autosave reports when the body is over what a post stores. */
export const CONTENT_TOO_LARGE_ERROR = "POST_CONTENT_TOO_LARGE";

/** Whether a failed write was refused for the size of the body or snapshot. */
export function isContentTooLarge(error: unknown) {
  return error instanceof ORPCError && error.code === CONTENT_TOO_LARGE_ERROR;
}

/**
 * What to tell the Admin when the server refused the post for its size: the
 * body when saving, the published version (code highlighted) when publishing.
 */
export function contentTooLargeMessage(error: unknown) {
  const data: unknown = error instanceof ORPCError ? error.data : null;
  const limit =
    data &&
    typeof data === "object" &&
    "limit" in data &&
    typeof data.limit === "number"
      ? Math.round(data.limit / 1000)
      : 0;
  return data &&
    typeof data === "object" &&
    "field" in data &&
    data.field === "publicSnapshot"
    ? m.editor_snapshot_too_large({ limit })
    : m.editor_content_too_large({ limit });
}

/** The conflict a failed write was refused with, if it was an Edit Conflict. */
export function editConflictOf(error: unknown): EditConflict | null {
  if (!(error instanceof ORPCError) || error.code !== "EDIT_CONFLICT") {
    return null;
  }
  const data: unknown = error.data;
  if (
    data &&
    typeof data === "object" &&
    "saveToken" in data &&
    typeof data.saveToken === "string"
  ) {
    return { saveToken: data.saveToken };
  }
  return null;
}

/**
 * What to tell the Admin when publishing was refused or failed. An Edit
 * Conflict is handled apart from this.
 */
export function publishErrorMessage(error: unknown) {
  if (isContentTooLarge(error)) return contentTooLargeMessage(error);
  if (error instanceof ORPCError && error.code === "PUBLISHED_AT_IN_FUTURE") {
    return m.editor_action_publish_future_date();
  }
  return m.editor_action_publish_failed();
}

/**
 * What to tell the Admin when discarding Unpublished Changes was refused or
 * failed. An Edit Conflict is handled apart from this.
 */
export function discardErrorMessage(error: unknown) {
  if (error instanceof ORPCError) {
    switch (error.code) {
      case "NO_UNPUBLISHED_CHANGES":
        return m.editor_action_discard_no_changes();
      case "POST_NOT_PUBLISHED":
        return m.editor_action_discard_not_published();
      case "SLUG_TAKEN":
        return m.editor_action_discard_slug_taken();
    }
  }
  return m.editor_action_discard_failed();
}

export function persistableTagIds(tagIds: Array<number>) {
  return tagIds.filter((id) => id > 0);
}

export function contentHasBlobUrl(
  doc: JSONContent | null | undefined,
): boolean {
  if (!doc) return false;
  if (
    doc.type === "image" &&
    typeof doc.attrs?.src === "string" &&
    doc.attrs.src.startsWith("blob:")
  ) {
    return true;
  }
  return doc.content?.some((node) => contentHasBlobUrl(node)) ?? false;
}

export function contentStatsFromText(text: string) {
  const chars = text.replace(/\n/g, "").length;
  const cjkChars = (text.match(CJK_CHAR) || []).length;
  const textWithoutCjk = text.replace(CJK_CHAR, " ");
  const englishWords = textWithoutCjk.split(/\s+/).filter(Boolean).length;
  return { chars, words: cjkChars + englishWords };
}

// New drafts are created as `untitled-log`, `untitled-log-N`, or with a random
// suffix after a contended insert.
const PLACEHOLDER_SLUG = /^untitled-log(?:-[a-z0-9]+)*$/;

/**
 * Whether a title change should regenerate the slug. A published post keeps
 * its slug, since there is no redirect from an old public slug.
 */
export function shouldAutogenerateSlug(
  slug: string,
  lastAutoSlug: string | null,
  published = false,
) {
  if (published) return false;
  const trimmed = slug.trim();
  return (
    trimmed.length === 0 ||
    PLACEHOLDER_SLUG.test(trimmed) ||
    lastAutoSlug === trimmed
  );
}
