import { env } from "cloudflare:workers";
import { createAdminTestContext } from "tests/test-utils";
import { describe, expect, it } from "vitest";
import * as CategoryService from "@/features/categories/categories.service";
import * as PostService from "@/features/posts/services/posts.service";
import * as TagService from "@/features/tags/tags.service";
import { parkedKey } from "@/lib/db/unique-keys";

/**
 * Migration 0029 on a database written before it, with the duplicates the old
 * application checks let through under concurrent requests.
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

/** The database as it was before migration 0029. */
async function undoMigration() {
  for (const index of [
    "tags_name_key_unique",
    "categories_name_key_unique",
    "posts_slug_key_unique",
    "posts_public_slug_key_unique",
  ]) {
    await run(`DROP INDEX ${index}`);
  }
  await run("ALTER TABLE tags DROP COLUMN name_key");
  await run("ALTER TABLE categories DROP COLUMN name_key");
  await run("ALTER TABLE posts DROP COLUMN slug_key");
  await run("ALTER TABLE posts DROP COLUMN public_slug_key");
}

async function applyMigration() {
  const migration = env.TEST_MIGRATIONS.find((item) =>
    item.name.startsWith("0029_"),
  );
  expect(migration).toBeDefined();
  for (const query of migration!.queries) await env.DB.prepare(query).run();
}

async function insertPost(
  id: number,
  slug: string,
  options: { publicSlug?: string; categoryId?: number } = {},
) {
  await run(
    `INSERT INTO posts (id, title, slug, public_slug, status, public_snapshot_json, category_id, public_category_id, save_token, draft_fingerprint, published_fingerprint)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft-fp', 'published-fp')`,
    id,
    slug,
    slug,
    options.publicSlug ?? null,
    options.publicSlug ? "published" : "draft",
    options.publicSlug
      ? JSON.stringify({
          title: slug,
          summary: null,
          slug: options.publicSlug,
          contentJson: null,
          tagIds: [],
          categoryId: options.categoryId ?? null,
          publishedAt: "2026-01-01T00:00:00.000Z",
          cover: null,
        })
      : null,
    options.categoryId ?? null,
    options.publicSlug ? (options.categoryId ?? null) : null,
    `token-${id}`,
  );
}

