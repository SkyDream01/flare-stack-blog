import { describe, expect, it } from "vitest";
import { createTestContext } from "tests/test-utils";
import {
  CategoriesTable,
  PostPublicTagsTable,
  PostsTable,
  PostTagsTable,
  TagsTable,
  type PublicPostSnapshot,
} from "@/lib/db/schema";
import * as Categories from "@/features/categories/categories.service";
import * as Tags from "@/features/tags/tags.service";
import * as TagRepo from "@/features/tags/data/tags.data";
import * as CategoryRepo from "@/features/categories/data/categories.data";
import * as PostRepo from "@/features/posts/data/posts.data";
import * as Posts from "@/features/posts/services/posts.service";

function snapshot(
  categoryId: number | null,
  tagIds: number[],
  title: string,
  slug: string,
  day = 1,
): PublicPostSnapshot {
  return {
    categoryId,
    tagIds,
    title,
    slug,
    summary: null,
    contentJson: null,
    publishedAt: `2026-09-0${day}T12:00:00Z`,
    cover: null,
  };
}

describe("Admin taxonomy scopes", () => {
  it("counts public usage from the public assignments, not the draft's current ones", async () => {
    const context = createTestContext();
    const db = context.db;
    const [a, b] = await db
      .insert(CategoriesTable)
      .values([{ name: "A" }, { name: "B" }])
      .returning();
    const [tagA, tagB] = await db
      .insert(TagsTable)
      .values([{ name: "A" }, { name: "B" }])
      .returning();
    const [moved, draft, shared] = await db
      .insert(PostsTable)
      .values([
        {
          title: "Edited title",
          slug: "edited",
          categoryId: b.id,
          publicCategoryId: a.id,
          status: "published",
          publishedAt: new Date("2026-09-10"),
          publicSlug: "public",
          publicSnapshotJson: snapshot(
            a.id,
            [tagA.id],
            "Public %_ title",
            "public",
          ),
        },
        {
          title: "Draft title",
          slug: "draft",
          categoryId: a.id,
          status: "draft",
        },
        {
          title: "Shared editable",
          slug: "shared",
          categoryId: a.id,
          publicCategoryId: a.id,
          status: "published",
          publishedAt: new Date("2026-09-01"),
          publicSlug: "shared-public",
          publicSnapshotJson: snapshot(
            a.id,
            [tagA.id],
            "Shared public",
            "shared-public",
            2,
          ),
        },
      ])
      .returning();
    // "moved" was published under A and its draft has since moved to B.
    await db.insert(PostTagsTable).values([
      { postId: moved.id, tagId: tagB.id },
      { postId: draft.id, tagId: tagA.id },
      { postId: shared.id, tagId: tagA.id },
    ]);
    await db.insert(PostPublicTagsTable).values([
      { postId: moved.id, tagId: tagA.id },
      { postId: shared.id, tagId: tagA.id },
    ]);
    const categories = await Categories.getCategories(context);
    expect(categories.items.find((item) => item.id === a.id)).toMatchObject({
      postCount: 2,
      publicPostCount: 2,
    });
    expect(categories.items.find((item) => item.id === b.id)).toMatchObject({
      postCount: 1,
      publicPostCount: 0,
    });
    const tags = await Tags.getTagsWithCount(context);
    expect(tags.find((item) => item.id === tagA.id)).toMatchObject({
      postCount: 2,
      publicPostCount: 2,
    });
    expect(tags.find((item) => item.id === tagB.id)).toMatchObject({
      postCount: 1,
      publicPostCount: 0,
    });
    for (const [kind, id, movedId] of [
      ["category", a.id, b.id],
      ["tag", tagA.id, tagB.id],
    ] as const) {
      const current = await Posts.listAdminPostsPage(context, {
        taxonomy: { kind, id, scope: "current" },
      });
      expect(
        current.items.map((item) => item.id).sort((a, b) => a - b),
      ).toEqual([draft.id, shared.id].sort((a, b) => a - b));
      expect(current.statusCounts).toMatchObject({ draft: 1, published: 1 });
      expect(current.total).toBe(2);
      const published = await Posts.listAdminPostsPage(context, {
        taxonomy: { kind, id, scope: "public" },
      });
      expect(
        published.items.map((item) => item.id).sort((a, b) => a - b),
      ).toEqual([moved.id, shared.id].sort((a, b) => a - b));
      expect(published.statusCounts).toMatchObject({ draft: 0, published: 2 });
      expect(published.total).toBe(2);
      expect(
        await Posts.getPostsCount(context, {
          taxonomy: { kind, id, scope: "public" },
        }),
      ).toBe(2);
      const notYetPublic = await Posts.listAdminPostsPage(context, {
        taxonomy: { kind, id: movedId, scope: "public" },
      });
      expect(notYetPublic.total).toBe(0);
      const search = await Posts.listAdminPostsPage(context, {
        taxonomy: { kind, id, scope: "public" },
        search: "%_",
      });
      expect(search.total).toBe(1);
      expect(search.items[0]).toMatchObject({
        id: moved.id,
        title: "Public %_ title",
        slug: "public",
        publishedAt: new Date("2026-09-01T12:00:00Z"),
      });
    }
    expect(
      (await TagRepo.getPublishedPostsByTagId(db, tagA.id))
        .map((item) => item.id)
        .sort((a, b) => a - b),
    ).toEqual([moved.id, shared.id].sort((a, b) => a - b));
    expect(await TagRepo.getPublishedPostsByTagId(db, tagB.id)).toEqual([]);
    expect(
      await PostRepo.getPostsCursor(db, { tagName: "B", categoryName: "B" }),
    ).toEqual({ items: [], nextCursor: null });
    const publicList = await PostRepo.getPostsCursor(db, {
      tagName: "A",
      categoryName: "A",
    });
    expect(publicList.items.map((item) => item.id)).toEqual([
      shared.id,
      moved.id,
    ]);
    expect(publicList.items[1]).toMatchObject({
      id: moved.id,
      title: "Public %_ title",
      category: { id: a.id, name: "A" },
    });
    expect(publicList.items[1].tags?.map((tag) => tag.id)).toEqual([tagA.id]);
  });
  it("counts and lists missing public categories as uncategorized without counting drafts as public", async () => {
    const context = createTestContext();
    const db = context.db;
    const [category] = await db
      .insert(CategoriesTable)
      .values({ name: "Deleted" })
      .returning();
    const [published, draft] = await db
      .insert(PostsTable)
      .values([
        {
          title: "Public",
          slug: "public",
          categoryId: category.id,
          publicCategoryId: category.id,
          status: "published",
          publicSnapshotJson: snapshot(category.id, [], "Public", "public"),
        },
        { title: "Draft", slug: "draft", status: "draft" },
      ])
      .returning();
    await CategoryRepo.deleteCategory(db, category.id);
    const counts = await Categories.getCategories(context);
    expect(counts.uncategorizedPostCount).toBe(2);
    expect(counts.uncategorizedPublicPostCount).toBe(1);
    const current = await Posts.listAdminPostsPage(context, {
      taxonomy: { kind: "uncategorized", scope: "current" },
    });
    expect(current.items.map((item) => item.id).sort((a, b) => a - b)).toEqual(
      [published.id, draft.id].sort((a, b) => a - b),
    );
    const publicUse = await Posts.listAdminPostsPage(context, {
      taxonomy: { kind: "uncategorized", scope: "public" },
    });
    expect(publicUse.items.map((item) => item.id)).toEqual([published.id]);
    expect(publicUse.total).toBe(1);
  });
});

