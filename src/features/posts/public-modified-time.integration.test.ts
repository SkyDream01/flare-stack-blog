import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import {
  createMockExecutionCtx,
  createTestContext,
  seedAdminApiKey,
} from "tests/test-utils";
import { describe, expect, it } from "vitest";
import * as PostService from "@/features/posts/services/posts.service";
import {
  buildAtomXml,
  buildFeedJson,
  buildRssXml,
  buildSitemapXml,
} from "@/features/site-documents/service/site-documents.service";
import { PostsTable } from "@/lib/db/schema";
import { createApiContext } from "@/lib/orpc/create-context";
import { openAPIHandler } from "@/lib/orpc/openapi-handler";
import { buildArticleJsonLd } from "@/lib/seo";

/**
 * The modification time the public site shows for a Post is the time its
 * Public Content Snapshot was last published. Saving the draft moves the
 * draft's updatedAt, and that must reach no public surface.
 */

const DRAFT_SAVED_AT = new Date("2031-02-03T04:05:06.000Z");

async function callAdminApi(
  apiKey: string,
  path: string,
  body: unknown,
  method: "POST" | "PATCH" = "POST",
) {
  const headers = new Headers({
    "x-api-key": apiKey,
    "Content-Type": "application/json",
  });
  const request = new Request(`http://localhost:3000/api${path}`, {
    method,
    headers,
    body: JSON.stringify(body),
  });
  const { response } = await openAPIHandler.handle(request, {
    prefix: "/api",
    context: createApiContext(request.headers, env, createMockExecutionCtx()),
  });
  if (!response) throw new Error(`No route matched ${method} ${path}`);
  expect(response.status).toBe(200);
  return (await response.json()) as { id: number };
}

async function snapshotOf(id: number) {
  const post = await createTestContext().db.query.PostsTable.findFirst({
    where: eq(PostsTable.id, id),
  });
  if (!post?.publicSnapshotJson) throw new Error("Expected a snapshot");
  return { snapshot: post.publicSnapshotJson, slug: post.publicSlug ?? "" };
}

/** Every public surface that carries the Post's modification time. */
async function publicModifiedTimes(id: number, slug: string) {
  const context = createTestContext();
  const executionCtx = createMockExecutionCtx();

  const listed = await PostService.getPostsCursor(context, {});
  const home = await PostService.getHomePosts(context, 1);
  const detail = await PostService.findPostBySlug(context, { slug });
  if (!detail) throw new Error("Expected the public post");

  const jsonLd = JSON.parse(
    buildArticleJsonLd({
      authorName: "Author",
      canonicalHref: `https://blog.example/post/${slug}`,
      post: detail,
    }),
  ) as { dateModified: string };

  const sitemap = await buildSitemapXml(env);
  const sitemapLastmod = new RegExp(
    `/post/${slug}</loc>\\s*<lastmod>([^<]+)</lastmod>`,
  ).exec(sitemap)?.[1];

  const feedJson = JSON.parse(await buildFeedJson(env, executionCtx)) as {
    items: Array<{ id: string; date_modified: string }>;
  };
  const rss = await buildRssXml(env, executionCtx);
  const atom = await buildAtomXml(env, executionCtx);

  return {
    list: listed.items.find((item) => item.id === id)?.updatedAt.toISOString(),
    home: home.items.find((item) => item.id === id)?.updatedAt.toISOString(),
    detail: detail.updatedAt.toISOString(),
    jsonLd: jsonLd.dateModified,
    sitemap: sitemapLastmod,
    jsonFeed: feedJson.items.find((item) => item.id === String(id))
      ?.date_modified,
    atomEntry: new RegExp(
      `<id>${id}</id>[\\s\\S]*?<updated>([^<]+)</updated>`,
    ).exec(atom)?.[1],
    atomFeed: /<\/title>\s*<updated>([^<]+)<\/updated>/.exec(atom)?.[1],
    rssLastBuild: /<lastBuildDate>([^<]+)<\/lastBuildDate>/.exec(rss)?.[1],
    rssText: rss,
    atomText: atom,
  };
}

