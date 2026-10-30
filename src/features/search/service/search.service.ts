import { inArray, isNotNull } from "drizzle-orm";
import * as PublicAssignmentRepo from "@/features/posts/data/public-assignments.data";
import { convertToPlainText } from "@/features/posts/utils/content";
import * as SearchRepo from "@/features/search/data/search.data";
import {
  CONTENT_SLICE,
  SNIPPET_SLICE,
} from "@/features/search/search.constants";
import type {
  DeleteSearchDocInput,
  SearchQueryInput,
  UpsertSearchDocInput,
} from "@/features/search/search.schema";
import {
  queryTerms,
  toFtsMatchQuery,
  tokenizeForSearch,
} from "@/features/search/tokenize";
import { buildSnippet } from "@/features/search/utils/search.utils";
import { PostsTable } from "@/lib/db/schema";

function toIndexedDocument(
  data: UpsertSearchDocInput,
): Parameters<typeof SearchRepo.upsertSearchDocument>[1] {
  const plain = convertToPlainText(data.contentJson ?? null);
  const indexed = [data.category?.trim(), plain].filter(Boolean).join("\n");
  const content =
    indexed.length > CONTENT_SLICE ? indexed.slice(0, CONTENT_SLICE) : indexed;
  const summary =
    data.summary && data.summary.trim().length > 0
      ? data.summary
      : content.slice(0, SNIPPET_SLICE);

  return {
    postId: data.id,
    slug: data.slug,
    title: data.title,
    summary,
    content,
    tags: data.tags ?? [],
    tokens: tokenizeForSearch(
      data.title,
      summary,
      content,
      data.category,
      ...(data.tags ?? []),
    ),
  };
}

export async function search(context: DbContext, data: SearchQueryInput) {
  const match = toFtsMatchQuery(data.q);
  if (!match) return [];

  const rows = await SearchRepo.matchSearchDocuments(
    context.env,
    match,
    Math.min(data.limit, 25),
  );
  const terms = queryTerms(data.q);

  return rows.map((row) => ({
    post: {
      id: row.postId,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      tags: row.tags,
    },
    score: 0,
    matches: {
      title: buildSnippet({
        text: row.title,
        terms,
        fallbackTerm: data.q,
      }),
      summary: buildSnippet({
        text: row.summary,
        terms,
        fallbackTerm: data.q,
      }),
      contentSnippet: buildSnippet({
        text: row.content,
        terms,
        fallbackTerm: data.q,
      }),
    },
  }));
}

export async function upsert(
  context: { env: Env; db: DB },
  data: UpsertSearchDocInput,
) {
  await SearchRepo.upsertSearchDocument(context.db, toIndexedDocument(data));
  return { id: data.id };
}

export async function deleteIndex(
  context: { env: Env; db: DB },
  data: DeleteSearchDocInput,
) {
  await SearchRepo.deleteSearchDocument(context.db, data.id);
  return { id: data.id };
}

// Posts read per query, so the ids bound to one statement stay far below D1's
// limit of 100 bound values.
const REINDEX_CHUNK = 50;

/**
 * The documents of the given Published Posts, or of every one when no ids are
 * given. Title, summary and content come from the Public Content Snapshot, the
 * Category and Tags from the public assignments (ADR 0033). A Post with
 * nothing to index is left out.
 */
async function buildDocuments(db: DB, postIds?: Array<number>) {
  const [posts, assignments] = await Promise.all([
    db
      .select({
        id: PostsTable.id,
        publicSnapshotJson: PostsTable.publicSnapshotJson,
      })
      .from(PostsTable)
      .where(
        postIds
          ? inArray(PostsTable.id, postIds)
          : isNotNull(PostsTable.publicSnapshotJson),
      ),
    PublicAssignmentRepo.findPublicAssignments(db, postIds),
  ]);

  const documents = [];
  for (const post of posts) {
    const snapshot = post.publicSnapshotJson;
    if (!snapshot?.title || !snapshot.slug) continue;
    const assignment = assignments.get(post.id);
    const tags = assignment?.tags.map((tag) => tag.name) ?? [];
    const categoryName = assignment?.category?.name ?? null;

    documents.push(
      toIndexedDocument({
        id: post.id,
        slug: snapshot.slug,
        title: snapshot.title,
        summary: snapshot.summary,
        contentJson: snapshot.contentJson,
        tags,
        category: categoryName,
      }),
    );
  }
  return documents;
}

export async function rebuildIndex(context: DbContext) {
  const { db } = context;
  const start = Date.now();

  const documents = await buildDocuments(db);
  await SearchRepo.replaceSearchDocuments(db, documents);

  const duration = Date.now() - start;
  console.log(`[search] Indexed ${documents.length} posts in ${duration}ms`);

  return { indexed: documents.length, duration };
}

/**
 * Brings the documents of the given Posts up to date with what the public site
 * shows now. A Category or Tag that is renamed or deleted changes the public
 * label of the Published Posts in its Public Usage without republishing them,
 * so the search index follows here. A Post that is not published, or has
 * nothing to index, leaves the index. The cost is bounded by the number of
 * Posts and the indexed content length per Post, and the writes are batched.
 */
export async function reindexPosts(
  context: { env: Env; db: DB },
  postIds: Array<number>,
) {
  const ids = [...new Set(postIds)];
  const documents = [];
  const removedPostIds = [];
  for (let i = 0; i < ids.length; i += REINDEX_CHUNK) {
    const chunk = ids.slice(i, i + REINDEX_CHUNK);
    const built = await buildDocuments(context.db, chunk);
    const indexed = new Set(built.map((document) => document.postId));
    documents.push(...built);
    removedPostIds.push(...chunk.filter((id) => !indexed.has(id)));
  }
  await SearchRepo.applySearchDocuments(context.db, {
    documents,
    removedPostIds,
  });
  return { reindexed: documents.length };
}

export async function getIndexVersion(context: DbContext) {
  return { version: await SearchRepo.readSearchIndexVersion(context.db) };
}
