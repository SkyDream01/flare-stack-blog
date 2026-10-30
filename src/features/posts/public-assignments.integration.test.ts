import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import {
  createAdminTestContext,
  createTestContext,
  seedUser,
  waitForBackgroundTasks,
} from "tests/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { purgeWorkersCache } from "@/features/cache/workers-cache";
import * as CategoryService from "@/features/categories/categories.service";
import * as CategoryRepo from "@/features/categories/data/categories.data";
import * as PostRepo from "@/features/posts/data/posts.data";
import * as PostRevisionService from "@/features/posts/services/post-revisions.service";
import * as PostService from "@/features/posts/services/posts.service";
import type { PostItem } from "@/features/posts/schema/posts.schema";
import * as SearchService from "@/features/search/service/search.service";
import * as TagRepo from "@/features/tags/data/tags.data";
import * as TagService from "@/features/tags/tags.service";
import {
  CategoriesTable,
  PostPublicTagsTable,
  PostsTable,
  PostTagsTable,
  TagsTable,
  type PublicPostSnapshot,
} from "@/lib/db/schema";
import { unwrap } from "@/lib/errors";

/**
 * A Post's Category and Tags publish with it (ADR 0033): changing them changes
 * the draft only, while creating, renaming and deleting a Category or Tag take
 * effect on the public site at once.
 */

type AdminContext = ReturnType<typeof createAdminTestContext>;

const byId = (a: number, b: number) => a - b;

async function createCategory(admin: AdminContext, name: string) {
  return unwrap(await CategoryService.createCategory(admin, { name }));
}

async function createTag(admin: AdminContext, name: string) {
  return unwrap(await TagService.createTag(admin, { name }));
}

async function createPublishedPost(
  admin: AdminContext,
  slug: string,
  assignment: { categoryId: number | null; tagIds: Array<number> },
) {
  const { id } = await PostService.createEmptyPost(admin);
  unwrap(
    await PostService.updatePost(admin, {
      id,
      data: {
        title: `Title ${slug}`,
        slug,
        categoryId: assignment.categoryId,
        publishedAt: new Date(Date.now() - 60_000),
      },
    }),
  );
  await TagService.setPostTags(admin, {
    postId: id,
    tagIds: assignment.tagIds,
  });
  unwrap(await PostService.publishPost(admin, { id }));
  return id;
}

async function findPublicPost(db: DB, slug: string) {
  const post = await PostRepo.findPostBySlug(db, slug, { publicOnly: true });
  return post as PostItem | null;
}

/**
 * Everything the public site shows of the taxonomy, read past the public
 * caches so an unpurged cache cannot hide a change.
 */