describe("public modification time", () => {
  it("is the last publication on every public surface, and a draft save moves none", async () => {
    const apiKey = await seedAdminApiKey();
    const { id } = await callAdminApi(apiKey, "/admin/posts", {
      data: { title: "Modified time post", contentMarkdown: "Published body" },
    });
    await callAdminApi(apiKey, `/admin/posts/${id}/publish`, {});
    const first = await snapshotOf(id);
    const lastPublishedAt = first.snapshot.lastPublishedAt;
    expect(lastPublishedAt).toEqual(expect.any(String));

    // A later edit nobody published moves the draft's updatedAt.
    await callAdminApi(
      apiKey,
      `/admin/posts/${id}`,
      { data: { contentMarkdown: "An unpublished edit" } },
      "PATCH",
    );
    await createTestContext()
      .db.update(PostsTable)
      .set({ updatedAt: DRAFT_SAVED_AT })
      .where(eq(PostsTable.id, id));

    const beforeRepublish = await publicModifiedTimes(id, first.slug);
    expect(beforeRepublish).toMatchObject({
      list: lastPublishedAt,
      home: lastPublishedAt,
      detail: lastPublishedAt,
      jsonLd: lastPublishedAt,
      sitemap: lastPublishedAt,
      jsonFeed: lastPublishedAt,
      atomEntry: lastPublishedAt,
    });
    expect(beforeRepublish.atomFeed).toBe(lastPublishedAt);
    expect(beforeRepublish.rssLastBuild).toBe(
      new Date(lastPublishedAt ?? "").toUTCString(),
    );
    for (const text of [beforeRepublish.rssText, beforeRepublish.atomText]) {
      expect(text).not.toContain("2031");
    }
    // The publication date stays the Post's own.
    expect(beforeRepublish.atomText).toContain(
      `<published>${first.snapshot.publishedAt}</published>`,
    );

    // Publishing replaces the snapshot, and with it the time on every surface.
    await new Promise((resolve) => setTimeout(resolve, 20));
    await callAdminApi(apiKey, `/admin/posts/${id}/publish`, {});
    const second = await snapshotOf(id);
    const republishedAt = second.snapshot.lastPublishedAt;
    expect(republishedAt).not.toBe(lastPublishedAt);

    const afterRepublish = await publicModifiedTimes(id, second.slug);
    expect(afterRepublish).toMatchObject({
      list: republishedAt,
      home: republishedAt,
      jsonLd: republishedAt,
      sitemap: republishedAt,
      jsonFeed: republishedAt,
      atomEntry: republishedAt,
    });
  });

  it("falls back to the publication date for a snapshot without lastPublishedAt", async () => {
    const apiKey = await seedAdminApiKey();
    const { id } = await callAdminApi(apiKey, "/admin/posts", {
      data: { title: "Older snapshot time", contentMarkdown: "Body" },
    });
    await callAdminApi(apiKey, `/admin/posts/${id}/publish`, {});
    const { snapshot, slug } = await snapshotOf(id);
    const { lastPublishedAt: _removed, ...older } = snapshot;
    await createTestContext()
      .db.update(PostsTable)
      .set({
        publicSnapshotJson: {
          ...older,
          publishedAt: "2026-01-02T03:04:05.000Z",
        },
        updatedAt: DRAFT_SAVED_AT,
      })
      .where(eq(PostsTable.id, id));

    const times = await publicModifiedTimes(id, slug);
    expect(times).toMatchObject({
      list: "2026-01-02T03:04:05.000Z",
      detail: "2026-01-02T03:04:05.000Z",
      jsonLd: "2026-01-02T03:04:05.000Z",
      sitemap: "2026-01-02T03:04:05.000Z",
      jsonFeed: "2026-01-02T03:04:05.000Z",
    });
  });
});
