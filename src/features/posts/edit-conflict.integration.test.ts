import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import {
  createAdminTestContext,
  createMockExecutionCtx,
  seedAdminApiKey,
} from "tests/test-utils";
import { describe, expect, it } from "vitest";
import * as CategoryService from "@/features/categories/categories.service";
import * as TagService from "@/features/tags/tags.service";
import {
  CategoriesTable,
  PostRevisionsTable,
  PostsTable,
  PostTagsTable,
  TagsTable,
} from "@/lib/db/schema";
import { unwrap } from "@/lib/errors";
import { createApiContext } from "@/lib/orpc/create-context";
import { openAPIHandler } from "@/lib/orpc/openapi-handler";

/**
 * Exercises Edit Conflicts the way the admin editor and API clients meet
 * them: over the Admin HTTP API, stating the saveToken they last read.
 */

const paragraph = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

type AdminPost = {
  id: number;
  title: string;
  status: string;
  saveToken: string;
  contentJson: unknown;
  publicSlug: string | null;
};

type EditConflictBody = {
  code: string;
  data: { saveToken: string };
};

async function callAdminApi(
  apiKey: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
) {
  const headers = new Headers({ "x-api-key": apiKey });
  let body: string | undefined;
  if (init.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.body);
  }
  const request = new Request(`http://localhost:3000/api${path}`, {
    method: init.method ?? "GET",
    headers,
    body,
  });
  const { response } = await openAPIHandler.handle(request, {
    prefix: "/api",
    context: createApiContext(request.headers, env, createMockExecutionCtx()),
  });
  if (!response) throw new Error(`No route matched ${request.method} ${path}`);
  return response;
}

async function createPost(apiKey: string, title: string) {
  const response = await callAdminApi(apiKey, "/admin/posts", {
    method: "POST",
    body: { data: { title, contentJson: paragraph(`${title} body`) } },
  });
  expect(response.status).toBe(200);
  return (await response.json()) as { id: number; saveToken: string };
}

async function readPost(apiKey: string, id: number) {
  const response = await callAdminApi(apiKey, `/admin/posts/${id}`);
  expect(response.status).toBe(200);
  return (await response.json()) as AdminPost;
}

function patchPost(
  apiKey: string,
  id: number,
  data: Record<string, unknown>,
  saveToken?: string,
) {
  return callAdminApi(apiKey, `/admin/posts/${id}`, {
    method: "PATCH",
    body: { data, saveToken },
  });
}

function publishPost(apiKey: string, id: number, saveToken?: string) {
  return callAdminApi(apiKey, `/admin/posts/${id}/publish`, {
    method: "POST",
    body: saveToken === undefined ? {} : { saveToken },
  });
}

async function expectEditConflict(response: Response, saveToken: string) {
  expect(response.status).toBe(409);
  const body = (await response.json()) as EditConflictBody;
  expect(body.code).toBe("EDIT_CONFLICT");
  expect(body.data.saveToken).toBe(saveToken);
}