async function publicView(admin: AdminContext, slug: string) {
  const db = admin.db;
  const listed = async (
    filter: Parameters<typeof PostRepo.getPostsCursor>[1],
  ) =>
    (await PostRepo.getPostsCursor(db, filter)).items.map((post) => post.slug);
  const searched = async (q: string) =>
    (await SearchService.search(admin, { q, v: "1", limit: 10 })).map(
      (result) => ({ slug: result.post.slug, tags: result.post.tags }),
    );
  const post = await findPublicPost(db, slug);
  const home = await PostRepo.getHomePosts(db, 1);
  const categories = await db.select().from(CategoriesTable);
  const tags = await db.select().from(TagsTable);
  const adminPublic = async (
    taxonomy: NonNullable<
      Parameters<typeof PostService.listAdminPostsPage>[1]["taxonomy"]
    >,
  ) =>
    (await PostService.listAdminPostsPage(admin, { taxonomy })).items.map(
      (item) => item.slug,
    );

  return {
    post: {
      category: post?.category?.name ?? null,
      tags: post?.tags?.map((tag) => tag.name) ?? [],
    },
    home: home.items.map((item) => ({
      slug: item.slug,
      category: item.category?.name ?? null,
      tags: item.tags?.map((tag) => tag.name),
    })),
    byCategory: Object.fromEntries(
      await Promise.all(
        categories.map(async (category) => [
          category.name,
          await listed({ categoryName: category.name }),
        ]),
      ),
    ),
    uncategorized: await listed({ uncategorized: true }),
    byTag: Object.fromEntries(
      await Promise.all(
        tags.map(async (tag) => [
          tag.name,
          await listed({ tagName: tag.name }),
        ]),
      ),
    ),
    categoryCounts: (
      await CategoryRepo.getAllCategoriesWithCount(db, { publicOnly: true })
    ).map((item) => [item.name, item.postCount]),
    uncategorizedCount: await CategoryRepo.countUncategorizedPosts(db, true),
    tagCounts: (
      await TagRepo.getAllTagsWithCount(db, { publicOnly: true })
    ).map((item) => [item.name, item.postCount]),
    adminPublicScope: {
      categories: Object.fromEntries(
        await Promise.all(
          categories.map(async (category) => [
            category.name,
            await adminPublic({
              kind: "category",
              id: category.id,
              scope: "public",
            }),
          ]),
        ),
      ),
      tags: Object.fromEntries(
        await Promise.all(
          tags.map(async (tag) => [
            tag.name,
            await adminPublic({ kind: "tag", id: tag.id, scope: "public" }),
          ]),
        ),
      ),
    },
    search: Object.fromEntries(
      await Promise.all(
        [...categories, ...tags].map(
          async ({ name }) => [name, await searched(name)] as const,
        ),
      ),
    ),
  };
}

async function publicRows(db: DB, id: number) {
  const [post] = await db
    .select({
      publicSnapshotJson: PostsTable.publicSnapshotJson,
      publicSlug: PostsTable.publicSlug,
      publicCategoryId: PostsTable.publicCategoryId,
      status: PostsTable.status,
    })
    .from(PostsTable)
    .where(eq(PostsTable.id, id));
  const tags = await db
    .select({ tagId: PostPublicTagsTable.tagId })
    .from(PostPublicTagsTable)
    .where(eq(PostPublicTagsTable.postId, id));
  return { ...post, tagIds: tags.map((row) => row.tagId).sort(byId) };
}

