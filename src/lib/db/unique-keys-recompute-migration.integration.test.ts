import { env } from "cloudflare:workers";
import { createAdminTestContext } from "tests/test-utils";
import { describe, expect, it } from "vitest";
import * as CategoryService from "@/features/categories/categories.service";
import * as PostService from "@/features/posts/services/posts.service";
import * as TagService from "@/features/tags/tags.service";
import { parkedKey } from "@/lib/db/unique-keys";
import { uniqueKeyOf } from "@/lib/unicode-text";

/**
 * Migration 0030 on a database whose keys were computed by the app under the
 * rules before it: ẞ was not ss, and a variation selector made a name differ.
 */

async function run(query: string, ...params: Array<unknown>) {
  await env.DB.prepare(query)
    .bind(...params)
    .run();
}

async function all<T>(query: string, ...params: Array<unknown>) {
  return (
    await env.DB.prepare(query)
      .bind(...params)
      .all<T>()
  ).results;
}

async function applyMigration() {
  const migration = env.TEST_MIGRATIONS.find((item) =>
    item.name.startsWith("0030_"),
  );
  expect(migration).toBeDefined();
  for (const query of migration!.queries) await env.DB.prepare(query).run();
}

async function insertPost(
  id: number,
  slug: string,
  slugKey: string,
  publicSlug: string | null = null,
  publicSlugKey: string | null = null,
) {
  await run(
    `INSERT INTO posts (id, title, slug, slug_key, public_slug, public_slug_key, status, save_token)
     VALUES (?, ?, ?, ?, ?, ?, 'draft', ?)`,
    id,
    slug,
    slug,
    slugKey,
    publicSlug,
    publicSlugKey,
    `token-${id}`,
  );
}

describe("Migration 0030 (recompute unique keys)", () => {
  it("clears the keys of values 0029 left to the app, keeps the ones it computed in SQL", async () => {
    // Tags, as the old rules keyed them: ẞ kept apart from ss, a variation
    // selector kept in the key.
    for (const [id, name, key] of [
      [1, "Strasse", "strasse"],
      [2, "STRAẞE", "straße"],
      [3, "❤️", "❤️"],
      [4, "Plain", "plain"],
      [5, "笔记", "笔记"],
      [6, "Café", "café"],
    ] as const) {
      await run(
        "INSERT INTO tags (id, name, name_key) VALUES (?, ?, ?)",
        id,
        name,
        key,
      );
    }
    await run(
      "INSERT INTO categories (id, name, name_key) VALUES (1, 'Notes', 'notes'), (2, 'ＮＯＴＥＳ２', 'notes2')",
    );
    await insertPost(10, "plain", "plain", "plain", "plain");
    // A duplicate of an ASCII slug that 0029 parked in SQL stays parked.
    await insertPost(11, "Plain", parkedKey("plain", 11));
    await insertPost(12, "STRAẞE-post", "straße-post", "Ｓtraße", "strasse");
    await insertPost(13, "strasse-post", "strasse-post");

    await applyMigration();

    expect(await all("SELECT id, name_key FROM tags ORDER BY id")).toEqual([
      { id: 1, name_key: "strasse" },
      { id: 2, name_key: null },
      { id: 3, name_key: null },
      { id: 4, name_key: "plain" },
      { id: 5, name_key: "笔记" },
      { id: 6, name_key: null },
    ]);
    expect(
      await all("SELECT id, name_key FROM categories ORDER BY id"),
    ).toEqual([
      { id: 1, name_key: "notes" },
      { id: 2, name_key: null },
    ]);
    expect(
      await all(
        "SELECT id, slug_key, public_slug_key FROM posts WHERE id BETWEEN 10 AND 13 ORDER BY id",
      ),
    ).toEqual([
      { id: 10, slug_key: "plain", public_slug_key: "plain" },
      { id: 11, slug_key: parkedKey("plain", 11), public_slug_key: null },
      { id: 12, slug_key: null, public_slug_key: null },
      { id: 13, slug_key: "strasse-post", public_slug_key: null },
    ]);

    // The app computes them again under the new rules before its next check.
    const context = createAdminTestContext();
    expect(
      (await TagService.createTag(context, { name: "strasse" })).error?.reason,
    ).toBe("TAG_NAME_ALREADY_EXISTS");
    expect(
      (await TagService.createTag(context, { name: "❤" })).error?.reason,
    ).toBe("TAG_NAME_ALREADY_EXISTS");
    expect(
      (await TagService.createTag(context, { name: "CAFÉ" })).error?.reason,
    ).toBe("TAG_NAME_ALREADY_EXISTS");
    expect(
      (await CategoryService.createCategory(context, { name: "notes2" })).error
        ?.reason,
    ).toBe("CATEGORY_NAME_ALREADY_EXISTS");
    expect(
      await all(
        "SELECT id, name_key FROM tags WHERE id IN (2, 3, 6) ORDER BY id",
      ),
    ).toEqual([
      // "Strasse" holds the key, so STRAẞE, a duplicate now, is parked.
      { id: 2, name_key: parkedKey("strasse", 2) },
      { id: 3, name_key: "❤" },
      { id: 6, name_key: uniqueKeyOf("Café") },
    ]);

    // Slugs: STRAẞE-post now equals strasse-post, which an ASCII row holds.
    const taken = await PostService.updatePost(context, {
      id: 10,
      data: { slug: "Strasse-Post" },
    });
    expect(taken.error?.reason).toBe("SLUG_TAKEN");
    expect(
      await all(
        "SELECT id, slug_key, public_slug_key FROM posts WHERE id = 12",
      ),
    ).toEqual([
      {
        id: 12,
        slug_key: parkedKey("strasse-post", 12),
        public_slug_key: "strasse",
      },
    ]);
    // A parked slug can still be saved unchanged.
    expect(
      (
        await PostService.updatePost(context, {
          id: 12,
          data: { slug: "STRAẞE-post", title: "kept" },
        })
      ).error,
    ).toBeNull();
  });
});
