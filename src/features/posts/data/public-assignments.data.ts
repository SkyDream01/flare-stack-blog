import type { SQL } from "drizzle-orm";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { Tag } from "@/lib/db/schema";
import {
  CategoriesTable,
  PostPublicTagsTable,
  PostsTable,
  TagsTable,
} from "@/lib/db/schema";

// A Post's public assignments are the Category and Tags its Public Content
// Snapshot assigns (ADR 0033). Publishing writes them, unpublishing clears
// them, and deleting a Category or Tag removes it through the foreign keys.
// Public reads, filters and counts use them; the draft's `categoryId` and
// `post_tags` are the Current Assignment.

export type PublicAssignment = {
  category: { id: number; name: string } | null;
  tags: Array<Tag>;
};

/**
 * The public Category and Tags of the given Posts, or of every Post when no
 * ids are given. Tags are in id order.
 */
export async function findPublicAssignments(
  db: DB,
  postIds?: Array<number>,
): Promise<Map<number, PublicAssignment>> {
  if (postIds?.length === 0) return new Map();
  const [categories, tags] = await Promise.all([
    db
      .select({
        postId: PostsTable.id,
        id: CategoriesTable.id,
        name: CategoriesTable.name,
      })
      .from(PostsTable)
      .innerJoin(
        CategoriesTable,
        eq(CategoriesTable.id, PostsTable.publicCategoryId),
      )
      .where(postIds ? inArray(PostsTable.id, postIds) : undefined),
    db
      .select({
        postId: PostPublicTagsTable.postId,
        id: TagsTable.id,
        name: TagsTable.name,
        createdAt: TagsTable.createdAt,
      })
      .from(PostPublicTagsTable)
      .innerJoin(TagsTable, eq(TagsTable.id, PostPublicTagsTable.tagId))
      .where(postIds ? inArray(PostPublicTagsTable.postId, postIds) : undefined)
      .orderBy(asc(PostPublicTagsTable.postId), asc(TagsTable.id)),
  ]);

  const byPost = new Map<number, PublicAssignment>();
  const of = (postId: number) => {
    let assignment = byPost.get(postId);
    if (!assignment) {
      assignment = { category: null, tags: [] };
      byPost.set(postId, assignment);
    }
    return assignment;
  };
  for (const { postId, ...category } of categories) {
    of(postId).category = category;
  }
  for (const { postId, ...tag } of tags) {
    of(postId).tags.push(tag);
  }
  return byPost;
}

/** The Post publicly carries this Tag. */
export function hasPublicTag(tagId: number): SQL {
  return sql`EXISTS (SELECT 1 FROM ${PostPublicTagsTable} WHERE ${PostPublicTagsTable.postId} = ${PostsTable.id} AND ${PostPublicTagsTable.tagId} = ${tagId})`;
}

/**
 * The Post publicly carries a Tag of this name, ignoring case: a public page
 * is addressed by name, and a name in the wrong case is still that Tag.
 */
export function hasPublicTagNamed(tagName: string): SQL {
  return sql`EXISTS (
    SELECT 1
    FROM ${PostPublicTagsTable}
    JOIN ${TagsTable} ON ${TagsTable.id} = ${PostPublicTagsTable.tagId}
    WHERE ${PostPublicTagsTable.postId} = ${PostsTable.id} AND lower(${TagsTable.name}) = lower(${tagName})
  )`;
}

/** The Post's public Category has this name, ignoring case. */
export function hasPublicCategoryNamed(categoryName: string): SQL {
  return sql`EXISTS (
    SELECT 1
    FROM ${CategoriesTable}
    WHERE ${CategoriesTable.id} = ${PostsTable.publicCategoryId}
      AND lower(${CategoriesTable.name}) = lower(${categoryName})
  )`;
}

/**
 * The public Category to write with a snapshot: null when it was deleted
 * after the Post was read, so publishing never fails on a foreign key.
 */
export function publicCategoryValue(categoryId: number | null): SQL | null {
  if (categoryId === null) return null;
  return sql`(SELECT ${CategoriesTable.id} FROM ${CategoriesTable} WHERE ${CategoriesTable.id} = ${categoryId})`;
}

/**
 * Replaces the Post's public Tags, for a batch that first writes its Public
 * Content Snapshot and sets `saveToken`. Each statement runs only while the
 * Post carries that token, that is, only when that write matched: a publish
 * refused by its stated saveToken leaves the public Tags as they were. Tags
 * deleted since the Post was read are skipped.
 */
export function replacePublicTags(
  db: DB,
  postId: number,
  tagIds: Array<number>,
  saveToken: string,
): Array<BatchItem<"sqlite">> {
  const written = sql`EXISTS (SELECT 1 FROM ${PostsTable} WHERE ${PostsTable.id} = ${postId} AND ${PostsTable.saveToken} = ${saveToken})`;
  const statements: Array<BatchItem<"sqlite">> = [
    db
      .delete(PostPublicTagsTable)
      .where(and(eq(PostPublicTagsTable.postId, postId), written)),
  ];
  const ids = [...new Set(tagIds)];
  if (ids.length > 0) {
    statements.push(
      db.insert(PostPublicTagsTable).select(
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
  return statements;
}

/** Clears the Post's public Tags, for a batch that unpublishes it. */
export function clearPublicTags(db: DB, postId: number): BatchItem<"sqlite"> {
  return db
    .delete(PostPublicTagsTable)
    .where(eq(PostPublicTagsTable.postId, postId));
}
