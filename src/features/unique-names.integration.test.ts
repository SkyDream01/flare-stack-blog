import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import {
  createAdminTestContext,
  createMockExecutionCtx,
  seedAdminApiKey,
} from "tests/test-utils";
import { describe, expect, it } from "vitest";
import * as CategoryService from "@/features/categories/categories.service";
import * as PostService from "@/features/posts/services/posts.service";
import * as TagService from "@/features/tags/tags.service";
import { PostsTable, TagsTable } from "@/lib/db/schema";
import { parkedKey } from "@/lib/db/unique-keys";
import { unwrap } from "@/lib/errors";
import { createApiContext } from "@/lib/orpc/create-context";
import { openAPIHandler } from "@/lib/orpc/openapi-handler";
import { uniqueKeyOf } from "@/lib/unicode-text";

/**
 * Tag and Category names, post slugs and public slugs are unique ignoring
 * case and NFKC forms, and the database holds that under concurrent writes;
 * names, slugs and titles refuse control and format characters.
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

async function codeOf(response: Response) {
  return ((await response.json()) as { code?: string }).code;
}

function statuses(responses: Array<Response>) {
  return responses.map((response) => response.status).sort((a, b) => a - b);
}

let created = 0;

/** A new draft each time; createEmptyPost would hand back the same one. */
async function newPost() {
  created += 1;
  return unwrap(
    await PostService.createDraft(createAdminTestContext(), {
      title: `unique names post ${created}`,
    }),
  ).id;
}

describe.each([
  ["tags", "TAG_NAME_ALREADY_EXISTS"],
  ["categories", "CATEGORY_NAME_ALREADY_EXISTS"],
])("/admin/%s names", (collection, conflict) => {
  it("lets one of concurrent case and NFKC variants through, 409 for the rest", async () => {
    const apiKey = await seedAdminApiKey();
    const responses = await Promise.all(
      ["Rust", "rust", "RUST", "ＲＵＳＴ", "ｒｕｓｔ"].map((name) =>
        callAdminApi(apiKey, `/admin/${collection}`, {
          method: "POST",
          body: { name },
        }),
      ),
    );
    expect(statuses(responses)).toEqual([200, 409, 409, 409, 409]);
    for (const response of responses.filter((r) => r.status === 409)) {
      expect(await codeOf(response)).toBe(conflict);
    }
  });

  it("answers 409, not 500, to concurrent exact duplicates", async () => {
    const apiKey = await seedAdminApiKey();
    const responses = await Promise.all(
      Array.from({ length: 4 }, () =>
        callAdminApi(apiKey, `/admin/${collection}`, {
          method: "POST",
          body: { name: "Go" },
        }),
      ),
    );
    expect(statuses(responses)).toEqual([200, 409, 409, 409]);
  });

  it("refuses a rename to an NFKC variant of another name", async () => {
    const apiKey = await seedAdminApiKey();
    const create = async (name: string) =>
      (await (
        await callAdminApi(apiKey, `/admin/${collection}`, {
          method: "POST",
          body: { name },
        })
      ).json()) as { id: number };
    await create("Café");
    const other = await create("Tea");

    const renamed = await callAdminApi(
      apiKey,
      `/admin/${collection}/${other.id}`,
      { method: "PATCH", body: { data: { name: "CAFÉ" } } },
    );
    expect(renamed.status).toBe(409);
    expect(await codeOf(renamed)).toBe(conflict);

    const ownCase = await callAdminApi(
      apiKey,
      `/admin/${collection}/${other.id}`,
      { method: "PATCH", body: { data: { name: "TEA" } } },
    );
    expect(ownCase.status).toBe(200);
  });

  it.each([
    ["a zero width space", "a\u200Bb"],
    ["a right-to-left override", "abc\u202E"],
    ["a tab", "a\tb"],
    ["NUL", "a\u0000b"],
  ])("refuses a name with %s", async (_name, name) => {
    const apiKey = await seedAdminApiKey();
    const response = await callAdminApi(apiKey, `/admin/${collection}`, {
      method: "POST",
      body: { name },
    });
    expect(response.status).toBe(400);
  });

  it("treats Straße, STRAẞE and Strasse as one name, and a variation selector as nothing", async () => {
    const apiKey = await seedAdminApiKey();
    const create = (name: string) =>
      callAdminApi(apiKey, `/admin/${collection}`, {
        method: "POST",
        body: { name },
      });
    expect((await create("Strasse")).status).toBe(200);
    for (const name of ["Straße", "STRAẞE", "straße", "ＳＴＲＡＳＳＥ"]) {
      const response = await create(name);
      expect(response.status, name).toBe(409);
      expect(await codeOf(response)).toBe(conflict);
    }

    expect((await create("Love ❤")).status).toBe(200);
    // Only a variation selector more: it shows the same.
    const selector = await create("Love ❤️");
    expect(selector.status).toBe(409);
    expect(await codeOf(selector)).toBe(conflict);
    // But a different name stays possible.
    expect((await create("Love ❤ it")).status).toBe(200);
  });

  it("keeps a no-break space or fullwidth letters as written, but compares them", async () => {
    const apiKey = await seedAdminApiKey();
    const created = await callAdminApi(apiKey, `/admin/${collection}`, {
      method: "POST",
      body: { name: "Ｎｅｗ\u00A0York" },
    });
    expect(created.status).toBe(200);
    expect(((await created.json()) as { name: string }).name).toBe(
      "Ｎｅｗ\u00A0York",
    );
    const variant = await callAdminApi(apiKey, `/admin/${collection}`, {
      method: "POST",
      body: { name: "new york" },
    });
    expect(variant.status).toBe(409);
  });
});