describe("Admin post list category and tag filters", () => {
  it("combines current category, uncategorized and tag filters with search and status, counting statuses inside the filters", async () => {
    const context = createTestContext();
    const db = context.db;
    const [notes, essays] = await db
      .insert(CategoriesTable)
      .values([{ name: "Notes" }, { name: "Essays" }])
      .returning();
    const [rust, go] = await db
      .insert(TagsTable)
      .values([{ name: "Rust" }, { name: "Go" }])
      .returning();
    const [rustNote, goNote, rustEssay, looseRust, loose] = await db
      .insert(PostsTable)
      .values([
        {
          title: "Rust note",
          slug: "rust-note",
          categoryId: notes.id,
          status: "published",
          publishedAt: new Date("2026-09-01"),
          publicSnapshotJson: snapshot(
            essays.id,
            [go.id],
            "Rust note",
            "rust-note",
          ),
        },
        {
          title: "Go note",
          slug: "go-note",
          categoryId: notes.id,
          status: "draft",
        },
        {
          title: "Rust essay",
          slug: "rust-essay",
          categoryId: essays.id,
          status: "draft",
        },
        { title: "Loose rust", slug: "loose-rust", status: "draft" },
        { title: "Loose", slug: "loose", status: "published" },
      ])
      .returning();
    await db.insert(PostTagsTable).values([
      { postId: rustNote.id, tagId: rust.id },
      { postId: goNote.id, tagId: go.id },
      { postId: rustEssay.id, tagId: rust.id },
      { postId: looseRust.id, tagId: rust.id },
      { postId: looseRust.id, tagId: go.id },
    ]);
    const ids = (page: { items: Array<{ id: number }> }) =>
      page.items.map((item) => item.id).sort((a, b) => a - b);
    const sorted = (...values: Array<number>) => values.sort((a, b) => a - b);

    const inNotes = await Posts.listAdminPostsPage(context, {
      categoryId: notes.id,
    });
    expect(ids(inNotes)).toEqual(sorted(rustNote.id, goNote.id));
    expect(inNotes.statusCounts).toMatchObject({ draft: 1, published: 1 });
    expect(inNotes.total).toBe(2);

    const rustPosts = await Posts.listAdminPostsPage(context, {
      tagId: rust.id,
    });
    expect(ids(rustPosts)).toEqual(
      sorted(rustNote.id, rustEssay.id, looseRust.id),
    );
    expect(rustPosts.statusCounts).toMatchObject({ draft: 2, published: 1 });

    const rustNotes = await Posts.listAdminPostsPage(context, {
      categoryId: notes.id,
      tagId: rust.id,
    });
    expect(ids(rustNotes)).toEqual([rustNote.id]);

    const uncategorized = await Posts.listAdminPostsPage(context, {
      uncategorized: true,
    });
    expect(ids(uncategorized)).toEqual(sorted(looseRust.id, loose.id));
    expect(uncategorized.statusCounts).toMatchObject({
      draft: 1,
      published: 1,
    });

    const draftUncategorizedGo = await Posts.listAdminPostsPage(context, {
      uncategorized: true,
      tagId: go.id,
      status: "draft",
    });
    expect(ids(draftUncategorizedGo)).toEqual([looseRust.id]);
    expect(draftUncategorizedGo.total).toBe(1);

    const searched = await Posts.listAdminPostsPage(context, {
      tagId: rust.id,
      search: "essay",
    });
    expect(ids(searched)).toEqual([rustEssay.id]);
    expect(searched.statusCounts).toMatchObject({ draft: 1, published: 0 });

    const publishedEssays = await Posts.listAdminPostsPage(context, {
      categoryId: essays.id,
      status: "published",
    });
    expect(publishedEssays.items).toEqual([]);
    expect(publishedEssays.statusCounts).toMatchObject({
      draft: 1,
      published: 0,
    });
    expect(
      await Posts.getPostsCount(context, {
        categoryId: notes.id,
        tagId: go.id,
      }),
    ).toBe(1);
  });
});