describe("Migration 0029 (unique name keys)", () => {
  it("merges duplicate Tags and Categories, parks duplicate slugs, and indexes the keys", async () => {
    await undoMigration();

    // Tags: three case variants of one name, and two names lower() cannot
    // compare (left for the app).
    for (const [id, name] of [
      [1, "React"],
      [2, "react"],
      [3, "REACT"],
      [4, "Vue"],
      [5, "Café"],
      [6, "CAFÉ"],
    ] as const) {
      await run("INSERT INTO tags (id, name) VALUES (?, ?)", id, name);
    }
    for (const [id, name] of [
      [1, "Notes"],
      [2, "NOTES"],
      [3, "笔记"],
    ] as const) {
      await run("INSERT INTO categories (id, name) VALUES (?, ?)", id, name);
    }
    await insertPost(10, "hello", { publicSlug: "hello", categoryId: 2 });
    await insertPost(11, "Hello-Again", {
      publicSlug: "Hello",
      categoryId: 1,
    });
    await insertPost(12, "HELLO-again");
    await insertPost(13, "笔记-一");
    await insertPost(14, "ＡＢＣ");
    await insertPost(15, "plain");
    for (const [postId, tagId] of [
      [10, 2],
      [10, 3],
      [11, 1],
      [11, 3],
      [15, 4],
    ]) {
      await run(
        "INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)",
        postId,
        tagId,
      );
    }
    await run(
      "INSERT INTO post_public_tags (post_id, tag_id) VALUES (10, 2), (11, 3)",
    );

    await applyMigration();

    // Tags: the oldest of each case group stays and takes over its Posts.
    expect(
      await all("SELECT id, name, name_key FROM tags ORDER BY id"),
    ).toEqual([
      { id: 1, name: "React", name_key: "react" },
      { id: 4, name: "Vue", name_key: "vue" },
      { id: 5, name: "Café", name_key: null },
      { id: 6, name: "CAFÉ", name_key: null },
    ]);
    expect(
      await all(
        "SELECT post_id, tag_id FROM post_tags ORDER BY post_id, tag_id",
      ),
    ).toEqual([
      { post_id: 10, tag_id: 1 },
      { post_id: 11, tag_id: 1 },
      { post_id: 15, tag_id: 4 },
    ]);
    expect(
      await all(
        "SELECT post_id, tag_id FROM post_public_tags ORDER BY post_id, tag_id",
      ),
    ).toEqual([
      { post_id: 10, tag_id: 1 },
      { post_id: 11, tag_id: 1 },
    ]);

    // Categories the same way, draft and public.
    expect(
      await all("SELECT id, name, name_key FROM categories ORDER BY id"),
    ).toEqual([
      { id: 1, name: "Notes", name_key: "notes" },
      { id: 3, name: "笔记", name_key: "笔记" },
    ]);
    expect(
      await all(
        "SELECT id, category_id, public_category_id FROM posts WHERE id IN (10, 11) ORDER BY id",
      ),
    ).toEqual([
      { id: 10, category_id: 1, public_category_id: 1 },
      { id: 11, category_id: 1, public_category_id: 1 },
    ]);

    // Posts whose Tags or Category moved are fingerprinted again, with a new
    // token; the others are untouched.
    const touched = await all<{
      id: number;
      save_token: string;
      draft_fingerprint: string | null;
      published_fingerprint: string | null;
    }>(
      "SELECT id, save_token, draft_fingerprint, published_fingerprint FROM posts WHERE id IN (10, 11, 15) ORDER BY id",
    );
    for (const post of touched.slice(0, 2)) {
      expect(post.save_token).not.toBe(`token-${post.id}`);
      expect(post.draft_fingerprint).toBeNull();
      expect(post.published_fingerprint).toBeNull();
    }
    expect(touched[2]).toEqual({
      id: 15,
      save_token: "token-15",
      draft_fingerprint: "draft-fp",
      published_fingerprint: "published-fp",
    });

    // Slugs keep their values; the later case variant is parked.
    expect(
      await all(
        "SELECT id, slug, slug_key, public_slug, public_slug_key FROM posts WHERE id BETWEEN 10 AND 15 ORDER BY id",
      ),
    ).toEqual([
      {
        id: 10,
        slug: "hello",
        slug_key: "hello",
        public_slug: "hello",
        public_slug_key: "hello",
      },
      {
        id: 11,
        slug: "Hello-Again",
        slug_key: "hello-again",
        public_slug: "Hello",
        public_slug_key: parkedKey("hello", 11),
      },
      {
        id: 12,
        slug: "HELLO-again",
        slug_key: parkedKey("hello-again", 12),
        public_slug: null,
        public_slug_key: null,
      },
      {
        id: 13,
        slug: "笔记-一",
        slug_key: "笔记-一",
        public_slug: null,
        public_slug_key: null,
      },
      // Fullwidth letters need NFKC, which the app computes.
      {
        id: 14,
        slug: "ＡＢＣ",
        slug_key: null,
        public_slug: null,
        public_slug_key: null,
      },
      {
        id: 15,
        slug: "plain",
        slug_key: "plain",
        public_slug: null,
        public_slug_key: null,
      },
    ]);

    const indexes = await all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name IN ('tags_name_key_unique', 'categories_name_key_unique', 'posts_slug_key_unique', 'posts_public_slug_key_unique') ORDER BY name",
    );
    expect(indexes.map((index) => index.name)).toEqual([
      "categories_name_key_unique",
      "posts_public_slug_key_unique",
      "posts_slug_key_unique",
      "tags_name_key_unique",
    ]);
    expect(
      await all(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE '%_tmp'",
      ),
    ).toEqual([]);

    // The app takes over: keys left for it are computed, a duplicate parked.
    const context = createAdminTestContext();
    expect(
      (await TagService.createTag(context, { name: "REACT" })).error?.reason,
    ).toBe("TAG_NAME_ALREADY_EXISTS");
    expect(
      (await TagService.createTag(context, { name: "café" })).error?.reason,
    ).toBe("TAG_NAME_ALREADY_EXISTS");
    expect(
      await all("SELECT id, name_key FROM tags WHERE id IN (5, 6) ORDER BY id"),
    ).toEqual([
      { id: 5, name_key: "café" },
      { id: 6, name_key: parkedKey("café", 6) },
    ]);
    expect(
      (await CategoryService.createCategory(context, { name: "notes" })).error
        ?.reason,
    ).toBe("CATEGORY_NAME_ALREADY_EXISTS");

    const abc = await PostService.updatePost(context, {
      id: 15,
      data: { slug: "abc" },
    });
    expect(abc.error?.reason).toBe("SLUG_TAKEN");
    // A parked slug can be saved unchanged.
    expect(
      (
        await PostService.updatePost(context, {
          id: 12,
          data: { slug: "HELLO-again", title: "kept" },
        })
      ).error,
    ).toBeNull();
  });

  it("runs on a database without duplicates", async () => {
    await undoMigration();
    await run("INSERT INTO tags (id, name) VALUES (1, 'React'), (2, 'Vue')");
    await insertPost(1, "hello", { publicSlug: "hello" });

    await applyMigration();

    expect(
      await all("SELECT id, name, name_key FROM tags ORDER BY id"),
    ).toEqual([
      { id: 1, name: "React", name_key: "react" },
      { id: 2, name: "Vue", name_key: "vue" },
    ]);
    expect(
      await all(
        "SELECT save_token, slug_key, public_slug_key FROM posts WHERE id = 1",
      ),
    ).toEqual([
      { save_token: "token-1", slug_key: "hello", public_slug_key: "hello" },
    ]);
  });
});
