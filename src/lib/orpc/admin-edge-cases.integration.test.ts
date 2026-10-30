import { env } from "cloudflare:workers";
import { createMockExecutionCtx, seedAdminApiKey } from "tests/test-utils";
import { describe, expect, it } from "vitest";
import { createApiContext } from "@/lib/orpc/create-context";
import { handleApiRequest } from "@/lib/orpc/openapi-handler";

/**
 * Requests an external editor can send that the Admin API must answer with a
 * 4xx that says what to change, never with a 500: updates with nothing in
 * them, titles and search words in any script, dates the calendar lacks.
 */

async function callApi(
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
  return handleApiRequest(
    request,
    createApiContext(request.headers, env, createMockExecutionCtx()),
  );
}

type Written = { id: number; saveToken: string };

async function createPost(
  apiKey: string,
  data: { title: string; contentMarkdown?: string },
) {
  const response = await callApi(apiKey, "/admin/posts", {
    method: "POST",
    body: { data },
  });
  expect(response.status).toBe(200);
  return (await response.json()) as Written;
}

async function readPost(apiKey: string, id: number) {
  const response = await callApi(apiKey, `/admin/posts/${id}`);
  expect(response.status).toBe(200);
  return (await response.json()) as {
    id: number;
    title: string;
    slug: string;
    saveToken: string;
    publishedAt: string | null;
    hasUnpublishedChanges: boolean;
  };
}

function patchPost(
  apiKey: string,
  id: number,
  data: Record<string, unknown>,
  saveToken?: string,
) {
  return callApi(apiKey, `/admin/posts/${id}`, {
    method: "PATCH",
    body: { data, saveToken },
  });
}

async function messageOf(response: Response) {
  const body = (await response.json()) as {
    message: string;
    data?: { issues?: Array<{ message: string; path: Array<string> }> };
  };
  return JSON.stringify(body);
}

describe("updates with nothing to change", () => {
  it("answers 400 for an empty data on a post and writes nothing", async () => {
    const apiKey = await seedAdminApiKey();
    const { id, saveToken } = await createPost(apiKey, { title: "Steady" });

    const response = await patchPost(apiKey, id, {});

    expect(response.status).toBe(400);
    expect(await messageOf(response)).toContain("nothing to change");
    expect((await readPost(apiKey, id)).saveToken).toBe(saveToken);
  });

  it("answers 400 for an empty data on a tag", async () => {
    const apiKey = await seedAdminApiKey();
    const created = await callApi(apiKey, "/admin/tags", {
      method: "POST",
      body: { name: "edge-tag" },
    });
    const tag = (await created.json()) as { id: number };

    const response = await callApi(apiKey, `/admin/tags/${tag.id}`, {
      method: "PATCH",
      body: { data: {} },
    });

    expect(response.status).toBe(400);
    expect(await messageOf(response)).toContain("nothing to change");
  });

  it("answers 400 for an empty data on a category", async () => {
    const apiKey = await seedAdminApiKey();
    const created = await callApi(apiKey, "/admin/categories", {
      method: "POST",
      body: { name: "edge-category" },
    });
    const category = (await created.json()) as { id: number };

    const response = await callApi(apiKey, `/admin/categories/${category.id}`, {
      method: "PATCH",
      body: { data: {} },
    });

    expect(response.status).toBe(400);
    expect(await messageOf(response)).toContain("nothing to change");
  });
});

