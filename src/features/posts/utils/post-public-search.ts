import {
  normalizePostCategoryName,
  normalizePostTagName,
} from "@/features/posts/schema/posts.schema";

export type PostsPublicSearch = {
  tagName?: string;
  categoryName?: string;
  uncategorized?: boolean;
};

export function withTagFilter(tagName: string | undefined): PostsPublicSearch {
  const name = normalizePostTagName(tagName);
  return name ? { tagName: name } : {};
}

export function withCategoryFilter(
  categoryName: string | undefined,
): PostsPublicSearch {
  const name = normalizePostCategoryName(categoryName);
  return name ? { categoryName: name } : {};
}

export function withUncategorizedFilter(): PostsPublicSearch {
  return { uncategorized: true };
}

/**
 * The name a public page is addressed by, as the Tag or Category spells it:
 * an exact match first, else one that differs only in case. `null` when no
 * name matches, which is a page that does not exist. `undefined` stays
 * `undefined`: no filter.
 */
export function resolvePublicName(
  names: ReadonlyArray<string>,
  requested: string | undefined,
): string | null | undefined {
  if (requested === undefined) return undefined;
  if (names.includes(requested)) return requested;
  const lowered = requested.toLowerCase();
  return names.find((name) => name.toLowerCase() === lowered) ?? null;
}

/** The Tag or Category a public posts page was asked for but does not exist. */
export type MissingPublicFilter = { kind: "tag" | "category"; name: string };

export function isMissingPublicFilter(
  value: unknown,
): value is MissingPublicFilter {
  if (typeof value !== "object" || value === null) return false;
  const { kind, name } = value as Partial<MissingPublicFilter>;
  return (kind === "tag" || kind === "category") && typeof name === "string";
}

/**
 * The filter that makes a public posts page not exist, from the names
 * `resolvePublicName` resolved and the ones requested. A Tag is named before a
 * Category when neither exists. `null` when every requested name exists.
 */
export function findMissingPublicFilter(
  resolved: {
    tagName: string | null | undefined;
    categoryName: string | null | undefined;
  },
  requested: { tagName?: string; categoryName?: string },
): MissingPublicFilter | null {
  if (resolved.tagName === null && requested.tagName !== undefined) {
    return { kind: "tag", name: requested.tagName };
  }
  if (resolved.categoryName === null && requested.categoryName !== undefined) {
    return { kind: "category", name: requested.categoryName };
  }
  return null;
}