describe("Edit Conflicts on post saves", () => {
  it("saves with the current saveToken and answers with a new one", async () => {
    const apiKey = await seedAdminApiKey();
    const created = await createPost(apiKey, "Guarded save");
    const read = await readPost(apiKey, created.id);
    expect(read.saveToken).toBe(created.saveToken);

    const response = await patchPost(
      apiKey,
      created.id,
      { title: "Guarded save, edited" },
      read.saveToken,
    );
    expect(response.status).toBe(200);
    const saved = (await response.json()) as AdminPost;
    expect(saved.title).toBe("Guarded save, edited");
    expect(saved.saveToken).not.toBe(read.saveToken);
    expect((await readPost(apiKey, created.id)).saveToken).toBe(
      saved.saveToken,
    );
  });

  it("refuses a save stating a stale saveToken and writes nothing", async () => {
    const apiKey = await seedAdminApiKey();
    const { id, saveToken: staleToken } = await createPost(apiKey, "Stale");
    const other = (await (
      await patchPost(apiKey, id, { contentJson: paragraph("other") })
    ).json()) as AdminPost;

    const response = await patchPost(
      apiKey,
      id,
      { title: "Overwritten", contentJson: paragraph("mine") },
      staleToken,
    );

    await expectEditConflict(response, other.saveToken);
    const after = await readPost(apiKey, id);
    expect(after.title).toBe("Stale");
    expect(after.contentJson).toEqual(paragraph("other"));
    expect(after.saveToken).toBe(other.saveToken);
  });

  it("overwrites as before when the save states no saveToken", async () => {
    const apiKey = await seedAdminApiKey();
    const { id } = await createPost(apiKey, "Unguarded");
    await patchPost(apiKey, id, { title: "Someone else" });

    const response = await patchPost(apiKey, id, { title: "Last writer" });

    expect(response.status).toBe(200);
    expect((await readPost(apiKey, id)).title).toBe("Last writer");
  });

  it("lets only one of two concurrent saves with the same saveToken through", async () => {
    const apiKey = await seedAdminApiKey();
    const { id, saveToken } = await createPost(apiKey, "Race");

    const responses = await Promise.all([
      patchPost(apiKey, id, { title: "Race A" }, saveToken),
      patchPost(apiKey, id, { title: "Race B" }, saveToken),
    ]);

    const statuses = responses
      .map((response) => response.status)
      .sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);
    const winner = responses.find((response) => response.status === 200)!;
    const saved = (await winner.json()) as AdminPost;
    expect((await readPost(apiKey, id)).title).toBe(saved.title);
  });

  it("answers 404 for a missing post even with a saveToken", async () => {
    const apiKey = await seedAdminApiKey();

    const response = await patchPost(apiKey, 999_999, { title: "x" }, "token");

    expect(response.status).toBe(404);
  });

  it("rejects a saveToken smuggled into data", async () => {
    const apiKey = await seedAdminApiKey();
    const { id } = await createPost(apiKey, "Strict data");

    const response = await patchPost(apiKey, id, { saveToken: "forged" });

    expect(response.status).toBe(400);
  });
});

describe("Edit Conflicts on publishing", () => {
  it("publishes the draft the saveToken was read from", async () => {
    const apiKey = await seedAdminApiKey();
    const { id, saveToken } = await createPost(apiKey, "Publish guarded");

    const response = await publishPost(apiKey, id, saveToken);

    expect(response.status).toBe(200);
    const result = (await response.json()) as {
      success: boolean;
      saveToken: string;
    };
    expect(result.success).toBe(true);
    expect(result.saveToken).not.toBe(saveToken);
    const after = await readPost(apiKey, id);
    expect(after.status).toBe("published");
    expect(after.saveToken).toBe(result.saveToken);
  });

  it("refuses a publish stating a stale saveToken and publishes nothing", async () => {
    const apiKey = await seedAdminApiKey();
    const { id, saveToken: staleToken } = await createPost(
      apiKey,
      "Publish stale",
    );
    const edited = (await (
      await patchPost(apiKey, id, { contentJson: paragraph("unread edit") })
    ).json()) as AdminPost;

    const response = await publishPost(apiKey, id, staleToken);

    await expectEditConflict(response, edited.saveToken);
    const after = await readPost(apiKey, id);
    expect(after.status).toBe("draft");
    expect(after.publicSlug).toBeNull();
    expect(after.saveToken).toBe(edited.saveToken);
    const db = createAdminTestContext().db;
    const [row] = await db
      .select({ publishedAt: PostsTable.publishedAt })
      .from(PostsTable)
      .where(eq(PostsTable.id, id));
    expect(row.publishedAt).toBeNull();
    const revisions = await db
      .select({ id: PostRevisionsTable.id })
      .from(PostRevisionsTable)
      .where(eq(PostRevisionsTable.postId, id));
    expect(revisions).toEqual([]);
  });

  it("publishes as before when no saveToken is stated", async () => {
    const apiKey = await seedAdminApiKey();
    const { id } = await createPost(apiKey, "Publish unguarded");
    await patchPost(apiKey, id, { contentJson: paragraph("edited") });

    const response = await publishPost(apiKey, id);

    expect(response.status).toBe(200);
    expect((await readPost(apiKey, id)).status).toBe("published");
  });

  it("lets only one of a publish and a save racing on one saveToken through", async () => {
    const apiKey = await seedAdminApiKey();
    const { id, saveToken } = await createPost(apiKey, "Publish race");

    const responses = await Promise.all([
      publishPost(apiKey, id, saveToken),
      patchPost(apiKey, id, { contentJson: paragraph("late") }, saveToken),
    ]);

    const statuses = responses
      .map((response) => response.status)
      .sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);
  });
});

