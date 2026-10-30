import { env } from "cloudflare:workers";
import type { JSONContent } from "@tiptap/react";
import { eq } from "drizzle-orm";
import {
  createAdminTestContext,
  createMockExecutionCtx,
  seedAdminApiKey,
} from "tests/test-utils";
import { describe, expect, it } from "vitest";
import * as MediaRepo from "@/features/media/data/media.data";
import * as MediaService from "@/features/media/service/media.service";
import { isMediaGone } from "@/features/posts/data/post-media.data";
import * as PostRepo from "@/features/posts/data/posts.data";
import * as PostService from "@/features/posts/services/posts.service";
import { MediaTable, PostMediaTable, PostsTable } from "@/lib/db/schema";
import { unwrap } from "@/lib/errors";
import { createApiContext } from "@/lib/orpc/create-context";
import { openAPIHandler } from "@/lib/orpc/openapi-handler";

/**
 * A body may show Media by its path only while that Media exists, and Media
 * the draft shows cannot be deleted, even when the save and the delete race.
 */

function imageDoc(...srcs: Array<string>): JSONContent {
  return {
    type: "doc",
    content: srcs.map((src) => ({ type: "image", attrs: { src } })),
  };
}

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

async function seedMedia(key: string) {
  const { db } = createAdminTestContext();
  return await MediaRepo.insertMedia(db, {
    key,
    url: `/images/${key}`,
    fileName: key,
    mimeType: "image/png",
    sizeInBytes: 10,
  });
}

let created = 0;

/** A new draft each time; createEmptyPost would hand back the same one. */
async function newPost() {
  created += 1;
  return unwrap(
    await PostService.createDraft(createAdminTestContext(), {
      title: `content media post ${created}`,
    }),
  ).id;
}

async function readContent(id: number) {
  const { db } = createAdminTestContext();
  const [row] = await db
    .select({ contentJson: PostsTable.contentJson })
    .from(PostsTable)
    .where(eq(PostsTable.id, id));
  return row?.contentJson ?? null;
}

async function mediaExists(key: string) {
  const { db } = createAdminTestContext();
  return (await MediaRepo.findMediaByKey(db, key)) !== null;
}

