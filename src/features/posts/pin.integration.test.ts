import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import {
  createMockExecutionCtx,
  createTestContext,
  seedAdminApiKey,
  waitForBackgroundTasks,
} from "tests/test-utils";
import { describe, expect, it } from "vitest";
import { PostsTable } from "@/lib/db/schema";
import { createApiContext } from "@/lib/orpc/create-context";
import { openAPIHandler } from "@/lib/orpc/openapi-handler";
import * as PostService from "@/features/posts/services/posts.service";

/**
 * Pinning takes effect at once: the public site reads the post's own pin, so
 * the admin endpoints change public ordering without a publish.
 */

const paragraph = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

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

type WriteResult = { success: boolean; saveToken: string };

async function createPost(apiKey: string, title: string, day: number) {
  const created = await callAdminApi(apiKey, "/admin/posts", {
    method: "POST",
    body: { data: { title, contentJson: paragraph(`${title} body`) } },
  });
  expect(created.status).toBe(200);
  const { id } = (await created.json()) as { id: number };
  const patched = await callAdminApi(apiKey, `/admin/posts/${id}`, {
    method: "PATCH",
    body: { data: { publishedAt: `2026-01-0${day}T12:00:00.000Z` } },
  });
  expect(patched.status).toBe(200);
  return id;
}

async function publish(apiKey: string, id: number) {
  const published = await callAdminApi(apiKey, `/admin/posts/${id}/publish`, {
    method: "POST",
    body: {},
  });
  expect(published.status).toBe(200);
}

async function createPublishedPost(apiKey: string, title: string, day: number) {
  const id = await createPost(apiKey, title, day);
  await publish(apiKey, id);
  return id;
}

function pin(apiKey: string, id: number) {
  return callAdminApi(apiKey, `/admin/posts/${id}/pin`, { method: "POST" });
}

function unpin(apiKey: string, id: number) {
  return callAdminApi(apiKey, `/admin/posts/${id}/unpin`, { method: "POST" });
}

async function readPost(apiKey: string, id: number) {
  const response = await callAdminApi(apiKey, `/admin/posts/${id}`);
  expect(response.status).toBe(200);
  return (await response.json()) as {
    status: string;
    saveToken: string;
    pinnedAt: string | null;
    title: string;
  };
}

/** What a visitor sees on the first homepage, through the public cache. */
async function homeIds() {
  const context = createTestContext();
  const page = await PostService.getHomePosts(context, 1);
  await waitForBackgroundTasks(context.executionCtx);
  return page.items.map((item) => item.id);
}

