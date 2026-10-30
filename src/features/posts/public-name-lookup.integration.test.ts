import { createTestContext } from "tests/test-utils";
import { describe, expect, it } from "vitest";
import * as PostRepo from "@/features/posts/data/posts.data";
import {
  CategoriesTable,
  PostPublicTagsTable,
  PostsTable,
  TagsTable,
} from "@/lib/db/schema";

/**
 * A public page addresses a Tag or Category by name; a name in the wrong case
 * is still that Tag or Category, not an empty list.
 */

describe("public Tag and Category lookup by name", () => {
  it("lists a Tag's and a Category's posts whatever the case of the name", async () => {
    const { db } = createTestContext();
    const [category] = await db
      .insert(CategoriesTable)
      .values({ name: "Notes" })
      .returning();
    const [tag] = await db
      .insert(TagsTable)
      .values({ name: "CloudFlare" })
      .returning();
    const [post] = await db
      .insert(PostsTable)
      .values({
        title: "Case insensitive",
        slug: "case-insensitive",
        status: "published",
        publishedAt: new Date("2026-09-01"),
        publicSlug: "case-insensitive",
        publicCategoryId: category.id,
        publicSnapshotJson: {
          title: "Case insensitive",
          slug: "case-insensitive",
          summary: null,
          contentJson: null,
          categoryId: category.id,
          tagIds: [tag.id],
          publishedAt: "2026-09-01T00:00:00.000Z",
          cover: null,
        },
      })
      .returning();
    await db
      .insert(PostPublicTagsTable)
      .values({ postId: post.id, tagId: tag.id });

    for (const tagName of ["CloudFlare", "cloudflare", "CLOUDFLARE"]) {
      const list = await PostRepo.getPostsCursor(db, { tagName });
      expect(
        list.items.map((item) => item.id),
        tagName,
      ).toEqual([post.id]);
    }
    for (const categoryName of ["Notes", "notes", "NOTES"]) {
      const list = await PostRepo.getPostsCursor(db, { categoryName });
      expect(
        list.items.map((item) => item.id),
        categoryName,
      ).toEqual([post.id]);
    }
    expect(
      (await PostRepo.getPostsCursor(db, { tagName: "Cloud" })).items,
    ).toEqual([]);
  });
});