describe("saveToken on every write", () => {
  it("replaces the saveToken on tag changes, unpublish and revision restores", async () => {
    const apiKey = await seedAdminApiKey();
    const db = createAdminTestContext().db;
    const { id } = await createPost(apiKey, "Every write");
    const [tag] = await db
      .insert(TagsTable)
      .values({ name: "edit-conflict-tag" })
      .returning();

    let token = (await readPost(apiKey, id)).saveToken;
    const expectNewToken = async (returned: string) => {
      expect(returned).not.toBe(token);
      expect((await readPost(apiKey, id)).saveToken).toBe(returned);
      token = returned;
    };

    const tagsResponse = await callAdminApi(apiKey, `/admin/posts/${id}/tags`, {
      method: "PUT",
      body: { tagIds: [tag.id] },
    });
    expect(tagsResponse.status).toBe(200);
    await expectNewToken(
      ((await tagsResponse.json()) as { saveToken: string }).saveToken,
    );

    const published = await publishPost(apiKey, id, token);
    expect(published.status).toBe(200);
    await expectNewToken(
      ((await published.json()) as { saveToken: string }).saveToken,
    );

    const unpublished = await callAdminApi(
      apiKey,
      `/admin/posts/${id}/unpublish`,
      { method: "POST", body: {} },
    );
    expect(unpublished.status).toBe(200);
    await expectNewToken(
      ((await unpublished.json()) as { saveToken: string }).saveToken,
    );

    const patched = await patchPost(
      apiKey,
      id,
      { contentJson: paragraph("after publish") },
      token,
    );
    expect(patched.status).toBe(200);
    await expectNewToken(((await patched.json()) as AdminPost).saveToken);

    const revisions = (await (
      await callAdminApi(apiKey, `/admin/posts/${id}/revisions`)
    ).json()) as Array<{ id: number; reason: string }>;
    const publishRevision = revisions.find(
      (revision) => revision.reason === "publish",
    )!;
    const restored = await callAdminApi(
      apiKey,
      `/admin/posts/${id}/revisions/${publishRevision.id}/restore`,
      { method: "POST", body: {} },
    );
    expect(restored.status).toBe(200);
    const restoredBody = (await restored.json()) as {
      restored: boolean;
      post: { saveToken: string };
    };
    expect(restoredBody.restored).toBe(true);
    await expectNewToken(restoredBody.post.saveToken);
  });

  it("replaces the saveToken when the post's category is deleted", async () => {
    const apiKey = await seedAdminApiKey();
    const context = createAdminTestContext();
    const { id } = await createPost(apiKey, "Category goes away");
    const [category] = await context.db
      .insert(CategoriesTable)
      .values({ name: "edit-conflict-category" })
      .returning();
    const assigned = (await (
      await patchPost(apiKey, id, { categoryId: category.id })
    ).json()) as AdminPost;

    await CategoryService.deleteCategory(context, { id: category.id });

    const after = await readPost(apiKey, id);
    expect(after.saveToken).not.toBe(assigned.saveToken);
    const stale = await patchPost(
      apiKey,
      id,
      { title: "Still in the old category" },
      assigned.saveToken,
    );
    await expectEditConflict(stale, after.saveToken);
  });

  it("keeps the saveToken when the post's tag is renamed and replaces it when the tag is deleted", async () => {
    const apiKey = await seedAdminApiKey();
    const context = createAdminTestContext();
    const { id } = await createPost(apiKey, "Tag goes away");
    const [tagId] = await createTags("edit-conflict-renamed-tag");
    const tagged = await callAdminApi(apiKey, `/admin/posts/${id}/tags`, {
      method: "PUT",
      body: { tagIds: [tagId] },
    });
    expect(tagged.status).toBe(200);
    const { saveToken } = (await tagged.json()) as { saveToken: string };

    unwrap(
      await TagService.updateTag(context, {
        id: tagId!,
        data: { name: "edit-conflict-tag-new-name" },
      }),
    );
    expect((await readPost(apiKey, id)).saveToken).toBe(saveToken);

    unwrap(await TagService.deleteTag(context, { id: tagId! }));
    const after = await readPost(apiKey, id);
    expect(after.saveToken).not.toBe(saveToken);
    await expectEditConflict(
      await patchPost(apiKey, id, { title: "Still tagged" }, saveToken),
      after.saveToken,
    );
  });

  it("returns the saveToken with full list items", async () => {
    const apiKey = await seedAdminApiKey();
    const { id, saveToken } = await createPost(apiKey, "Listed with token");

    const withContent = (await (
      await callAdminApi(apiKey, "/admin/posts?includeContent=true&limit=50")
    ).json()) as { items: Array<{ id: number; saveToken?: string }> };
    const withoutContent = (await (
      await callAdminApi(apiKey, "/admin/posts?limit=50")
    ).json()) as { items: Array<{ id: number; saveToken?: string }> };

    expect(withContent.items.find((item) => item.id === id)?.saveToken).toBe(
      saveToken,
    );
    expect(
      withoutContent.items.find((item) => item.id === id)?.saveToken,
    ).toBeUndefined();
  });
});

