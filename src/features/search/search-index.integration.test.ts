import { env } from "cloudflare:workers";
import {
  createAdminTestContext,
  createMockExecutionCtx,
  seedUser,
} from "tests/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import * as CategoryService from "@/features/categories/categories.service";
import * as PostService from "@/features/posts/services/posts.service";
import * as SearchService from "@/features/search/service/search.service";
import * as TagService from "@/features/tags/tags.service";
import { PostsTable } from "@/lib/db/schema";
import { unwrap } from "@/lib/errors";
import { createApiContext } from "@/lib/orpc/create-context";
import { openAPIHandler } from "@/lib/orpc/openapi-handler";
import { eq } from "drizzle-orm";

let admin: ReturnType<typeof createAdminTestContext>;

beforeEach(async () => {
  admin = createAdminTestContext();
  await seedUser(admin.db, admin.session.user);
});

async function searchFor(q: string) {
  const { version } = await SearchService.getIndexVersion(admin);
  return SearchService.search(admin, { q, v: version, limit: 10 });
}

async function publishedPost(options: {
  title: string;
  slug: string;
  categoryId?: number;
  tagIds?: Array<number>;
}) {
  const { id } = await PostService.createEmptyPost(admin);
  unwrap(
    await PostService.updatePost(admin, {
      id,
      data: {
        title: options.title,
        slug: options.slug,
        categoryId: options.categoryId,
      },
    }),
  );
  if (options.tagIds) {
    unwrap(
      await TagService.setPostTags(admin, {
        postId: id,
        tagIds: options.tagIds,
      }),
    );
  }
  unwrap(await PostService.publishPost(admin, { id }));
  return id;
}

describe("Search Index after a Category or Tag changes", () => {
  it("follows a renamed Category at once", async () => {
    const category = unwrap(
      await CategoryService.createCategory(admin, { name: "oldcategory" }),
    );
    const id = await publishedPost({
      title: "Categorised",
      slug: "categorised",
      categoryId: category.id,
    });
    expect(await searchFor("oldcategory")).toHaveLength(1);

    const { version: before } = await SearchService.getIndexVersion(admin);
    unwrap(
      await CategoryService.updateCategory(admin, {
        id: category.id,
        data: { name: "newcategory" },
      }),
    );

    expect(await searchFor("oldcategory")).toHaveLength(0);
    const found = await searchFor("newcategory");
    expect(found.map((result) => result.post.id)).toEqual([id]);
    const { version: after } = await SearchService.getIndexVersion(admin);
    expect(after).not.toBe(before);
  });

  it("follows a renamed Tag at once, in the results and in matching", async () => {
    const tag = unwrap(await TagService.createTag(admin, { name: "oldtag" }));
    const id = await publishedPost({
      title: "Tagged",
      slug: "tagged",
      tagIds: [tag.id],
    });
    expect((await searchFor("oldtag"))[0]?.post.tags).toEqual(["oldtag"]);

    unwrap(
      await TagService.updateTag(admin, {
        id: tag.id,
        data: { name: "newtag" },
      }),
    );

    expect(await searchFor("oldtag")).toHaveLength(0);
    const found = await searchFor("newtag");
    expect(found.map((result) => result.post.id)).toEqual([id]);
    expect(found[0]?.post.tags).toEqual(["newtag"]);
  });

  it("leaves other posts, drafts and the draft's own assignments alone", async () => {
    const tag = unwrap(await TagService.createTag(admin, { name: "shared" }));
    const published = await publishedPost({
      title: "Published one",
      slug: "published-one",
      tagIds: [tag.id],
    });
    const other = await publishedPost({
      title: "Bystander",
      slug: "bystander",
    });
    // A draft that carries the Tag is not in the index and must not enter it.
    const draft = await PostService.createEmptyPost(admin);
    unwrap(
      await PostService.updatePost(admin, {
        id: draft.id,
        data: { title: "Draft carrying it", slug: "draft-carrying-it" },
      }),
    );
    unwrap(
      await TagService.setPostTags(admin, {
        postId: draft.id,
        tagIds: [tag.id],
      }),
    );

    unwrap(
      await TagService.updateTag(admin, {
        id: tag.id,
        data: { name: "renamed" },
      }),
    );

    expect((await searchFor("renamed")).map((r) => r.post.id)).toEqual([
      published,
    ]);
    expect((await searchFor("Bystander")).map((r) => r.post.id)).toEqual([
      other,
    ]);
    expect(await searchFor("Draft")).toHaveLength(0);
  });

  it("indexes the Public Content Snapshot, not the draft, when it renames", async () => {
    const category = unwrap(
      await CategoryService.createCategory(admin, { name: "before" }),
    );
    const id = await publishedPost({
      title: "Public title",
      slug: "snapshot-title",
      categoryId: category.id,
    });
    unwrap(
      await PostService.updatePost(admin, {
        id,
        data: { title: "Unpublished title" },
      }),
    );

    unwrap(
      await CategoryService.updateCategory(admin, {
        id: category.id,
        data: { name: "after" },
      }),
    );

    expect((await searchFor("after"))[0]?.post.title).toBe("Public title");
    expect(await searchFor("Unpublished")).toHaveLength(0);
  });

  it("drops a deleted Tag or Category from the posts that carried it", async () => {
    const category = unwrap(
      await CategoryService.createCategory(admin, { name: "doomedcategory" }),
    );
    const tag = unwrap(
      await TagService.createTag(admin, { name: "doomedtag" }),
    );
    await publishedPost({
      title: "Loses both",
      slug: "loses-both",
      categoryId: category.id,
      tagIds: [tag.id],
    });
    expect(await searchFor("doomedcategory")).toHaveLength(1);
    expect(await searchFor("doomedtag")).toHaveLength(1);

    await TagService.deleteTag(admin, { id: tag.id });
    await CategoryService.deleteCategory(admin, { id: category.id });

    expect(await searchFor("doomedtag")).toHaveLength(0);
    expect(await searchFor("doomedcategory")).toHaveLength(0);
    const [still] = await searchFor("Loses");
    expect(still?.post.tags).toEqual([]);
  });

  it("does not touch the index for a rename of a Tag no published post uses", async () => {
    const tag = unwrap(await TagService.createTag(admin, { name: "unused" }));
    await publishedPost({ title: "Anything", slug: "anything" });
    const { version: before } = await SearchService.getIndexVersion(admin);

    unwrap(
      await TagService.updateTag(admin, {
        id: tag.id,
        data: { name: "unused-renamed" },
      }),
    );

    const { version: after } = await SearchService.getIndexVersion(admin);
    expect(after).toBe(before);
  });

  it("reindexes many posts of one Tag past the batch size", async () => {
    const tag = unwrap(await TagService.createTag(admin, { name: "crowd" }));
    for (let i = 0; i < 60; i++) {
      await publishedPost({
        title: `Crowd post ${i}`,
        slug: `crowd-post-${i}`,
        tagIds: [tag.id],
      });
    }

    unwrap(
      await TagService.updateTag(admin, {
        id: tag.id,
        data: { name: "gathering" },
      }),
    );

    const { version } = await SearchService.getIndexVersion(admin);
    const found = await SearchService.search(admin, {
      q: "gathering",
      v: version,
      limit: 25,
    });
    expect(found).toHaveLength(25);
    expect(
      await SearchService.search(admin, { q: "crowd", v: version, limit: 25 }),
    ).toHaveLength(25);
    expect(
      (
        await SearchService.search(admin, {
          q: "crowd",
          v: version,
          limit: 25,
        })
      ).every((result) => result.post.tags.join() === "gathering"),
    ).toBe(true);
  });
});