describe("post slugs", () => {
  it("lets one of two posts take concurrent case variants of a slug", async () => {
    const apiKey = await seedAdminApiKey();
    const [first, second] = [await newPost(), await newPost()];
    const responses = await Promise.all(
      [
        [first, "Same-Slug"],
        [second, "same-slug"],
      ].map(([id, slug]) =>
        callAdminApi(apiKey, `/admin/posts/${id}`, {
          method: "PATCH",
          body: { data: { slug } },
        }),
      ),
    );
    expect(statuses(responses)).toEqual([200, 409]);
    const loser = responses.find((response) => response.status === 409)!;
    expect(await codeOf(loser)).toBe("SLUG_TAKEN");
  });

  it("compares slugs after NFKC, and refuses format characters and no-break spaces", async () => {
    const apiKey = await seedAdminApiKey();
    const [first, second] = [await newPost(), await newPost()];
    const patch = (id: number, slug: string) =>
      callAdminApi(apiKey, `/admin/posts/${id}`, {
        method: "PATCH",
        body: { data: { slug } },
      });

    expect((await patch(first, "ＡＢＣ-notes")).status).toBe(200);
    const variant = await patch(second, "abc-NOTES");
    expect(variant.status).toBe(409);
    expect(await codeOf(variant)).toBe("SLUG_TAKEN");

    for (const slug of ["a\u200Bb", "a\u00A0b", "a\u202Eb", "a\tb"]) {
      expect((await patch(second, slug)).status).toBe(400);
    }
  });

  it("compares slugs by full case folding and ignores variation selectors", async () => {
    const apiKey = await seedAdminApiKey();
    const [first, second, third] = [
      await newPost(),
      await newPost(),
      await newPost(),
    ];
    const patch = (id: number, slug: string) =>
      callAdminApi(apiKey, `/admin/posts/${id}`, {
        method: "PATCH",
        body: { data: { slug } },
      });

    expect((await patch(first, "Strasse")).status).toBe(200);
    for (const slug of ["STRA\u1E9EE", "Stra\u00DFe"]) {
      const response = await patch(second, slug);
      expect(response.status, slug).toBe(409);
      expect(await codeOf(response)).toBe("SLUG_TAKEN");
    }
    expect((await patch(second, "heart-\u2764")).status).toBe(200);
    const selector = await patch(third, "heart-\u2764\uFE0F");
    expect(selector.status).toBe(409);
    expect(await codeOf(selector)).toBe("SLUG_TAKEN");
  });

  it("refuses a slug equal to another post's live page under NFKC", async () => {
    const context = createAdminTestContext();
    const live = await newPost();
    unwrap(
      await PostService.updatePost(context, {
        id: live,
        data: { title: "live", slug: "Ｌｉｖｅ" },
      }),
    );
    unwrap(await PostService.publishPost(context, { id: live }));
    unwrap(
      await PostService.updatePost(context, {
        id: live,
        data: { slug: "moved" },
      }),
    );

    const other = await newPost();
    const taken = await PostService.updatePost(context, {
      id: other,
      data: { slug: "live" },
    });
    expect(taken.error?.reason).toBe("SLUG_TAKEN");
  });

  it("refuses NUL and other control characters in titles, but not emoji", async () => {
    const apiKey = await seedAdminApiKey();
    const id = await newPost();
    const patch = (title: string) =>
      callAdminApi(apiKey, `/admin/posts/${id}`, {
        method: "PATCH",
        body: { data: { title } },
      });

    for (const title of ["a\u0000b", "a\u200Bb", "a\u202Eb", "a\tb"]) {
      expect((await patch(title)).status).toBe(400);
    }
    const emoji = await patch("👩\u200D💻 at work");
    expect(emoji.status).toBe(200);
    expect(((await emoji.json()) as { title: string }).title).toBe(
      "👩\u200D💻 at work",
    );

    const created = await callAdminApi(apiKey, "/admin/posts", {
      method: "POST",
      body: { data: { title: "a\u0000b" } },
    });
    expect(created.status).toBe(400);
  });

  it("refuses control characters in summaries but takes tabs, line breaks and emoji", async () => {
    const apiKey = await seedAdminApiKey();
    const id = await newPost();
    const patch = (summary: string | null) =>
      callAdminApi(apiKey, `/admin/posts/${id}`, {
        method: "PATCH",
        body: { data: { summary } },
      });

    for (const summary of [
      "a\u0000b",
      "a\u000Bb",
      "\u001B[31mred\u001B[0m",
      "a\u200Bb",
      "a\u202Eb",
    ]) {
      expect((await patch(summary)).status).toBe(400);
    }
    const allowed = "line one\r\n\tline two 👩\u200D💻";
    const accepted = await patch(allowed);
    expect(accepted.status).toBe(200);
    expect(((await accepted.json()) as { summary: string }).summary).toBe(
      allowed,
    );
    expect((await patch(null)).status).toBe(200);

    const created = await callAdminApi(apiKey, "/admin/posts", {
      method: "POST",
      body: { data: { title: "Summarised", summary: "a\u000Bb" } },
    });
    expect(created.status).toBe(400);
  });
});