describe("Pinning a post", () => {
  it("changes public ordering at once, without publishing", async () => {
    const apiKey = await seedAdminApiKey();
    const oldest = await createPublishedPost(apiKey, "Oldest", 1);
    const middle = await createPublishedPost(apiKey, "Middle", 2);
    const newest = await createPublishedPost(apiKey, "Newest", 3);
    // Reads the homepage so the public cache holds the unpinned order.
    expect(await homeIds()).toEqual([newest, middle, oldest]);

    const pinned = await pin(apiKey, oldest);
    expect(pinned.status).toBe(200);
    expect(await homeIds()).toEqual([oldest, newest, middle]);

    const unpinned = await unpin(apiKey, oldest);
    expect(unpinned.status).toBe(200);
    expect(await homeIds()).toEqual([newest, middle, oldest]);
  });

  it("puts the pinned post in the pinned list and out of the paged feed", async () => {
    const apiKey = await seedAdminApiKey();
    const older = await createPublishedPost(apiKey, "Older", 1);
    const newer = await createPublishedPost(apiKey, "Newer", 2);
    const before = createTestContext();
    expect(await PostService.getPinnedPosts(before)).toEqual([]);
    await waitForBackgroundTasks(before.executionCtx);

    await pin(apiKey, older);

    const after = createTestContext();
    const pinnedList = await PostService.getPinnedPosts(after);
    expect(pinnedList.map((item) => item.id)).toEqual([older]);
    const feed = await PostService.getPostsCursor(after, {
      excludePinned: true,
    });
    expect(feed.items.map((item) => item.id)).toEqual([newer]);
  });

  it("keeps saveToken, so an open editor does not see an Edit Conflict", async () => {
    const apiKey = await seedAdminApiKey();
    const id = await createPublishedPost(apiKey, "Tokened", 1);
    const before = await readPost(apiKey, id);

    const pinned = (await (await pin(apiKey, id)).json()) as WriteResult;
    expect(pinned.success).toBe(true);
    expect(pinned.saveToken).toBe(before.saveToken);
    const afterPin = await readPost(apiKey, id);
    expect(afterPin.saveToken).toBe(pinned.saveToken);
    expect(afterPin.pinnedAt).not.toBeNull();

    const unpinned = (await (await unpin(apiKey, id)).json()) as WriteResult;
    expect(unpinned.saveToken).toBe(before.saveToken);
    const afterUnpin = await readPost(apiKey, id);
    expect(afterUnpin.saveToken).toBe(unpinned.saveToken);
    expect(afterUnpin.pinnedAt).toBeNull();
  });

  it("keeps a pinned post's place when it is pinned again", async () => {
    const apiKey = await seedAdminApiKey();
    const id = await createPublishedPost(apiKey, "Twice", 1);
    await pin(apiKey, id);
    const db = createTestContext().db;
    await db
      .update(PostsTable)
      .set({ pinnedAt: new Date("2026-01-01T00:00:00.000Z") })
      .where(eq(PostsTable.id, id));

    expect((await pin(apiKey, id)).status).toBe(200);

    const [row] = await db
      .select({ pinnedAt: PostsTable.pinnedAt })
      .from(PostsTable)
      .where(eq(PostsTable.id, id));
    expect(row.pinnedAt).toEqual(new Date("2026-01-01T00:00:00.000Z"));
  });

  it("does not touch the draft, the snapshot or updatedAt", async () => {
    const apiKey = await seedAdminApiKey();
    const id = await createPublishedPost(apiKey, "Untouched", 1);
    const db = createTestContext().db;
    const read = () =>
      db
        .select({
          updatedAt: PostsTable.updatedAt,
          title: PostsTable.title,
          snapshot: PostsTable.publicSnapshotJson,
        })
        .from(PostsTable)
        .where(eq(PostsTable.id, id))
        .then(([row]) => row);
    const before = await read();

    await pin(apiKey, id);

    expect(await read()).toEqual(before);
  });

  it("does not change the pin when the post is published", async () => {
    const apiKey = await seedAdminApiKey();
    const pinnedId = await createPublishedPost(apiKey, "Pinned", 1);
    const otherId = await createPublishedPost(apiKey, "Other", 2);
    await pin(apiKey, pinnedId);

    for (const id of [pinnedId, otherId]) {
      await callAdminApi(apiKey, `/admin/posts/${id}`, {
        method: "PATCH",
        body: { data: { title: `Edited ${id}` } },
      });
      await publish(apiKey, id);
    }

    expect((await readPost(apiKey, pinnedId)).pinnedAt).not.toBeNull();
    expect((await readPost(apiKey, otherId)).pinnedAt).toBeNull();
    expect(await homeIds()).toEqual([pinnedId, otherId]);
  });

  it("shows a draft's pin once the draft is published", async () => {
    const apiKey = await seedAdminApiKey();
    const older = await createPublishedPost(apiKey, "Older", 1);
    const draft = await createPost(apiKey, "Draft", 2);
    const newer = await createPublishedPost(apiKey, "Newer", 3);

    expect((await pin(apiKey, draft)).status).toBe(200);
    expect(await homeIds()).toEqual([newer, older]);

    await publish(apiKey, draft);
    expect(await homeIds()).toEqual([draft, newer, older]);
  });

  it("answers 404 for a post that does not exist", async () => {
    const apiKey = await seedAdminApiKey();
    expect((await pin(apiKey, 99999)).status).toBe(404);
    expect((await unpin(apiKey, 99999)).status).toBe(404);
  });

  it("refuses a PATCH that carries pinnedAt and writes nothing", async () => {
    const apiKey = await seedAdminApiKey();
    const id = await createPublishedPost(apiKey, "Strict", 1);
    const before = await readPost(apiKey, id);

    const response = await callAdminApi(apiKey, `/admin/posts/${id}`, {
      method: "PATCH",
      body: {
        data: { title: "renamed", pinnedAt: "2026-02-01T00:00:00.000Z" },
      },
    });

    expect(response.status).toBe(400);
    expect(await readPost(apiKey, id)).toEqual(before);
  });
});