function putTags(
  apiKey: string,
  id: number,
  tagIds: Array<number>,
  saveToken?: string,
) {
  return callAdminApi(apiKey, `/admin/posts/${id}/tags`, {
    method: "PUT",
    body: saveToken === undefined ? { tagIds } : { tagIds, saveToken },
  });
}

async function draftTagIds(id: number) {
  const rows = await createAdminTestContext()
    .db.select({ tagId: PostTagsTable.tagId })
    .from(PostTagsTable)
    .where(eq(PostTagsTable.postId, id));
  return rows.map((row) => row.tagId).sort((a, b) => a - b);
}

async function createTags(...names: Array<string>) {
  const rows = await createAdminTestContext()
    .db.insert(TagsTable)
    .values(names.map((name) => ({ name })))
    .returning();
  return rows.map((row) => row.id);
}

describe("Edit Conflicts on tag saves", () => {
  it("saves tags with the current saveToken and answers with a new one", async () => {
    const apiKey = await seedAdminApiKey();
    const { id, saveToken } = await createPost(apiKey, "Tagged with token");
    const [a, b] = await createTags("ec-tag-a-1", "ec-tag-b-1");

    const response = await putTags(apiKey, id, [a, b], saveToken);

    expect(response.status).toBe(200);
    const body = (await response.json()) as { saveToken: string };
    expect(body.saveToken).not.toBe(saveToken);
    expect((await readPost(apiKey, id)).saveToken).toBe(body.saveToken);
    expect(await draftTagIds(id)).toEqual([a, b].sort((x, y) => x - y));
  });

  it("refuses a stale saveToken, writes no tags and keeps the token", async () => {
    const apiKey = await seedAdminApiKey();
    const { id, saveToken: staleToken } = await createPost(
      apiKey,
      "Stale tags",
    );
    const [a, b] = await createTags("ec-tag-a-2", "ec-tag-b-2");
    const other = await putTags(apiKey, id, [a]);
    const otherToken = ((await other.json()) as { saveToken: string })
      .saveToken;

    const response = await putTags(apiKey, id, [b], staleToken);

    await expectEditConflict(response, otherToken);
    expect(await draftTagIds(id)).toEqual([a]);
    expect((await readPost(apiKey, id)).saveToken).toBe(otherToken);
  });

  it("refuses tags after another client saved the post", async () => {
    const apiKey = await seedAdminApiKey();
    const { id, saveToken } = await createPost(apiKey, "Saved meanwhile");
    const [a] = await createTags("ec-tag-a-3");
    const saved = (await (
      await patchPost(apiKey, id, { title: "Someone else" }, saveToken)
    ).json()) as AdminPost;

    const response = await putTags(apiKey, id, [a], saveToken);

    await expectEditConflict(response, saved.saveToken);
    expect(await draftTagIds(id)).toEqual([]);
  });

  it("writes unconditionally when no saveToken is stated", async () => {
    const apiKey = await seedAdminApiKey();
    const { id } = await createPost(apiKey, "Unguarded tags");
    const [a, b] = await createTags("ec-tag-a-4", "ec-tag-b-4");
    await patchPost(apiKey, id, { title: "Someone else" });

    expect((await putTags(apiKey, id, [a])).status).toBe(200);
    expect((await putTags(apiKey, id, [b])).status).toBe(200);

    expect(await draftTagIds(id)).toEqual([b]);
  });

  it("lets consecutive saves chain the returned saveToken", async () => {
    const apiKey = await seedAdminApiKey();
    const { id, saveToken } = await createPost(apiKey, "Chained tags");
    const [a, b] = await createTags("ec-tag-a-5", "ec-tag-b-5");

    const first = await putTags(apiKey, id, [a], saveToken);
    const firstToken = ((await first.json()) as { saveToken: string })
      .saveToken;
    const second = await putTags(apiKey, id, [a, b], firstToken);

    expect(second.status).toBe(200);
    expect(await draftTagIds(id)).toEqual([a, b].sort((x, y) => x - y));
  });

  it("lets only one of a post save and a tag save racing on one saveToken through", async () => {
    const apiKey = await seedAdminApiKey();
    const { id, saveToken } = await createPost(apiKey, "Tag race");
    const [a] = await createTags("ec-tag-a-6");

    const [patched, tagged] = await Promise.all([
      patchPost(apiKey, id, { title: "Race title" }, saveToken),
      putTags(apiKey, id, [a], saveToken),
    ]);

    expect([patched.status, tagged.status].sort((x, y) => x - y)).toEqual([
      200, 409,
    ]);
    const tags = await draftTagIds(id);
    expect(tags).toEqual(tagged.status === 200 ? [a] : []);
    expect((await readPost(apiKey, id)).title).toBe(
      patched.status === 200 ? "Race title" : "Tag race",
    );
  });

  it("lets only one of two tag saves on one saveToken through", async () => {
    const apiKey = await seedAdminApiKey();
    const { id, saveToken } = await createPost(apiKey, "Two tag saves");
    const [a, b] = await createTags("ec-tag-a-7", "ec-tag-b-7");

    const responses = await Promise.all([
      putTags(apiKey, id, [a], saveToken),
      putTags(apiKey, id, [b], saveToken),
    ]);

    expect(responses.map((r) => r.status).sort((x, y) => x - y)).toEqual([
      200, 409,
    ]);
    const winner = responses.findIndex((r) => r.status === 200);
    expect(await draftTagIds(id)).toEqual([winner === 0 ? a : b]);
  });

  it("answers 404 POST_NOT_FOUND for a missing post", async () => {
    const apiKey = await seedAdminApiKey();

    const response = await putTags(apiKey, 999_999, []);

    expect(response.status).toBe(404);
    expect(((await response.json()) as { code: string }).code).toBe(
      "POST_NOT_FOUND",
    );
  });
});

describe("Reading one admin item that does not exist", () => {
  it("answers 404 POST_NOT_FOUND for a missing post", async () => {
    const apiKey = await seedAdminApiKey();

    const response = await callAdminApi(apiKey, "/admin/posts/999999");

    expect(response.status).toBe(404);
    expect(((await response.json()) as { code: string }).code).toBe(
      "POST_NOT_FOUND",
    );
  });

  it("answers 404 POST_REVISION_NOT_FOUND for a missing revision", async () => {
    const apiKey = await seedAdminApiKey();
    const { id } = await createPost(apiKey, "No such revision");

    const response = await callAdminApi(
      apiKey,
      `/admin/posts/${id}/revisions/999999`,
    );

    expect(response.status).toBe(404);
    expect(((await response.json()) as { code: string }).code).toBe(
      "POST_REVISION_NOT_FOUND",
    );
  });
});