describe("Search Index after a Post is deleted", () => {
  it("removes a published Post whose slug is empty", async () => {
    const id = await publishedPost({ title: "Nameless slug", slug: "temp" });
    // The audit's post: published, then its slug blanked in both places.
    const [row] = await admin.db
      .select({ snapshot: PostsTable.publicSnapshotJson })
      .from(PostsTable)
      .where(eq(PostsTable.id, id));
    await admin.db
      .update(PostsTable)
      .set({
        slug: "",
        publicSlug: "",
        publicSnapshotJson: row?.snapshot
          ? { ...row.snapshot, slug: "" }
          : null,
      })
      .where(eq(PostsTable.id, id));
    await SearchService.upsert(admin, {
      id,
      slug: "",
      title: "Nameless slug",
    });
    expect(await searchFor("Nameless")).toHaveLength(1);

    unwrap(await PostService.deletePost(admin, { id }));

    expect(await searchFor("Nameless")).toHaveLength(0);
  });

  it("removes a published Post whose public slug is missing", async () => {
    const id = await publishedPost({ title: "Odd record", slug: "odd" });
    await admin.db
      .update(PostsTable)
      .set({ publicSlug: null })
      .where(eq(PostsTable.id, id));

    unwrap(await PostService.deletePost(admin, { id }));

    expect(await searchFor("Odd")).toHaveLength(0);
  });

  it("removes a Post that was unpublished and then deleted", async () => {
    const id = await publishedPost({ title: "Went away", slug: "went-away" });
    unwrap(await PostService.unpublishPost(admin, { id }));
    unwrap(await PostService.deletePost(admin, { id }));
    expect(await searchFor("Went")).toHaveLength(0);
  });

  it("removes a document the index kept for a Post that is no longer published", async () => {
    const id = await publishedPost({ title: "Left behind", slug: "left" });
    // A stale document, as the audit found: the Post is a draft again.
    await admin.db
      .update(PostsTable)
      .set({ publicSnapshotJson: null, publicSlug: null })
      .where(eq(PostsTable.id, id));
    expect(await searchFor("Left")).toHaveLength(1);

    unwrap(await PostService.deletePost(admin, { id }));

    expect(await searchFor("Left")).toHaveLength(0);
  });

  it("leaves the index version alone when a draft is deleted", async () => {
    const { id } = await PostService.createEmptyPost(admin);
    const { version: before } = await SearchService.getIndexVersion(admin);

    unwrap(await PostService.deletePost(admin, { id }));

    const { version: after } = await SearchService.getIndexVersion(admin);
    expect(after).toBe(before);
  });
});