describe("Category and Tag assignments publish with the Post", () => {
  let admin: AdminContext;

  beforeEach(async () => {
    admin = createAdminTestContext();
    await seedUser(admin.db, admin.session.user);
  });

  it("keeps the public site on the published assignments until the Post is published again", async () => {
    const oldCategory = await createCategory(admin, "oldcat");
    const newCategory = await createCategory(admin, "newcat");
    const oldTag = await createTag(admin, "oldtag");
    const newTag = await createTag(admin, "newtag");
    const id = await createPublishedPost(admin, "moving", {
      categoryId: oldCategory.id,
      tagIds: [oldTag.id],
    });
    const before = await publicView(admin, "moving");
    expect(before.post).toEqual({ category: "oldcat", tags: ["oldtag"] });
    expect(before.byCategory).toEqual({ oldcat: ["moving"], newcat: [] });
    expect(before.byTag).toEqual({ oldtag: ["moving"], newtag: [] });
    expect(before.search.oldtag.map((hit) => hit.slug)).toEqual(["moving"]);
    expect(before.search.newtag).toEqual([]);

    // Warm the public caches, then change the draft's assignments.
    const reader = createTestContext();
    await PostService.findPostBySlug(reader, { slug: "moving" });
    await CategoryService.getPublicCategories(reader);
    await TagService.getPublicTags(reader);
    await waitForBackgroundTasks(reader.executionCtx);
    vi.mocked(purgeWorkersCache).mockClear();

    unwrap(
      await PostService.updatePost(admin, {
        id,
        data: { categoryId: newCategory.id },
      }),
    );
    await TagService.setPostTags(admin, { postId: id, tagIds: [newTag.id] });
    await waitForBackgroundTasks(admin.executionCtx);

    expect(purgeWorkersCache).not.toHaveBeenCalled();
    expect(await env.KV.get("public:tags:list")).not.toBeNull();
    expect(await env.KV.get("public:categories:list")).not.toBeNull();
    expect(await publicView(admin, "moving")).toEqual(before);
    // Rebuilding the Search Index reads the public assignments too.
    await SearchService.rebuildIndex(admin);
    expect(await publicView(admin, "moving")).toEqual(before);

    // The Admin still sees the new assignments as the post's current ones.
    const draft = await PostService.findPostById(admin, { id });
    expect(draft?.categoryId).toBe(newCategory.id);
    expect(draft?.tags.map((tag) => tag.id)).toEqual([newTag.id]);

    unwrap(await PostService.publishPost(admin, { id }));
    await waitForBackgroundTasks(admin.executionCtx);

    const after = await publicView(admin, "moving");
    expect(after.post).toEqual({ category: "newcat", tags: ["newtag"] });
    expect(after.home).toEqual([
      { slug: "moving", category: "newcat", tags: ["newtag"] },
    ]);
    expect(after.byCategory).toEqual({ oldcat: [], newcat: ["moving"] });
    expect(after.byTag).toEqual({ oldtag: [], newtag: ["moving"] });
    expect(after.categoryCounts).toEqual([["newcat", 1]]);
    expect(after.tagCounts).toEqual([["newtag", 1]]);
    expect(after.adminPublicScope).toEqual({
      categories: { oldcat: [], newcat: ["moving"] },
      tags: { oldtag: [], newtag: ["moving"] },
    });
    expect(after.search.oldtag).toEqual([]);
    expect(after.search.newtag).toEqual([{ slug: "moving", tags: ["newtag"] }]);

    // Publishing purges the public caches, which now serve the new ones.
    const cached = createTestContext();
    const post = await PostService.findPostBySlug(cached, { slug: "moving" });
    expect(post?.category).toEqual({ id: newCategory.id, name: "newcat" });
    expect(post?.tags?.map((tag) => tag.name)).toEqual(["newtag"]);
    expect(
      (await TagService.getPublicTags(cached)).map((tag) => tag.name),
    ).toEqual(["newtag"]);
    expect(
      (await CategoryService.getPublicCategories(cached)).map(
        (category) => category.name,
      ),
    ).toEqual(["newcat"]);
  });

  it("keeps the public assignments when a Post Revision is restored", async () => {
    const category = await createCategory(admin, "kept");
    const tag = await createTag(admin, "keptag");
    const id = await createPublishedPost(admin, "restored", {
      categoryId: null,
      tagIds: [],
    });
    unwrap(
      await PostService.updatePost(admin, {
        id,
        data: { categoryId: category.id },
      }),
    );
    await TagService.setPostTags(admin, { postId: id, tagIds: [tag.id] });
    unwrap(await PostService.publishPost(admin, { id }));
    const before = await publicView(admin, "restored");
    expect(before.post).toEqual({ category: "kept", tags: ["keptag"] });

    const revisions = await PostRevisionService.listPostRevisions(admin, {
      postId: id,
    });
    const first = revisions.at(-1)!;
    vi.mocked(purgeWorkersCache).mockClear();
    unwrap(
      await PostRevisionService.restorePostRevision(admin, {
        postId: id,
        revisionId: first.id,
      }),
    );
    await waitForBackgroundTasks(admin.executionCtx);

    const draft = await PostService.findPostById(admin, { id });
    expect(draft?.categoryId).toBeNull();
    expect(draft?.tags).toEqual([]);
    expect(purgeWorkersCache).not.toHaveBeenCalled();
    expect(await publicView(admin, "restored")).toEqual(before);
  });

  it("removes an unpublished Post from the public Category and Tag lists and counts", async () => {
    const category = await createCategory(admin, "gone");
    const tag = await createTag(admin, "gonetag");
    const id = await createPublishedPost(admin, "leaving", {
      categoryId: category.id,
      tagIds: [tag.id],
    });
    await createPublishedPost(admin, "staying", {
      categoryId: category.id,
      tagIds: [tag.id],
    });

    unwrap(await PostService.unpublishPost(admin, { id }));

    const view = await publicView(admin, "staying");
    expect(view.byCategory).toEqual({ gone: ["staying"] });
    expect(view.byTag).toEqual({ gonetag: ["staying"] });
    expect(view.categoryCounts).toEqual([["gone", 1]]);
    expect(view.tagCounts).toEqual([["gonetag", 1]]);
    expect(view.adminPublicScope).toEqual({
      categories: { gone: ["staying"] },
      tags: { gonetag: ["staying"] },
    });
    expect(await publicRows(admin.db, id)).toMatchObject({
      publicSnapshotJson: null,
      publicCategoryId: null,
      tagIds: [],
    });
    const categories = await CategoryService.getCategories(admin);
    expect(categories.items[0]).toMatchObject({
      postCount: 2,
      publicPostCount: 1,
    });
    const tags = await TagService.getTagsWithCount(admin);
    expect(tags[0]).toMatchObject({ postCount: 2, publicPostCount: 1 });
  });

  it("renames and deletes a Category or Tag on the public site at once", async () => {
    const shown = await createCategory(admin, "shown");
    const drafted = await createCategory(admin, "drafted");
    const tag = await createTag(admin, "shortlived");
    const id = await createPublishedPost(admin, "taxonomy", {
      categoryId: shown.id,
      tagIds: [tag.id],
    });
    // The draft moves to another Category; the public site still shows "shown".
    unwrap(
      await PostService.updatePost(admin, {
        id,
        data: { categoryId: drafted.id },
      }),
    );
    const reader = createTestContext();
    await TagService.getPublicTags(reader);
    await CategoryService.getPublicCategories(reader);
    await waitForBackgroundTasks(reader.executionCtx);
    vi.mocked(purgeWorkersCache).mockClear();

    unwrap(
      await CategoryService.updateCategory(admin, {
        id: shown.id,
        data: { name: "renamed" },
      }),
    );
    unwrap(
      await TagService.updateTag(admin, {
        id: tag.id,
        data: { name: "retagged" },
      }),
    );
    await waitForBackgroundTasks(admin.executionCtx);
    expect(purgeWorkersCache).toHaveBeenCalled();
    expect(await env.KV.get("public:tags:list")).toBeNull();
    expect(await env.KV.get("public:categories:list")).toBeNull();
    let view = await publicView(admin, "taxonomy");
    expect(view.post).toEqual({ category: "renamed", tags: ["retagged"] });
    expect(view.byCategory).toMatchObject({ renamed: ["taxonomy"] });
    expect(view.byTag).toEqual({ retagged: ["taxonomy"] });

    await TagService.getPublicTags(reader);
    await CategoryService.getPublicCategories(reader);
    await waitForBackgroundTasks(reader.executionCtx);
    vi.mocked(purgeWorkersCache).mockClear();
    unwrap(await CategoryService.deleteCategory(admin, { id: shown.id }));
    unwrap(await TagService.deleteTag(admin, { id: tag.id }));
    await waitForBackgroundTasks(admin.executionCtx);

    expect(purgeWorkersCache).toHaveBeenCalled();
    expect(await env.KV.get("public:tags:list")).toBeNull();
    expect(await env.KV.get("public:categories:list")).toBeNull();
    view = await publicView(admin, "taxonomy");
    expect(view.post).toEqual({ category: null, tags: [] });
    expect(view.byCategory).toEqual({ drafted: [] });
    expect(view.byTag).toEqual({});
    expect(view.uncategorized).toEqual(["taxonomy"]);
    expect(view.uncategorizedCount).toBe(1);
    expect(view.categoryCounts).toEqual([]);
    expect(view.tagCounts).toEqual([]);
    // The draft keeps the Category it moved to.
    expect((await PostService.findPostById(admin, { id }))?.categoryId).toBe(
      drafted.id,
    );
  });

  it("writes neither the snapshot nor the public assignments when the saveToken is stale", async () => {
    const oldCategory = await createCategory(admin, "before");
    const newCategory = await createCategory(admin, "after");
    const oldTag = await createTag(admin, "beforetag");
    const newTag = await createTag(admin, "aftertag");
    const id = await createPublishedPost(admin, "guarded", {
      categoryId: oldCategory.id,
      tagIds: [oldTag.id],
    });
    const read = await PostRepo.findPostById(admin.db, id);
    const staleToken = read!.saveToken;
    const published = await publicRows(admin.db, id);
    expect(published).toMatchObject({
      publicCategoryId: oldCategory.id,
      tagIds: [oldTag.id],
    });

    // A save lands between the read and the publish.
    await TagService.setPostTags(admin, {
      postId: id,
      tagIds: [newTag.id],
    });
    const snapshot: PublicPostSnapshot = {
      ...read!.publicSnapshotJson!,
      title: "Unread",
      categoryId: newCategory.id,
      tagIds: [newTag.id],
    };
    expect(
      await PostRepo.writePublicSnapshot(admin.db, id, snapshot, {
        saveToken: staleToken,
      }),
    ).toBeNull();
    expect(await publicRows(admin.db, id)).toEqual(published);

    const conflict = await PostService.publishPost(admin, {
      id,
      saveToken: staleToken,
    });
    expect(conflict.error?.reason).toBe("EDIT_CONFLICT");
    expect(await publicRows(admin.db, id)).toEqual(published);

    // With the current token the same write goes through, all of it.
    const currentToken = await PostRepo.findPostSaveToken(admin.db, id);
    expect(
      await PostRepo.writePublicSnapshot(admin.db, id, snapshot, {
        saveToken: currentToken!,
      }),
    ).not.toBeNull();
    expect(await publicRows(admin.db, id)).toMatchObject({
      publicSnapshotJson: { title: "Unread" },
      publicCategoryId: newCategory.id,
      tagIds: [newTag.id],
    });
  });

  it("publishes without the Category or Tags deleted after the Post was read", async () => {
    const category = await createCategory(admin, "vanishing");
    const kept = await createTag(admin, "kepttag");
    const vanishing = await createTag(admin, "vanishingtag");
    const id = await createPublishedPost(admin, "racing", {
      categoryId: null,
      tagIds: [],
    });
    const read = await PostRepo.findPostById(admin.db, id);
    await admin.db
      .delete(CategoriesTable)
      .where(eq(CategoriesTable.id, category.id));
    await admin.db.delete(TagsTable).where(eq(TagsTable.id, vanishing.id));

    const written = await PostRepo.writePublicSnapshot(admin.db, id, {
      ...read!.publicSnapshotJson!,
      categoryId: category.id,
      tagIds: [kept.id, vanishing.id],
    });

    expect(written).not.toBeNull();
    expect(await publicRows(admin.db, id)).toMatchObject({
      publicCategoryId: null,
      tagIds: [kept.id],
    });
  });
});

