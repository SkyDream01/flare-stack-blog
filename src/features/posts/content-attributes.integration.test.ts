import { env } from "cloudflare:workers";
import type { JSONContent } from "@tiptap/core";
import { getSchema } from "@tiptap/core";
import { eq } from "drizzle-orm";
import {
  createAdminTestContext,
  createMockExecutionCtx,
  seedAdminApiKey,
} from "tests/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import * as MediaRepo from "@/features/media/data/media.data";
import * as PostRevisionRepo from "@/features/posts/data/post-revisions.data";
import { createSchemaExtensions } from "@/features/posts/editor/schema";
import { PostsTable } from "@/lib/db/schema";
import { createApiContext } from "@/lib/orpc/create-context";
import { openAPIHandler } from "@/lib/orpc/openapi-handler";

/**
 * Which attributes a body's nodes and marks may carry over the Admin HTTP
 * API, which the editor's own saves use too, and which the public site gives
 * out.
 */

async function callApi(
  path: string,
  init: { apiKey?: string; method?: string; body?: unknown } = {},
) {
  const headers = new Headers();
  if (init.apiKey) headers.set("x-api-key", init.apiKey);
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

interface AdminPost {
  id: number;
  slug: string;
  contentJson: JSONContent | null;
}

async function createPost(apiKey: string, contentJson: JSONContent) {
  const response = await callApi("/admin/posts", {
    apiKey,
    method: "POST",
    body: { data: { title: "Attributes", contentJson } },
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as { id: number }).id;
}

async function readPost(apiKey: string, id: number) {
  const response = await callApi(`/admin/posts/${id}`, { apiKey });
  expect(response.status).toBe(200);
  return (await response.json()) as AdminPost;
}

function patchBody(apiKey: string, id: number, contentJson: unknown) {
  return callApi(`/admin/posts/${id}`, {
    apiKey,
    method: "PATCH",
    body: { data: { contentJson } },
  });
}

function doc(...content: Array<JSONContent>): JSONContent {
  return { type: "doc", content };
}

function linked(attrs: Record<string, unknown>): JSONContent {
  return {
    type: "paragraph",
    content: [{ type: "text", text: "go", marks: [{ type: "link", attrs }] }],
  };
}

const schema = getSchema(createSchemaExtensions());

/** `content` as the editor saves it, every attribute filled in. */
function editorJson(content: JSONContent): JSONContent {
  return schema.nodeFromJSON(content).toJSON() as JSONContent;
}

/**
 * Every attribute drafts on the live site hold, with values seen there,
 * including what older editors stored: heading `data-toc-id` and image
 * `align`, `aspectRatio` and `caption`.
 */
const LIVE_BODY = doc(
  {
    type: "heading",
    attrs: { level: 2, id: "intro", "data-toc-id": "toc-1" },
    content: [{ type: "text", text: "Intro" }],
  },
  linked({
    href: "https://example.com",
    target: "_blank",
    rel: "noopener noreferrer",
    class: "notion-link-token notion-focusable-token",
    title: null,
  }),
  linked({
    href: "https://example.org",
    target: "_blank",
    rel: "noopener noreferrer nofollow",
    class: null,
    title: "Example",
  }),
  {
    type: "codeBlock",
    attrs: { language: "ts", highlightedHtml: null },
    content: [{ type: "text", text: "const a = 1;" }],
  },
  {
    type: "image",
    attrs: {
      src: "/images/attr.png",
      alt: "A",
      title: null,
      width: 640,
      height: 480,
      align: "center",
      aspectRatio: 1.5,
      caption: "Old caption",
    },
  },
  {
    type: "orderedList",
    attrs: { start: 3, type: null },
    content: [
      {
        type: "listItem",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "item" }] },
        ],
      },
    ],
  },
  {
    type: "table",
    content: [
      {
        type: "tableRow",
        content: [
          {
            type: "tableHeader",
            attrs: { colspan: 2, rowspan: 1, colwidth: [100, 200] },
            content: [{ type: "paragraph" }],
          },
        ],
      },
      {
        type: "tableRow",
        content: [
          {
            type: "tableCell",
            attrs: { colspan: 1, rowspan: 1, colwidth: null },
            content: [{ type: "paragraph" }],
          },
          {
            type: "tableCell",
            attrs: { colspan: 1, rowspan: 1, colwidth: null },
            content: [{ type: "paragraph" }],
          },
        ],
      },
    ],
  },
  {
    type: "video",
    attrs: {
      provider: "bilibili",
      videoId: "BV1fK4y1s7Qf",
      page: 2,
      start: 90,
      title: "A video",
      cover: "https://i0.hdslb.com/bfs/archive/cover.jpg",
      duration: 321,
    },
  },
);

/** The attribute names of every node and mark in `content`. */
function attributeNames(content: JSONContent | null): Array<string> {
  if (!content) return [];
  const names = new Set<string>();
  const visit = (node: JSONContent) => {
    for (const name of Object.keys(node.attrs ?? {})) {
      names.add(`${node.type}.${name}`);
    }
    for (const mark of node.marks ?? []) {
      for (const name of Object.keys(mark.attrs ?? {})) {
        names.add(`${mark.type}.${name}`);
      }
    }
    node.content?.forEach(visit);
  };
  visit(content);
  return [...names];
}

beforeEach(async () => {
  await MediaRepo.insertMedia(createAdminTestContext().db, {
    key: "attr.png",
    url: "/images/attr.png",
    fileName: "attr.png",
    mimeType: "image/png",
    sizeInBytes: 10,
  });
});

