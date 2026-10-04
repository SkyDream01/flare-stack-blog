import { afterEach, describe, expect, it, vi } from "vitest";
import {
  prepareWorkerSecrets,
  readWorkerBindings,
} from "./prepare-worker-secrets";

const requiredSecrets = [
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "DOMAIN",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
].map((name) => ({ name, type: "secret_text" }));

describe("prepareWorkerSecrets", () => {
  it("carries existing text variables into secrets while keeping unreadable secrets", () => {
    const values = prepareWorkerSecrets(
      [
        ...requiredSecrets,
        {
          name: "UMAMI_SRC",
          type: "plain_text",
          text: "https://umami.example",
        },
        { name: "LOCALE", type: "plain_text", text: "en" },
        { name: "OLD_VARIABLE", type: "plain_text", text: " old value\n" },
        { name: "DB", type: "d1" },
      ],
      {},
    );

    expect(values).toEqual({
      UMAMI_SRC: "https://umami.example",
      LOCALE: "en",
      OLD_VARIABLE: " old value\n",
    });
  });

  it("lets configured Actions values override text bindings without clearing optional values", () => {
    expect(
      prepareWorkerSecrets(
        [
          ...requiredSecrets,
          { name: "DOMAIN", type: "plain_text", text: "old.example.com" },
          {
            name: "UMAMI_SRC",
            type: "plain_text",
            text: "https://umami.example",
          },
        ],
        {
          DOMAIN: "blog.example.com",
          UMAMI_SRC: "",
          CLOUDFLARE_API_TOKEN: "token",
        },
      ),
    ).toEqual({
      DOMAIN: "blog.example.com",
      UMAMI_SRC: "https://umami.example",
    });
  });

  it("stops deployment when a required runtime secret is absent", () => {
    expect(() =>
      prepareWorkerSecrets([], { DOMAIN: "blog.example.com" }),
    ).toThrow(
      /Missing required Worker secrets: BETTER_AUTH_SECRET, BETTER_AUTH_URL/,
    );
  });

  it("supports a new Worker when Actions supplies all required runtime values", () => {
    const env = Object.fromEntries(
      requiredSecrets.map(({ name }) => [name, "value"]),
    );
    expect(prepareWorkerSecrets([], env)).toEqual(env);
  });

  it("refuses a text binding without a value", () => {
    expect(() =>
      prepareWorkerSecrets(
        [...requiredSecrets, { name: "UMAMI_SRC", type: "plain_text" }],
        {},
      ),
    ).toThrow("Worker variable has no text: UMAMI_SRC");
  });
});

describe("readWorkerBindings", () => {
  const env = {
    CLOUDFLARE_ACCOUNT_ID: "account",
    WORKER_NAME: "blog",
    CLOUDFLARE_API_TOKEN: "token",
  };

  afterEach(() => vi.unstubAllGlobals());

  it("reads the current Worker's bindings without modifying the Worker", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ success: true, result: { bindings: requiredSecrets } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(readWorkerBindings(env)).resolves.toEqual(requiredSecrets);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/accounts/account/workers/scripts/blog/settings",
      {
        headers: { Authorization: "Bearer token" },
        signal: expect.any(AbortSignal),
      },
    );
  });

  it("accepts only the Worker-not-found response for a first deployment", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { success: false, errors: [{ code: 10007 }], result: null },
            { status: 404 },
          ),
        ),
    );
    await expect(readWorkerBindings(env)).resolves.toEqual([]);
  });

  it.each([403, 404, 500])(
    "stops deployment on an unreadable settings response (%s)",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            Response.json(
              { success: false, errors: [{ code: 10000 }], result: null },
              { status },
            ),
          ),
      );
      await expect(readWorkerBindings(env)).rejects.toThrow(
        `Unable to read Worker settings (HTTP ${status})`,
      );
    },
  );
});
