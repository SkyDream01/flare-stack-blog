import { env } from "cloudflare:workers";
import { createMockExecutionCtx, seedAdminApiKey } from "tests/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApiContext } from "@/lib/orpc/create-context";
import { openAPIHandler } from "@/lib/orpc/openapi-handler";

const send = vi.hoisted(() => vi.fn());
vi.mock("worker-mailer", () => ({ WorkerMailer: { send } }));

/**
 * Calls the operations whose responses the OpenAPI document types, through
 * the real routes. oRPC validates every output against its declared schema, so
 * a status of 200 here means the schema describes what the handler returns.
 */

let apiKey: string;
beforeEach(async () => {
  apiKey = await seedAdminApiKey();
});

async function call(
  method: string,
  path: string,
  body?: Record<string, unknown> | FormData,
) {
  const isForm = body instanceof FormData;
  const request = new Request(`http://localhost:3000/api${path}`, {
    method,
    headers: {
      "x-api-key": apiKey,
      ...(body && !isForm ? { "content-type": "application/json" } : {}),
    },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
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

type Schema = { anyOf?: unknown; type?: string; $ref?: string };
type Response200 = {
  content?: Record<string, { schema: Schema }>;
};

describe("OpenAPI document", () => {
  it("types the 200 response of the config, friend link and maintenance operations", async () => {
    const { response } = await openAPIHandler.handle(
      new Request("http://localhost/api/spec.json"),
      { prefix: "/api", context: {} as never },
    );
    const doc = (await response!.json()) as {
      paths: Record<
        string,
        Record<string, { responses: Record<string, Response200> }>
      >;
      components: { schemas: Record<string, Schema> };
    };
    // A schema several operations return is a component they reference.
    const resolve = (schema: Schema | undefined) =>
      schema?.$ref
        ? doc.components.schemas[schema.$ref.split("/").pop()!]
        : schema;
    const operations: Array<[string, string]> = [
      ["post", "/admin/config/assets"],
      ["post", "/admin/friend-links"],
      ["patch", "/admin/friend-links/{id}"],
      ["delete", "/admin/friend-links/{id}"],
      ["post", "/admin/friend-links/{id}/approve"],
      ["post", "/admin/friend-links/{id}/reject"],
      ["get", "/admin/email/test-status"],
      ["post", "/admin/email/test"],
      ["post", "/admin/search/rebuild"],
      ["post", "/admin/cache/invalidate"],
      ["get", "/admin/version"],
      ["post", "/admin/version/check"],
      ["post", "/admin/webhooks/test"],
      ["post", "/admin/webhooks/telegram/chats"],
    ];
    for (const [method, path] of operations) {
      const schema = resolve(
        doc.paths[path]?.[method]?.responses["200"]?.content?.[
          "application/json"
        ]?.schema,
      );
      expect(schema, `${method} ${path}`).toBeDefined();
      expect(schema?.anyOf, `${method} ${path}`).toBeUndefined();
      expect(schema?.type, `${method} ${path}`).toBe("object");
    }
  });
});

describe("friend links", () => {
  it("returns the friend link a write produced, and success for a delete", async () => {
    const created = await call("POST", "/admin/friend-links", {
      siteName: "Example",
      siteUrl: "https://example.com",
    });
    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({
      siteName: "Example",
      status: "approved",
    });
    const id = created.body!.id as number;

    const updated = await call("PATCH", `/admin/friend-links/${id}`, {
      description: "A site",
    });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ id, description: "A site" });

    const rejected = await call("POST", `/admin/friend-links/${id}/reject`, {
      rejectionReason: "No",
    });
    expect(rejected.status).toBe(200);
    expect(rejected.body).toMatchObject({ status: "rejected" });

    const approved = await call(
      "POST",
      `/admin/friend-links/${id}/approve`,
      {},
    );
    expect(approved.status).toBe(200);
    expect(approved.body).toMatchObject({ status: "approved" });

    const removed = await call("DELETE", `/admin/friend-links/${id}`);
    expect(removed.status).toBe(200);
    expect(removed.body).toEqual({ success: true });
  });
});

describe("config and maintenance", () => {
  it("returns the URL of an uploaded site asset", async () => {
    const form = new FormData();
    form.set(
      "file",
      new File(["<svg xmlns='http://www.w3.org/2000/svg'/>"], "logo.svg", {
        type: "image/svg+xml",
      }),
    );
    form.set("assetPath", "social/logo.svg");
    const { status, body } = await call("POST", "/admin/config/assets", form);
    expect(status).toBe(200);
    expect(body).toEqual({ url: expect.stringContaining("?v=") });
  });

  it("returns the email test status and the result of a test", async () => {
    const untested = await call("GET", "/admin/email/test-status");
    expect(untested.status).toBe(200);
    expect(untested.body).toEqual({
      state: "untested",
      testedAt: null,
      error: null,
    });

    send.mockResolvedValue(undefined);
    const sent = await call("POST", "/admin/email/test", {
      host: "smtp.example.com",
      port: 465,
      username: "user",
      password: { action: "replace", value: "secret" },
      senderAddress: "noreply@example.com",
    });
    expect(sent.status).toBe(200);
    expect(sent.body).toEqual({ success: true });
  });

  it("returns the size of a rebuilt search index", async () => {
    const { status, body } = await call("POST", "/admin/search/rebuild");
    expect(status).toBe(200);
    expect(body).toEqual({
      indexed: expect.any(Number),
      duration: expect.any(Number),
    });
  });

  it("confirms a cache invalidation", async () => {
    const { status, body } = await call("POST", "/admin/cache/invalidate");
    expect(status).toBe(200);
    expect(body).toEqual({ success: true });
  });

  it("returns the update check, cached or forced", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(null, {
          status: 302,
          headers: {
            location: "/du2333/flare-stack-blog/releases/tag/v99.0.0",
          },
        }),
    );
    for (const [method, path] of [
      ["GET", "/admin/version"],
      ["POST", "/admin/version/check"],
    ] as const) {
      const { status, body } = await call(method, path);
      expect(status, path).toBe(200);
      expect(body, path).toMatchObject({
        latestVersion: "v99.0.0",
        hasUpdate: true,
        releaseUrl: expect.stringContaining("v99.0.0"),
      });
    }
    vi.restoreAllMocks();
  });
});

describe("webhooks", () => {
  it("confirms a delivered test webhook", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("ok", { status: 200 }));
    const { status, body } = await call("POST", "/admin/webhooks/test", {
      provider: "generic",
      url: "https://hooks.example.com/in",
      secret: { action: "replace", value: "signing-key" },
    });
    expect(status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("lists the Telegram chats a bot heard from", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        ok: true,
        result: [
          { message: { chat: { id: 42, type: "private", first_name: "Ann" } } },
        ],
      }),
    );
    const { status, body } = await call(
      "POST",
      "/admin/webhooks/telegram/chats",
      { token: { action: "replace", value: "123:abc" } },
    );
    expect(status).toBe(200);
    expect(body).toEqual({
      chats: [{ id: "42", name: "Ann", type: "private" }],
    });
    vi.restoreAllMocks();
  });
});