describe("contentJson attributes", () => {
  it("refuses attributes the editor does not give a node or mark, naming them", async () => {
    const apiKey = await seedAdminApiKey();
    const before = doc({
      type: "paragraph",
      content: [{ type: "text", text: "Before" }],
    });
    const id = await createPost(apiKey, before);

    const response = await patchBody(
      apiKey,
      id,
      doc(
        linked({ href: "https://example.com", onclick: "steal()" }),
        {
          type: "paragraph",
          attrs: { style: "position:fixed" },
          content: [{ type: "text", text: "x" }],
        },
        { type: "image", attrs: { src: "/images/attr.png", onerror: "x()" } },
      ),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      code: string;
      message: string;
      data: { attributes: Array<string> };
    };
    expect(body.code).toBe("CONTENT_JSON_INVALID");
    expect(body.data.attributes).toEqual([
      "link.onclick",
      "paragraph.style",
      "image.onerror",
    ]);
    expect(body.message).toContain('"link.onclick"');
    expect((await readPost(apiKey, id)).contentJson).toEqual(before);

    const create = await callApi("/admin/posts", {
      apiKey,
      method: "POST",
      body: {
        data: {
          title: "Bad",
          contentJson: doc(linked({ href: "/a", style: "color:red" })),
        },
      },
    });
    expect(create.status).toBe(400);
  });

  it("accepts the attributes live drafts hold and drops what older editors stored", async () => {
    const apiKey = await seedAdminApiKey();
    const id = await createPost(apiKey, LIVE_BODY);
    const stored = (await readPost(apiKey, id)).contentJson;

    const names = attributeNames(stored);
    expect(names).toEqual(
      expect.arrayContaining([
        "heading.level",
        "heading.id",
        "link.target",
        "link.rel",
        "link.class",
        "link.title",
        "image.width",
        "orderedList.start",
        "tableHeader.colwidth",
        "video.duration",
      ]),
    );
    for (const legacy of [
      "heading.data-toc-id",
      "image.align",
      "image.aspectRatio",
      "image.caption",
    ]) {
      expect(names).not.toContain(legacy);
    }

    // The body as read writes back, and so does the editor's own JSON of it.
    expect((await patchBody(apiKey, id, stored)).status).toBe(200);
    expect(
      (await patchBody(apiKey, id, editorJson(stored ?? doc()))).status,
    ).toBe(200);
  });

  it("restores an older revision with only the editor's attributes", async () => {
    const apiKey = await seedAdminApiKey();
    const id = await createPost(
      apiKey,
      doc({ type: "paragraph", content: [{ type: "text", text: "Now" }] }),
    );
    const post = await readPost(apiKey, id);
    const revision = await PostRevisionRepo.insertPostRevision(
      createAdminTestContext().db,
      {
        postId: id,
        reason: "publish",
        snapshotHash: "older-editor",
        snapshotJson: {
          title: "Attributes",
          summary: null,
          slug: post.slug,
          status: "published",
          publishedAt: null,
          contentJson: doc(
            {
              type: "heading",
              attrs: { level: 2, id: "old", "data-toc-id": "toc-9" },
              content: [{ type: "text", text: "Old" }],
            },
            linked({ href: "https://example.com", onclick: "steal()" }),
            {
              type: "image",
              attrs: { src: "/images/attr.png", caption: "c", align: "left" },
            },
          ),
          tagIds: [],
          categoryId: null,
          coverMediaId: null,
        },
      },
    );

    const response = await callApi(
      `/admin/posts/${id}/revisions/${revision.id}/restore`,
      { apiKey, method: "POST", body: {} },
    );
    expect(response.status).toBe(200);

    const restored = (await readPost(apiKey, id)).contentJson;
    expect(attributeNames(restored)).toEqual([
      "heading.level",
      "heading.id",
      "link.href",
      "image.src",
    ]);
    expect((await patchBody(apiKey, id, restored)).status).toBe(200);
  });
});

describe("the public post", () => {
  it("gives out links without target, rel or class, and no attribute a write refuses", async () => {
    const apiKey = await seedAdminApiKey();
    const id = await createPost(
      apiKey,
      doc(
        linked({
          href: "https://example.com",
          target: "_self",
          rel: "opener",
          class: "fixed inset-0",
          title: "Example",
        }),
      ),
    );
    const published = await callApi(`/admin/posts/${id}/publish`, {
      apiKey,
      method: "POST",
      body: {},
    });
    expect(published.status).toBe(200);

    // A snapshot published before writes were checked.
    const { db } = createAdminTestContext();
    const [row] = await db
      .select({ snapshot: PostsTable.publicSnapshotJson })
      .from(PostsTable)
      .where(eq(PostsTable.id, id));
    const snapshot = row.snapshot;
    if (!snapshot) throw new Error("Expected a snapshot");
    await db
      .update(PostsTable)
      .set({
        publicSnapshotJson: {
          ...snapshot,
          contentJson: doc(...(snapshot.contentJson?.content ?? []), {
            type: "image",
            attrs: { src: "/images/attr.png", onerror: "x()" },
          }),
        },
      })
      .where(eq(PostsTable.id, id));

    const response = await callApi(
      `/posts/${encodeURIComponent((await readPost(apiKey, id)).slug)}`,
    );
    expect(response.status).toBe(200);
    const { contentJson } = (await response.json()) as AdminPost;
    expect(attributeNames(contentJson)).toEqual([
      "link.href",
      "link.title",
      "image.src",
    ]);
  });
});
