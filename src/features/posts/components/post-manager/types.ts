import type { Post } from "@/lib/db/schema";

/** Post fields used by admin list rows. */
export type AdminPostListItem = Omit<
  Post,
  | "contentJson"
  | "publicSnapshotJson"
  | "coverMediaId"
  | "categoryId"
  | "publicCategoryId"
  | "saveToken"
  | "draftFingerprint"
  | "publishedFingerprint"
> & {
  /** A published post whose draft differs from what is live. */
  hasUnpublishedChanges: boolean;
};

/** Status filter options for posts list */
export const STATUS_FILTERS = ["ALL", "PUBLISHED", "CHANGED", "DRAFT"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

/** Sort fields options */
export const SORT_FIELDS = ["publishedAt", "updatedAt"] as const;
export type SortField = (typeof SORT_FIELDS)[number];

/** A category id, or "none" for posts without one. */
export type CategoryFilter = number | "none";

/**
 * Convert StatusFilter to the list API's filters. "CHANGED" selects published
 * posts with Unpublished Changes, which the server filters on its own.
 */
export function statusFilterToApi(filter: StatusFilter): {
  status?: "published" | "draft";
  hasUnpublishedChanges?: true;
} {
  switch (filter) {
    case "ALL":
      return {};
    case "PUBLISHED":
      return { status: "published" };
    case "CHANGED":
      return { hasUnpublishedChanges: true };
    case "DRAFT":
      return { status: "draft" };
  }
}