describe("slug generation", () => {
  const longTitle = "测试".repeat(100);

  it("makes a slug from a title of 200 Chinese characters", async () => {
    const apiKey = await seedAdminApiKey();

    const response = await callApi(
      apiKey,
      `/admin/posts/slug?title=${encodeURIComponent(longTitle)}`,
    );

    expect(response.status).toBe(200);
    const { slug } = (await response.json()) as { slug: string };
    expect(slug.length).toBeGreaterThan(0);
    expect(slug.length).toBeLessThanOrEqual(200);
    expect(longTitle.startsWith(slug)).toBe(true);
  });

  it("numbers the slug of a long title another post already uses", async () => {
    const apiKey = await seedAdminApiKey();
    const first = await createPost(apiKey, { title: longTitle });
    const second = await createPost(apiKey, { title: longTitle });

    const [a, b] = await Promise.all([
      readPost(apiKey, first.id),
      readPost(apiKey, second.id),
    ]);
    expect(a.slug).not.toBe(b.slug);
    expect(b.slug.length).toBeLessThanOrEqual(200);

    const response = await callApi(
      apiKey,
      `/admin/posts/slug?title=${encodeURIComponent(longTitle)}`,
    );
    expect(response.status).toBe(200);
    const { slug } = (await response.json()) as { slug: string };
    expect([a.slug, b.slug]).not.toContain(slug);
    expect(slug.length).toBeLessThanOrEqual(200);
  });
});

describe("publication dates", () => {
  it.each([
    ["a day the calendar lacks", "2026-02-30"],
    ["a month there is not", "2026-13-01"],
    ["year 1", "0001-01-01"],
    ["a year before 1970", "1969-06-01"],
    ["a year far ahead", "9999-12-31T00:00:00Z"],
    ["text that is not a date", "next tuesday"],
    ["an hour of 24", "2026-03-01T24:00:00Z"],
  ])("refuses %s", async (_label, publishedAt) => {
    const apiKey = await seedAdminApiKey();
    const { id, saveToken } = await createPost(apiKey, { title: "Dated" });

    const response = await patchPost(apiKey, id, { publishedAt });

    expect(response.status).toBe(400);
    expect((await readPost(apiKey, id)).saveToken).toBe(saveToken);
  });

  it.each([
    ["2026-02-30", "The calendar has no such day."],
    ["2026-03-01T24:00:00Z", "No such time of day"],
    ["2026-03-01T08:00:00+25:00", "No such UTC offset"],
  ])("says what in %s does not exist", async (publishedAt, message) => {
    const apiKey = await seedAdminApiKey();
    const { id } = await createPost(apiKey, { title: "Dated" });

    const response = await patchPost(apiKey, id, { publishedAt });

    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      data: { issues: Array<{ path: Array<string>; message: string }> };
    };
    expect(body.data.issues).toEqual([
      expect.objectContaining({
        path: ["data", "publishedAt"],
        message: expect.stringContaining(message),
      }),
    ]);
  });

  it("reads a time with no offset as UTC and a stated offset as stated", async () => {
    const apiKey = await seedAdminApiKey();
    const { id } = await createPost(apiKey, { title: "Dated" });

    await patchPost(apiKey, id, { publishedAt: "2026-02-01T08:30:00" });
    expect((await readPost(apiKey, id)).publishedAt).toBe(
      "2026-02-01T08:30:00.000Z",
    );

    await patchPost(apiKey, id, { publishedAt: "2026-02-01T08:30:00+08:00" });
    expect((await readPost(apiKey, id)).publishedAt).toBe(
      "2026-02-01T00:30:00.000Z",
    );

    await patchPost(apiKey, id, { publishedAt: "2026-02-01" });
    expect((await readPost(apiKey, id)).publishedAt).toBe(
      "2026-02-01T00:00:00.000Z",
    );
  });

  it("still takes null, which lets the next publish choose", async () => {
    const apiKey = await seedAdminApiKey();
    const { id } = await createPost(apiKey, { title: "Dated" });
    await patchPost(apiKey, id, { publishedAt: "2026-02-01" });

    const response = await patchPost(apiKey, id, { publishedAt: null });

    expect(response.status).toBe(200);
    expect((await readPost(apiKey, id)).publishedAt).toBeNull();
  });

  it("states in the field description how a time with no offset is read", async () => {
    const response = await callApi(await seedAdminApiKey(), "/spec.json");
    const spec = JSON.stringify(await response.json());

    expect(spec).toContain("A time with no Z or offset is read as UTC");
  });
});