describe("keys not computed yet", () => {
  it("are computed before a check, a duplicate one parked", async () => {
    const context = createAdminTestContext();
    // As migration 0029 leaves values it cannot compute: no key yet.
    const [older, newer] = await context.db
      .insert(TagsTable)
      .values([{ name: "Ｃａｆé" }, { name: "CAFÉ" }])
      .returning();

    const created = await TagService.createTag(context, { name: "café" });
    expect(created.error?.reason).toBe("TAG_NAME_ALREADY_EXISTS");

    const keys = await context.db
      .select({ id: TagsTable.id, nameKey: TagsTable.nameKey })
      .from(TagsTable)
      .where(eq(TagsTable.id, newer.id));
    expect(keys[0].nameKey).toBe(parkedKey(uniqueKeyOf("CAFÉ"), newer.id));
    const [kept] = await context.db
      .select({ nameKey: TagsTable.nameKey })
      .from(TagsTable)
      .where(eq(TagsTable.id, older.id));
    expect(kept.nameKey).toBe("café");

    // The parked Tag keeps its name and can be saved with it.
    expect(
      (
        await TagService.updateTag(context, {
          id: newer.id,
          data: { name: "CAFÉ" },
        })
      ).error,
    ).toBeNull();
    // But not renamed onto the name the other holds.
    expect(
      (
        await TagService.updateTag(context, {
          id: newer.id,
          data: { name: "Café" },
        })
      ).error?.reason,
    ).toBe("TAG_NAME_ALREADY_EXISTS");
  });

  it("a post with a parked slug keeps saving it", async () => {
    const context = createAdminTestContext();
    const [keeper, parked] = [await newPost(), await newPost()];
    await context.db
      .update(PostsTable)
      .set({ slug: "Ｄｕｐ", slugKey: null })
      .where(eq(PostsTable.id, keeper));
    await context.db
      .update(PostsTable)
      .set({ slug: "dup", slugKey: null })
      .where(eq(PostsTable.id, parked));

    const saved = await PostService.updatePost(context, {
      id: parked,
      data: { slug: "dup", title: "still dup" },
    });
    expect(saved.error).toBeNull();
    const [row] = await context.db
      .select({ slugKey: PostsTable.slugKey })
      .from(PostsTable)
      .where(eq(PostsTable.id, parked));
    expect(row.slugKey).toBe(parkedKey("dup", parked));

    const third = await newPost();
    const taken = await PostService.updatePost(context, {
      id: third,
      data: { slug: "DUP" },
    });
    expect(taken.error?.reason).toBe("SLUG_TAKEN");
    expect(
      (await CategoryService.createCategory(context, { name: "dup" })).error,
    ).toBeNull();
  });
});