describe("Migration 0027 (pin leaves the snapshot)", () => {
  it("keeps public ordering and pin state identical to what the snapshot showed", async () => {
    const context = createTestContext();
    const { db } = context;
    const row = (
      slug: string,
      day: number,
      options: { column: Date | null; snapshotPin: string | null },
    ) => ({
      title: slug,
      slug,
      status: "published" as const,
      publicSlug: slug,
      publishedAt: new Date(`2026-01-0${day}T00:00:00.000Z`),
      pinnedAt: options.column,
      publicSnapshotJson: {
        title: slug,
        summary: null,
        slug,
        contentJson: null,
        tagIds: [],
        categoryId: null,
        cover: null,
        publishedAt: `2026-01-0${day}T00:00:00.000Z`,
        // Snapshots written before this migration carry the pin.
        pinnedAt: options.snapshotPin,
      },
    });
    const [pinnedLate, pinnedEarly, staleDraftPin, draftUnpinned, plain] =
      await db
        .insert(PostsTable)
        .values([
          row("pinned-late", 1, {
            column: null,
            snapshotPin: "2026-02-03T08:30:15.250Z",
          }),
          row("pinned-early", 2, {
            column: new Date("2026-02-09T00:00:00.000Z"),
            snapshotPin: "2026-02-01T00:00:00.000Z",
          }),
          // Pinned only in the draft and never republished: not pinned on the site.
          row("stale-draft-pin", 3, {
            column: new Date("2026-02-05T00:00:00.000Z"),
            snapshotPin: null,
          }),
          // Unpinned in the draft but still pinned on the site.
          row("draft-unpinned", 4, {
            column: null,
            snapshotPin: "2026-02-02T00:00:00.000Z",
          }),
          row("plain", 5, { column: null, snapshotPin: null }),
        ])
        .returning();
    // An unpublished draft has no snapshot to take a pin from and keeps its own.
    const [draft] = await db
      .insert(PostsTable)
      .values({
        title: "draft",
        slug: "draft",
        pinnedAt: new Date("2026-02-07T00:00:00.000Z"),
      })
      .returning();

    const migration = env.TEST_MIGRATIONS.find((item) =>
      item.name.startsWith("0027_"),
    );
    expect(migration).toBeDefined();
    for (const query of migration!.queries) await env.DB.prepare(query).run();

    // What the site showed before: pinned posts by snapshot pin (newest pin
    // first), then everything else by publication date.
    expect(
      (await PostService.getHomePosts(context, 1)).items.map((i) => i.id),
    ).toEqual([
      pinnedLate.id,
      draftUnpinned.id,
      pinnedEarly.id,
      plain.id,
      staleDraftPin.id,
    ]);
    const pins = await db
      .select({ id: PostsTable.id, pinnedAt: PostsTable.pinnedAt })
      .from(PostsTable);
    const pinOf = (id: number) => pins.find((p) => p.id === id)?.pinnedAt;
    expect(pinOf(pinnedLate.id)).toEqual(new Date("2026-02-03T08:30:15.000Z"));
    expect(pinOf(pinnedEarly.id)).toEqual(new Date("2026-02-01T00:00:00.000Z"));
    expect(pinOf(staleDraftPin.id)).toBeNull();
    expect(pinOf(draftUnpinned.id)).toEqual(
      new Date("2026-02-02T00:00:00.000Z"),
    );
    expect(pinOf(plain.id)).toBeNull();
    expect(pinOf(draft.id)).toEqual(new Date("2026-02-07T00:00:00.000Z"));
  });
});
