import type { JSONContent } from "@tiptap/react";

export async function calculatePostHash(post: {
  title: string;
  contentJson: JSONContent | null;
  summary: string | null;
  tagIds: Array<number>;
  slug: string;
  publishedAt: Date | string | null;
  pinnedAt?: Date | string | null;
  coverMediaId?: number | null;
  categoryId?: number | null;
}): Promise<string> {
  const toISOOrNull = (d: Date | string | null) =>
    d instanceof Date ? d.toISOString() : d;

  const stateToHash = {
    title: post.title,
    contentJson: post.contentJson,
    summary: post.summary,
    // String order, not numeric: stored revision hashes were computed with
    // the default sort, and must keep matching.
    tagIds: post.tagIds.map(String).sort().map(Number),
    slug: post.slug,
    publishedAt: toISOOrNull(post.publishedAt),
    pinnedAt: toISOOrNull(post.pinnedAt ?? null),
    coverMediaId: post.coverMediaId ?? null,
    categoryId: post.categoryId ?? null,
  };

  const msgUint8 = new TextEncoder().encode(JSON.stringify(stateToHash));
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Fingerprint of what a publish makes public: title, summary, slug, content,
 * publication date, cover, Category and Tags. Pin is not part of it. The
 * date is cut to the second because the column stores seconds, so the draft
 * as written and as read back agree.
 */
export function calculateDraftFingerprint(post: {
  title: string;
  contentJson: JSONContent | null;
  summary: string | null;
  tagIds: Array<number>;
  slug: string;
  publishedAt: Date | string | null;
  coverMediaId?: number | null;
  categoryId?: number | null;
}): Promise<string> {
  const publishedAt =
    post.publishedAt == null ? null : new Date(post.publishedAt);
  return calculatePostHash({
    title: post.title,
    contentJson: post.contentJson,
    summary: post.summary,
    tagIds: post.tagIds,
    slug: post.slug,
    publishedAt: publishedAt
      ? new Date(Math.floor(publishedAt.getTime() / 1000) * 1000)
      : null,
    coverMediaId: post.coverMediaId,
    categoryId: post.categoryId,
  });
}
