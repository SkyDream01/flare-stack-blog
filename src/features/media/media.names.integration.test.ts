import { env } from "cloudflare:workers";
import { createMockExecutionCtx, seedAdminApiKey } from "tests/test-utils";
import { describe, expect, it } from "vitest";
import { createApiContext } from "@/lib/orpc/create-context";
import { openAPIHandler } from "@/lib/orpc/openapi-handler";

/**
 * A Media's file name follows the rules of a Tag name, and replacing a file
 * keeps its image type, through the real routes.
 */

const PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAABcAAAARCAIAAAC5EaDqAAAAHUlEQVR4nGOsCDjBQDFgotyIUVNGTRk1ZdQUrAAAlAUBsqIel+IAAAAASUVORK5CYII=",
  ),
  (char) => char.charCodeAt(0),
);
const GIF = Uint8Array.from(
  atob(
    "R0lGODdhDQAHAIEAAHhQyAAAAAAAAAAAACwAAAAADQAHAAAIEQABCBxIsKDBgwgTKlzIsGFAADs=",
  ),
  (char) => char.charCodeAt(0),
);

async function call(
  apiKey: string,
  method: string,
  path: string,
  body?: BodyInit | object,
) {
  const headers = new Headers({ "x-api-key": apiKey });
  let init: BodyInit | undefined;
  if (body instanceof FormData) {
    init = body;
  } else if (body !== undefined) {
    headers.set("Content-Type", "application/json");
    init = JSON.stringify(body);
  }
  const request = new Request(`http://localhost:3000/api${path}`, {
    method,
    headers,
    body: init,
  });
  const { response } = await openAPIHandler.handle(request, {
    prefix: "/api",
    context: createApiContext(request.headers, env, createMockExecutionCtx()),
  });
  if (!response) throw new Error(`No route matched ${method} ${path}`);
  const raw = await response.text();
  return {
    status: response.status,
    body: raw ? (JSON.parse(raw) as Record<string, unknown>) : null,
  };
}

function imageForm(bytes: Uint8Array<ArrayBuffer>, name: string, type: string) {
  const form = new FormData();
  form.set("image", new File([bytes], name, { type }));
  return form;
}

async function uploadPng(apiKey: string, name = "start.png") {
  const uploaded = await call(
    apiKey,
    "POST",
    "/admin/media",
    imageForm(PNG, name, "image/png"),
  );
  expect(uploaded.status).toBe(200);
  return uploaded.body as { key: string; fileName: string };
}

async function fileNameOf(apiKey: string, key: string) {
  const list = await call(apiKey, "GET", "/admin/media?limit=100");
  const item = (
    list.body as { items: Array<{ key: string; fileName: string }> }
  ).items.find((media) => media.key === key);
  return item?.fileName;
}

describe("PATCH /api/admin/media/{key}", () => {
  it.each([
    ["NUL", "a\u0000b.png"],
    ["a right-to-left override", "a‮b.png"],
    ["a zero width space", "a​b.png"],
    ["a tab", "a\tb.png"],
    ["a line break", "a\nb.png"],
    ["only whitespace", "    "],
    ["nothing", ""],
    ["5000 characters", "n".repeat(5000)],
    ["256 characters", "n".repeat(256)],
  ])("refuses a name of %s with 400, leaving the name", async (_case, name) => {
    const apiKey = await seedAdminApiKey();
    const media = await uploadPng(apiKey);

    const renamed = await call(apiKey, "PATCH", `/admin/media/${media.key}`, {
      name,
    });

    expect(renamed.status).toBe(400);
    expect(await fileNameOf(apiKey, media.key)).toBe("start.png");
  });

  it("takes a name by the rules of a Tag name, stored as written", async () => {
    const apiKey = await seedAdminApiKey();
    const media = await uploadPng(apiKey);
    const rename = (name: string) =>
      call(apiKey, "PATCH", `/admin/media/${media.key}`, { name });

    expect((await rename("  封面 ＡＢＣ  ")).status).toBe(200);
    expect(await fileNameOf(apiKey, media.key)).toBe("封面 ＡＢＣ");

    expect((await rename("👩‍💻 team.png")).status).toBe(200);
    expect(await fileNameOf(apiKey, media.key)).toBe("👩‍💻 team.png");

    const longest = "n".repeat(255);
    expect((await rename(longest)).status).toBe(200);
    expect(await fileNameOf(apiKey, media.key)).toBe(longest);
  });

  it("answers 404 for a name that is fine but a key that is not", async () => {
    const apiKey = await seedAdminApiKey();
    const renamed = await call(apiKey, "PATCH", "/admin/media/missing.png", {
      name: "fine.png",
    });
    expect(renamed.status).toBe(404);
  });
});

describe("POST /api/admin/media/{key}/replace", () => {
  it("replaces a file with one of the same type", async () => {
    const apiKey = await seedAdminApiKey();
    const media = await uploadPng(apiKey);

    const replaced = await call(
      apiKey,
      "POST",
      `/admin/media/${media.key}/replace`,
      imageForm(PNG, "again.png", "image/png"),
    );

    expect(replaced.status).toBe(200);
    expect(replaced.body).toMatchObject({
      key: media.key,
      mimeType: "image/png",
      fileName: "again.png",
    });
  });

  it("answers 400 TYPE_CHANGED for another type, and the file stays", async () => {
    const apiKey = await seedAdminApiKey();
    const media = await uploadPng(apiKey);

    const replaced = await call(
      apiKey,
      "POST",
      `/admin/media/${media.key}/replace`,
      imageForm(GIF, "loop.gif", "image/gif"),
    );

    expect(replaced.status).toBe(400);
    expect(replaced.body).toMatchObject({
      code: "MEDIA_INVALID",
      data: { detail: "TYPE_CHANGED" },
    });
    expect(await fileNameOf(apiKey, media.key)).toBe("start.png");
  });
});
