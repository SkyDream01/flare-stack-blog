import { and, asc, count, desc, eq, inArray, ne, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { hasPublicTag } from "@/features/posts/data/public-assignments.data";
import {
  newSaveToken,
  PostPublicTagsTable,
  PostsTable,
  PostTagsTable,
  TagsTable,
} from "@/lib/db/schema";
import { keyForWrite, settleUniqueKeys, TAG_NAME } from "@/lib/db/unique-keys";
import { uniqueKeyOf } from "@/lib/unicode-text";

/**
 * Get all tags, optionally sorted
 */
export async function getAllTags(
  db: DB,
  options: {
    sortBy?: "name" | "createdAt";
    sortDir?: "asc" | "desc";
  } = {},
) {
  const { sortBy = "name", sortDir = "asc" } = options;

  const orderFn = sortDir === "asc" ? asc : desc;
  const orderColumn =
    sortBy === "createdAt" ? TagsTable.createdAt : TagsTable.name;

  return await db.select().from(TagsTable).orderBy(orderFn(orderColumn));
}

/**
 * Get all tags with their post counts
 */
export async function getAllTagsWithCount(
  db: DB,
  options: {
    sortBy?: "name" | "createdAt" | "postCount";
    sortDir?: "asc" | "desc";
    publicOnly?: boolean;
  } = {},
) {
  const { sortBy = "name", sortDir = "asc", publicOnly = false } = options;
  // Public Usage counts the public assignments, Current Assignment the draft's.
  const assignments = publicOnly ? PostPublicTagsTable : PostTagsTable;
  const query = db
    .select({
      id: TagsTable.id,
      name: TagsTable.name,
      createdAt: TagsTable.createdAt,
      postCount: count(assignments.postId).as("postCount"),
    })
    .from(TagsTable)
    .leftJoin(assignments, eq(TagsTable.id, assignments.tagId))
    .leftJoin(PostsTable, eq(PostsTable.id, assignments.postId))
    .where(
      publicOnly
        ? sql`${PostsTable.publicSnapshotJson} IS NOT NULL`
        : undefined,
    )
    .groupBy(TagsTable.id)
    .$dynamic();

  const orderFn = sortDir === "asc" ? asc : desc;

  if (sortBy === "postCount") {
    query.orderBy(orderFn(sql`postCount`));
  } else if (sortBy === "createdAt") {
    query.orderBy(orderFn(TagsTable.createdAt));
  } else {
    query.orderBy(orderFn(TagsTable.name));
  }

  return await query;
}

/**
 * Find a tag by ID
 */
export async function findTagById(db: DB, id: number) {
  return await db.query.TagsTable.findFirst({
    where: eq(TagsTable.id, id),
  });
}

/**
 * Insert a new tag
 */
export async function insertTag(db: DB, data: { name: string }) {
  const [tag] = await db
    .insert(TagsTable)
    .values({ name: data.name, nameKey: uniqueKeyOf(data.name) })
    .returning();
  return tag;
}

/**
 * Update a tag
 */
export async function updateTag(db: DB, id: number, data: { name?: string }) {
  const [tag] = await db
    .update(TagsTable)
    .set(
      data.name === undefined
        ? {}
        : {
            name: data.name,
            nameKey: keyForWrite(TagsTable.name, TagsTable.nameKey, data.name),
          },
    )
    .where(eq(TagsTable.id, id))
    .returning();
  return tag;
}

/**
 * Delete a tag
 */
export async function deleteTag(db: DB, id: number) {
  // The Tag leaves the Posts that carry it, in the draft or publicly, so their
  // Unpublished Changes are decided again without it. Touching them replaces their saveToken like
  // any other write; updatedAt stays.
  await db.batch([
    db
      .update(PostsTable)
      .set({
        draftFingerprint: null,
        publishedFingerprint: null,
        updatedAt: sql`${PostsTable.updatedAt}`,
      })
      .where(
        sql`${PostsTable.id} IN (SELECT ${PostTagsTable.postId} FROM ${PostTagsTable} WHERE ${PostTagsTable.tagId} = ${id})
          OR ${PostsTable.id} IN (SELECT ${PostPublicTagsTable.postId} FROM ${PostPublicTagsTable} WHERE ${PostPublicTagsTable.tagId} = ${id})`,
      ),
    db.delete(TagsTable).where(eq(TagsTable.id, id)),
  ]);
}

/**
 * Get tags for a specific post
 */
export async function getTagsByPostId(db: DB, postId: number) {
  const results = await db
    .select({
      id: TagsTable.id,
      name: TagsTable.name,
      createdAt: TagsTable.createdAt,
    })
    .from(PostTagsTable)
    .innerJoin(TagsTable, eq(PostTagsTable.tagId, TagsTable.id))
    .where(eq(PostTagsTable.postId, postId))
    .orderBy(asc(TagsTable.name));

  return results;
}

/**
 * Replaces the Post's draft Tags and the Post's saveToken in one batch (one
 * transaction). The token update is the only guarded statement: it matches the
 * Post, with `saveToken` only while the Post still carries it, and only while
 * every Tag in `tagIds` exists. It sets the new token explicitly, and the Tag
 * statements run only while the Post carries that token, that is, only when
 * the update matched, so a refused save leaves the Tags as they were.
 *
 * Returns the Post's new saveToken, or null when nothing was written: the Post
 * does not exist, it no longer carries the stated `saveToken`, or a Tag does
 * not exist.
 */
export async function setPostTags(
  db: DB,
  postId: number,
  tagIds: Array<number>,
  options: { saveToken?: string } = {},
) {
  const saveToken = newSaveToken();
  const ids = [...new Set(tagIds)];
  const tokenWrite = db
    .update(PostsTable)
    .set({ updatedAt: new Date(), draftFingerprint: null, saveToken })
    .where(
      and(
        eq(PostsTable.id, postId),
        options.saveToken === undefined
          ? undefined
          : eq(PostsTable.saveToken, options.saveToken),
        ids.length === 0
          ? undefined
          : sql`(SELECT count(*) FROM ${TagsTable} WHERE ${inArray(TagsTable.id, ids)}) = ${ids.length}`,
      ),
    )
    .returning({ saveToken: PostsTable.saveToken });
  const written = sql`EXISTS (SELECT 1 FROM ${PostsTable} WHERE ${PostsTable.id} = ${postId} AND ${PostsTable.saveToken} = ${saveToken})`;

  const tagWrites: Array<BatchItem<"sqlite">> = [
    db
      .delete(PostTagsTable)
      .where(and(eq(PostTagsTable.postId, postId), written)),
  ];
  if (ids.length > 0) {
    tagWrites.push(
      db.insert(PostTagsTable).select(
        db
          .select({
            postId: sql<number>`${postId}`.as("post_id"),
            tagId: TagsTable.id,
          })
          .from(TagsTable)
          .where(and(inArray(TagsTable.id, ids), written)),
      ),
    );
  }

  const [[row]] = await db.batch([tokenWrite, ...tagWrites]);
  return row?.saveToken ?? null;
}

/** The ids in `ids` no Tag has. */
export async function findMissingTagIds(db: DB, ids: Array<number>) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  const found = await db
    .select({ id: TagsTable.id })
    .from(TagsTable)
    .where(inArray(TagsTable.id, unique));
  const existing = new Set(found.map((tag) => tag.id));
  return unique.filter((id) => !existing.has(id));
}

/**
 * Whether another Tag has `name`, compared by its unique key: ignoring case
 * and NFKC forms.
 */
export async function nameExists(
  db: DB,
  name: string,
  options: { excludeId?: number } = {},
): Promise<boolean> {
  const { excludeId } = options;
  await settleUniqueKeys(db, TAG_NAME);
  const conditions = [eq(TagsTable.nameKey, uniqueKeyOf(name))];
  if (excludeId) {
    conditions.push(ne(TagsTable.id, excludeId));
  }
  const results = await db
    .select({ id: TagsTable.id })
    .from(TagsTable)
    .where(and(...conditions))
    .limit(1);
  return results.length > 0;
}

/**
 * Published Posts that publicly show the Tag (its Public Usage), for cache
 * invalidation.
 */
export async function getPublishedPostsByTagId(db: DB, tagId: number) {
  const results = await db
    .select({
      id: PostsTable.id,
      slug: sql<string>`coalesce(${PostsTable.publicSlug}, ${PostsTable.slug})`.as(
        "slug",
      ),
    })
    .from(PostsTable)
    .where(
      and(
        hasPublicTag(tagId),
        sql`${PostsTable.publicSnapshotJson} IS NOT NULL`,
      ),
    );

  return results;
}
