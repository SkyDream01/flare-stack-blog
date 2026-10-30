import type { Tag } from "@/lib/db/schema";
import type {
  PublicPostCover,
  PublicPostSnapshot,
} from "@/lib/db/schema/posts.table";
import { estimateReadTimeMinutes } from "@/features/posts/utils/content";
import type { PostItem } from "@/features/posts/schema/posts.schema";

export function toPublicCover(
  cover: PublicPostCover | null | undefined,
): PostItem["cover"] {
  if (!cover) return null;
  return {
    key: cover.key,
    url: cover.url,
    width: cover.width,
    height: cover.height,
  };
}

export function toIsoOrNull(
  value: Date | string | null | undefined,
): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

/**
 * When the public site last changed the Post: the snapshot's last
 * publication, or its publication date for a snapshot written before that was
 * recorded. Never the draft's updatedAt, which would show edits nobody has
 * published.
 */
export function publicModifiedAt(snapshot: PublicPostSnapshot) {
  return new Date(snapshot.lastPublishedAt ?? snapshot.publishedAt);
}

export function mapSnapshotToPublicPost(
  row: {
    id: number;
    status: "draft" | "published";
    createdAt: Date;
    pinnedAt: Date | null;
    publicSnapshotJson: PublicPostSnapshot | null;
  },
  tags: Array<Tag> = [],
  category: { id: number; name: string } | null = null,
): PostItem | null {
  const snapshot = row.publicSnapshotJson;
  if (!snapshot) return null;

  return {
    id: row.id,
    title: snapshot.title,
    summary: snapshot.summary,
    slug: snapshot.slug,
    status: "published",
    publishedAt: new Date(snapshot.publishedAt),
    pinnedAt: row.pinnedAt,
    createdAt: row.createdAt,
    updatedAt: publicModifiedAt(snapshot),
    readTimeInMinutes: estimateReadTimeMinutes(snapshot.contentJson),
    tags,
    category,
    cover: toPublicCover(snapshot.cover),
  };
}