describe("public read operations", () => {
  async function publicGet(path: string) {
    const request = new Request(`http://localhost:3000/api${path}`);
    const { response } = await openAPIHandler.handle(request, {
      prefix: "/api",
      context: createApiContext(request.headers, env, createMockExecutionCtx()),
    });
    if (!response) throw new Error(`No route matched ${path}`);
    const raw = await response.text();
    return { status: response.status, body: raw ? JSON.parse(raw) : null };
  }

  it("answers 404 POST_NOT_FOUND for a slug no published post has", async () => {
    const missing = await publicGet("/posts/no-such-post");
    expect(missing.status).toBe(404);
    expect(missing.body).toMatchObject({ code: "POST_NOT_FOUND" });

    const draft = await PostService.createEmptyPost(admin);
    unwrap(
      await PostService.updatePost(admin, {
        id: draft.id,
        data: { title: "Still a draft", slug: "still-a-draft" },
      }),
    );
    expect((await publicGet("/posts/still-a-draft")).status).toBe(404);
  });

  it("serves a published post", async () => {
    await publishedPost({ title: "Readable", slug: "readable" });
    const found = await publicGet("/posts/readable");
    expect(found.status).toBe(200);
    expect(found.body).toMatchObject({ title: "Readable", slug: "readable" });
  });

  it("serves typed tags, categories, search and its version", async () => {
    const category = unwrap(
      await CategoryService.createCategory(admin, { name: "cat" }),
    );
    const tag = unwrap(await TagService.createTag(admin, { name: "tg" }));
    await publishedPost({
      title: "Everything typed",
      slug: "everything-typed",
      categoryId: category.id,
      tagIds: [tag.id],
    });

    const tags = await publicGet("/tags");
    expect(tags.status).toBe(200);
    expect(tags.body).toEqual([
      expect.objectContaining({ id: tag.id, name: "tg", postCount: 1 }),
    ]);
    const categories = await publicGet("/categories");
    expect(categories.status).toBe(200);
    expect(categories.body).toEqual([
      expect.objectContaining({ id: category.id, name: "cat", postCount: 1 }),
    ]);

    const version = await publicGet("/search/version");
    expect(version.status).toBe(200);
    const results = await publicGet(
      `/search?q=typed&v=${encodeURIComponent(version.body.version)}`,
    );
    expect(results.status).toBe(200);
    expect(results.body).toEqual([
      expect.objectContaining({
        post: expect.objectContaining({
          slug: "everything-typed",
          tags: ["tg"],
        }),
      }),
    ]);
  });

  it("refuses a search without v", async () => {
    expect((await publicGet("/search?q=typed")).status).toBe(400);
  });
});

describe("OpenAPI document of the public reads", () => {
  type Operation = {
    description?: string;
    parameters?: Array<{
      name: string;
      required?: boolean;
      description?: string;
    }>;
    responses?: Record<
      string,
      { content?: Record<string, { schema?: Record<string, unknown> }> }
    >;
  };
  let doc: { paths: Record<string, Record<string, Operation>> };

  beforeEach(async () => {
    const { response } = await openAPIHandler.handle(
      new Request("http://localhost/api/spec.json"),
      { prefix: "/api", context: {} as never },
    );
    doc = await response!.json();
  });

  it.each([
    ["/tags", "array"],
    ["/categories", "array"],
    ["/search", "array"],
    ["/search/version", "object"],
  ])("types the 200 response of GET %s", (path, type) => {
    const schema =
      doc.paths[path]?.get?.responses?.["200"]?.content?.["application/json"]
        ?.schema;
    expect(schema).toBeDefined();
    expect(schema?.anyOf).toBeUndefined();
    expect(schema?.type).toBe(type);
  });

  it("explains the required v parameter of the search", () => {
    const search = doc.paths["/search"]?.get;
    const v = search?.parameters?.find((parameter) => parameter.name === "v");
    expect(v?.required).toBe(true);
    expect(JSON.stringify(v)).toContain("/search/version");
    expect(search?.description).toContain("/search/version");
  });

  it("declares the 404 of a post by slug", () => {
    const responses = doc.paths["/posts/{slug}"]?.get?.responses ?? {};
    expect(Object.keys(responses)).toContain("404");
  });
});
