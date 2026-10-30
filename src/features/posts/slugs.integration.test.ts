import { env } from "cloudflare:workers";
import {
  createAdminTestContext,
  createMockExecutionCtx,
  seedAdminApiKey,
} from "tests/test-utils";
import { describe, expect, it } from "vitest";
import * as PostService from "@/features/posts/services/posts.service";
import { unwrap } from "@/lib/errors";
import { createApiContext } from "@/lib/orpc/create-context";
import { openAPIHandler } from "@/lib/orpc/openapi-handler";

/**
 * What a slug may be: the caret and the slugs of the public lists are refused
 * with 400, every other printable ASCII symbol is published and read back, and
 * a slug made from a title keeps its letters.
 */

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

let created = 0;

async function newPost() {
  created += 1;
  return unwrap(
    await PostService.createDraft(createAdminTestContext(), {
      title: `slug post ${created}`,
    }),
  ).id;
}

describe("refused slugs", () => {
  it("answers 400 to a caret, saying why", async () => {
    const apiKey = await seedAdminApiKey();
    const id = await newPost();
    const response = await callAdminApi(apiKey, `/admin/posts/${id}`, {
      method: "PATCH",
      body: { data: { slug: "a^b" } },
    });
    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).toContain("^");
  });

  it.each(["pinned", "popular", "Pinned", "POPULAR", "ｐｏｐｕｌａｒ"])(
    "answers 400 to the reserved slug %s, saying why",
    async (slug) => {
      const apiKey = await seedAdminApiKey();
      const id = await newPost();
      const response = await callAdminApi(apiKey, `/admin/posts/${id}`, {
        method: "PATCH",
        body: { data: { slug } },
      });
      expect(response.status).toBe(400);
      expect(JSON.stringify(await response.json())).toContain(
        "/api/posts/pinned",
      );
    },
  );

  it("takes a slug that merely contains a reserved one", async () => {
    const apiKey = await seedAdminApiKey();
    const id = await newPost();
    const response = await callAdminApi(apiKey, `/admin/posts/${id}`, {
      method: "PATCH",
      body: { data: { slug: "pinned-notes" } },
    });
    expect(response.status).toBe(200);
  });

  it("keeps the public lists reachable, not shadowed by a post", async () => {
    const apiKey = await seedAdminApiKey();
    const response = await callAdminApi(apiKey, "/posts/pinned");
    expect(response.status).toBe(200);
    expect(Array.isArray(await response.json())).toBe(true);
  });
});

describe("symbols in a published slug", () => {
  it("opens the page of every printable ASCII symbol the API accepts", async () => {
    const apiKey = await seedAdminApiKey();
    const context = createAdminTestContext();
    const accepted: Array<string> = [];
    // One post, published again under each slug: a new slug replaces the
    // live one.
    const id = await newPost();
    for (let code = 0x21; code <= 0x7e; code += 1) {
      const character = String.fromCharCode(code);
      if (/[0-9A-Za-z]/.test(character)) continue;
      const slug = `t${character}t`;
      const patched = await callAdminApi(apiKey, `/admin/posts/${id}`, {
        method: "PATCH",
        body: { data: { slug } },
      });
      if (patched.status === 400) continue;
      expect(patched.status).toBe(200);
      unwrap(await PostService.publishPost(context, { id }));
      // The public API reads the post by the slug as the page route does,
      // decoded; the percent-encoded form is the same slug once decoded.
      const read = await callAdminApi(
        apiKey,
        `/posts/${encodeURIComponent(slug)}`,
      );
      expect(read.status, slug).toBe(200);
      expect(((await read.json()) as { slug: string }).slug).toBe(slug);
      accepted.push(character);
    }
    expect(accepted.join("")).toBe("!\"$&'()*+,-.:;<=>@[]_`{|}~");
  }, 120_000);
});

describe("generated slugs", () => {
  async function generate(title: string, excludeId?: number) {
    const context = createAdminTestContext();
    return (await PostService.generateSlug(context, { title, excludeId })).slug;
  }

  it.each([
    ["ﬁle", "file"],
    ["ＡＵＤＩＴ３ Fullwidth", "audit3-fullwidth"],
    ["Straße", "strasse"],
    ["Café", "cafe"],
    ["Hello, World", "hello-world"],
  ])("makes %j into %s", async (title, slug) => {
    expect(await generate(title)).toBe(slug);
  });

  it("numbers the fallback for a title of emoji alone, as for any taken slug", async () => {
    expect(await generate("😀🎉")).toBe("untitled-log");

    const context = createAdminTestContext();
    unwrap(await PostService.createDraft(context, { title: "😀" }));
    expect(await generate("🚀")).toBe("untitled-log-1");
    unwrap(await PostService.createDraft(context, { title: "🚀" }));
    expect(await generate("🎉")).toBe("untitled-log-2");
  });

  it("never hands out a reserved slug", async () => {
    expect(await generate("Pinned")).toBe("pinned-1");
    expect(await generate("popular")).toBe("popular-1");

    const context = createAdminTestContext();
    const draft = unwrap(
      await PostService.createDraft(context, { title: "Popular" }),
    );
    const read = await PostService.findPostById(context, { id: draft.id });
    expect(read?.slug).toBe("popular-1");
    expect(await generate("popular")).toBe("popular-2");
  });
});