describe("writing a body that shows Media", () => {
  it("refuses a Media path no Media has, over JSON and Markdown", async () => {
    const apiKey = await seedAdminApiKey();
    await seedMedia("cm-present.png");
    const id = await newPost();

    const patched = await callAdminApi(apiKey, `/admin/posts/${id}`, {
      method: "PATCH",
      body: {
        data: {
          contentJson: imageDoc(
            "/images/cm-present.png",
            "/images/does-not-exist.png?v=1",
          ),
        },
      },
    });
    expect(patched.status).toBe(400);
    const body = (await patched.json()) as {
      code: string;
      data: { images: Array<string> };
    };
    expect(body.code).toBe("CONTENT_IMAGE_NOT_FOUND");
    expect(body.data.images).toEqual(["/images/does-not-exist.png?v=1"]);
    expect(await readContent(id)).toBeNull();

    const markdown = await callAdminApi(apiKey, `/admin/posts/${id}`, {
      method: "PATCH",
      body: { data: { contentMarkdown: "![gone](/images/gone.png)" } },
    });
    expect(markdown.status).toBe(400);
    expect(((await markdown.json()) as { code: string }).code).toBe(
      "CONTENT_IMAGE_NOT_FOUND",
    );

    const created = await callAdminApi(apiKey, "/admin/posts", {
      method: "POST",
      body: {
        data: {
          title: "cm-create",
          contentMarkdown: "![gone](/images/gone.png)",
        },
      },
    });
    expect(created.status).toBe(400);
    expect(((await created.json()) as { code: string }).code).toBe(
      "CONTENT_IMAGE_NOT_FOUND",
    );
  });

  it("takes existing Media and external images, and locks the Media at once", async () => {
    const apiKey = await seedAdminApiKey();
    const media = await seedMedia("cm-kept.png");
    const id = await newPost();

    const patched = await callAdminApi(apiKey, `/admin/posts/${id}`, {
      method: "PATCH",
      body: {
        data: {
          contentJson: imageDoc(
            "/images/cm-kept.png",
            "https://cdn.example.org/images/elsewhere.png",
          ),
        },
      },
    });
    expect(patched.status).toBe(200);

    const { db } = createAdminTestContext();
    const used = await db
      .select({ mediaId: PostMediaTable.mediaId })
      .from(PostMediaTable)
      .where(eq(PostMediaTable.postId, id));
    expect(used).toEqual([{ mediaId: media.id }]);
    const refused = await MediaService.deleteImage(
      createAdminTestContext(),
      "cm-kept.png",
    );
    expect(refused.error?.reason).toBe("MEDIA_IN_USE");
  });

  it("still saves a body whose draft already showed Media that is gone", async () => {
    const context = createAdminTestContext();
    const id = await newPost();
    // Written before Media references were checked.
    await context.db
      .update(PostsTable)
      .set({ contentJson: imageDoc("/images/cm-legacy.png") })
      .where(eq(PostsTable.id, id));

    const saved = await PostService.updatePost(context, {
      id,
      data: {
        contentJson: {
          type: "doc",
          content: [
            ...imageDoc("/images/cm-legacy.png").content!,
            { type: "paragraph", content: [{ type: "text", text: "more" }] },
          ],
        },
      },
    });
    expect(saved.error).toBeNull();

    const added = await PostService.updatePost(context, {
      id,
      data: {
        contentJson: imageDoc("/images/cm-legacy.png", "/images/cm-new.png"),
      },
    });
    expect(added.error).toEqual({
      reason: "CONTENT_IMAGE_NOT_FOUND",
      images: ["/images/cm-new.png"],
    });
  });

  // The tests run with DOMAIN=example.com.
  it("checks a Media path on the site's own address like the bare path", async () => {
    const apiKey = await seedAdminApiKey();
    const media = await seedMedia("cm-site.png");
    const id = await newPost();

    const refused = await callAdminApi(apiKey, `/admin/posts/${id}`, {
      method: "PATCH",
      body: {
        data: {
          contentJson: imageDoc(
            "https://example.com/images/cm-nope.png",
            "http://EXAMPLE.com/images/cm-nope2.png?width=800",
          ),
        },
      },
    });
    expect(refused.status).toBe(400);
    const body = (await refused.json()) as {
      code: string;
      data: { images: Array<string> };
    };
    expect(body.code).toBe("CONTENT_IMAGE_NOT_FOUND");
    expect(body.data.images).toEqual([
      "https://example.com/images/cm-nope.png",
      "http://EXAMPLE.com/images/cm-nope2.png?width=800",
    ]);

    const markdown = await callAdminApi(apiKey, `/admin/posts/${id}`, {
      method: "PATCH",
      body: {
        data: {
          contentMarkdown: "![x](https://example.com/images/cm-nope.png)",
        },
      },
    });
    expect(markdown.status).toBe(400);
    expect(await readContent(id)).toBeNull();

    const saved = await callAdminApi(apiKey, `/admin/posts/${id}`, {
      method: "PATCH",
      body: {
        data: {
          contentJson: imageDoc("https://example.com/images/cm-site.png"),
        },
      },
    });
    expect(saved.status).toBe(200);
    const { db } = createAdminTestContext();
    const used = await db
      .select({ mediaId: PostMediaTable.mediaId })
      .from(PostMediaTable)
      .where(eq(PostMediaTable.postId, id));
    expect(used).toEqual([{ mediaId: media.id }]);
  });

  it("lets a draft keep only gone Media it already showed by path", async () => {
    const context = createAdminTestContext();
    const external = await newPost();
    const onSite = await newPost();
    // Written before Media references were checked.
    await context.db
      .update(PostsTable)
      .set({
        contentJson: imageDoc("https://cdn.example.org/images/cm-gone.png"),
      })
      .where(eq(PostsTable.id, external));
    await context.db
      .update(PostsTable)
      .set({ contentJson: imageDoc("https://example.com/images/cm-gone.png") })
      .where(eq(PostsTable.id, onSite));

    // Another host's image of the same name is not this Media.
    const fromExternal = await PostService.updatePost(context, {
      id: external,
      data: { contentJson: imageDoc("/images/cm-gone.png") },
    });
    expect(fromExternal.error).toEqual({
      reason: "CONTENT_IMAGE_NOT_FOUND",
      images: ["/images/cm-gone.png"],
    });

    const fromSite = await PostService.updatePost(context, {
      id: onSite,
      data: {
        contentJson: imageDoc(
          "https://example.com/images/cm-gone.png",
          "/images/cm-gone.png",
        ),
      },
    });
    expect(fromSite.error).toBeNull();
  });

  it("writes nothing when the Media goes between the check and the write", async () => {
    const context = createAdminTestContext();
    const id = await newPost();
    const before = await PostRepo.findPostSaveToken(context.db, id);

    // The service checked that the Media exists; it is deleted before the
    // write, so the write's own guard is what refuses it.
    const write = PostRepo.updatePost(
      context.db,
      id,
      { contentJson: imageDoc("/images/cm-raced.png") },
      { media: { keys: ["cm-raced.png"], mediaIds: [] } },
    );

    await expect(write).rejects.toSatisfy(isMediaGone);
    expect(await readContent(id)).toBeNull();
    expect(await PostRepo.findPostSaveToken(context.db, id)).toBe(before);
  });

  it("never leaves a body showing deleted Media when a save and a delete race", async () => {
    const context = createAdminTestContext();
    for (let round = 0; round < 6; round += 1) {
      const key = `cm-race-${round}.png`;
      await seedMedia(key);
      const id = await newPost();

      const [saved, deleted] = await Promise.all([
        PostService.updatePost(context, {
          id,
          data: { contentJson: imageDoc(`/images/${key}`) },
        }),
        MediaService.deleteImage(createAdminTestContext(), key),
      ]);

      // Exactly one of them wins.
      expect([saved.error === null, deleted.error === null]).toContain(true);
      expect(saved.error === null && deleted.error === null).toBe(false);
      if (deleted.error === null) {
        expect(saved.error?.reason).toBe("CONTENT_IMAGE_NOT_FOUND");
        expect(await readContent(id)).toBeNull();
        expect(await mediaExists(key)).toBe(false);
      } else {
        expect(deleted.error.reason).toBe("MEDIA_IN_USE");
        expect(await readContent(id)).toMatchObject(imageDoc(`/images/${key}`));
        expect(await mediaExists(key)).toBe(true);
      }
    }
  });

  it("refuses a cover Media deleted before the write", async () => {
    const context = createAdminTestContext();
    const id = await newPost();
    const media = await seedMedia("cm-cover.png");
    await context.db.delete(MediaTable).where(eq(MediaTable.id, media.id));

    const saved = await PostService.updatePost(context, {
      id,
      data: { coverMediaId: media.id },
    });
    expect(saved.error?.reason).toBe("MEDIA_NOT_FOUND");

    // The cover's foreign key refuses the write before its guard does.
    const write = PostRepo.updatePost(
      context.db,
      id,
      { coverMediaId: media.id },
      { media: { keys: [], mediaIds: [media.id] } },
    );
    await expect(write).rejects.toThrow(/FOREIGN KEY constraint failed/);
  });

  it("creates a draft whose body shows existing Media", async () => {
    const context = createAdminTestContext();
    await seedMedia("cm-created.png");
    const created = unwrap(
      await PostService.createDraft(context, {
        title: "cm-created",
        contentJson: imageDoc("/images/cm-created.png"),
      }),
    );
    const refused = await MediaService.deleteImage(
      createAdminTestContext(),
      "cm-created.png",
    );
    expect(refused.error?.reason).toBe("MEDIA_IN_USE");
    expect(await readContent(created.id)).toMatchObject(
      imageDoc("/images/cm-created.png"),
    );
  });
});