describe("migration 0025 public assignments", () => {
  it("fills the public assignments so the public site is unchanged", async () => {
    const context = createTestContext();
    const db = context.db;
    const migration = env.TEST_MIGRATIONS.find((item) =>
      item.name.startsWith("0025_"),
    );
    expect(migration).toBeDefined();
    // The schema is already migrated; replay the backfill on posts written
    // the way they were before it, with no public assignments.
    const backfill = migration!.queries.filter(
      (query) => !/^(\s*--[^\n]*\n)*\s*(ALTER|CREATE)\b/i.test(query),
    );
    expect(backfill).toHaveLength(2);

    // "unused" is assigned to no Post and stays out of the public counts.
    const [first, second] = await db
      .insert(CategoriesTable)
      .values([{ name: "first" }, { name: "second" }, { name: "unused" }])
      .returning();
    const [one, two, three] = await db
      .insert(TagsTable)
      .values([{ name: "one" }, { name: "two" }, { name: "three" }])
      .returning();
    const snapshot = (
      slug: string,
      day: number,
      stale: { categoryId: number | null; tagIds: Array<number> },
    ): PublicPostSnapshot => ({
      title: slug,
      summary: null,
      slug,
      contentJson: null,
      ...stale,
      publishedAt: `2026-09-0${day}T12:00:00.000Z`,
      cover: null,
    });
    const [tagged, plain, draft] = await db
      .insert(PostsTable)
      .values([
        {
          title: "tagged",
          slug: "tagged",
          status: "published",
          categoryId: first.id,
          publicSlug: "tagged",
          // Older snapshots kept ids the public site no longer read.
          publicSnapshotJson: snapshot("tagged", 2, {
            categoryId: second.id,
            tagIds: [three.id],
          }),
        },
        {
          title: "plain",
          slug: "plain",
          status: "published",
          publicSlug: "plain",
          publicSnapshotJson: snapshot("plain", 1, {
            categoryId: null,
            tagIds: [],
          }),
        },
        {
          title: "draft",
          slug: "draft",
          status: "draft",
          categoryId: second.id,
        },
      ])
      .returning();
    await db.insert(PostTagsTable).values([
      { postId: tagged.id, tagId: two.id },
      { postId: tagged.id, tagId: one.id },
      { postId: draft.id, tagId: three.id },
    ]);
    // What the public site showed before: the current assignments of
    // Published Posts.
    const current = async (id: number) => {
      const post = await PostRepo.findPostById(db, id);
      return {
        category: post?.category
          ? { id: post.category.id, name: post.category.name }
          : null,
        tags: post!.tags.sort((a, b) => byId(a.id, b.id)),
      };
    };
    const expected = [await current(tagged.id), await current(plain.id)];

    await env.DB.batch(backfill.map((query) => env.DB.prepare(query)));

    const listed = await PostRepo.getPostsCursor(db, {});
    expect(listed.items.map((item) => item.slug)).toEqual(["tagged", "plain"]);
    expect(
      listed.items.map((item) => ({
        category: item.category,
        tags: item.tags,
      })),
    ).toEqual(expected);
    const post = await findPublicPost(db, "tagged");
    expect({ category: post?.category, tags: post?.tags }).toEqual(expected[0]);
    expect(
      (await PostRepo.getPostsCursor(db, { categoryName: "first" })).items.map(
        (item) => item.slug,
      ),
    ).toEqual(["tagged"]);
    expect(
      (await PostRepo.getPostsCursor(db, { categoryName: "second" })).items,
    ).toEqual([]);
    expect(
      (await PostRepo.getPostsCursor(db, { uncategorized: true })).items.map(
        (item) => item.slug,
      ),
    ).toEqual(["plain"]);
    expect(
      (await PostRepo.getPostsCursor(db, { tagName: "three" })).items,
    ).toEqual([]);
    expect(
      (
        await CategoryRepo.getAllCategoriesWithCount(db, { publicOnly: true })
      ).map((item) => [item.name, item.postCount]),
    ).toEqual([["first", 1]]);
    expect(await CategoryRepo.countUncategorizedPosts(db, true)).toBe(1);
    expect(
      (await TagRepo.getAllTagsWithCount(db, { publicOnly: true })).map(
        (item) => [item.name, item.postCount],
      ),
    ).toEqual([
      ["one", 1],
      ["two", 1],
    ]);
    // The snapshot's copy of the ids now matches, and drafts gain nothing.
    expect(await publicRows(db, tagged.id)).toMatchObject({
      publicCategoryId: first.id,
      publicSnapshotJson: { categoryId: first.id, tagIds: [one.id, two.id] },
      tagIds: [one.id, two.id],
    });
    expect(await publicRows(db, plain.id)).toMatchObject({
      publicCategoryId: null,
      publicSnapshotJson: { title: "plain", categoryId: null, tagIds: [] },
      tagIds: [],
    });
    expect(await publicRows(db, draft.id)).toMatchObject({
      publicSnapshotJson: null,
      publicCategoryId: null,
      tagIds: [],
    });
  });
});
