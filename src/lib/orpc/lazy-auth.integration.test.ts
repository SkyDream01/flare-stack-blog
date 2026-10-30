import { env, exports } from "cloudflare:workers";
import { createMockExecutionCtx, seedAdminApiKey } from "tests/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";

// getAuth reads this config once per instance it builds, so its calls count
// the Better Auth instances.
vi.mock("@/lib/auth/auth.config", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/auth/auth.config")>();
  return { createAuthConfig: vi.fn(actual.createAuthConfig) };
});

// Stands in for the request TanStack Start is rendering.
const ssr = vi.hoisted(() => ({
  context: undefined as
    | { env: Env; executionCtx: ExecutionContext<unknown> }
    | undefined,
  headers: new Headers(),
}));

vi.mock("@tanstack/react-start", () => ({
  getGlobalStartContext: () => ssr.context,
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeaders: () => ssr.headers,
}));

// The setup file loaded the auth modules before these mocks existed; load
// them again so they see the mocks.
vi.resetModules();
const { createAuthConfig } = await import("@/lib/auth/auth.config");
const { getAuth } = await import("@/lib/auth/auth.server");
const { getRequestSession } = await import("@/lib/auth/get-request-session");
const { createApiContext } = await import("@/lib/orpc/create-context");
const { openAPIHandler } = await import("@/lib/orpc/openapi-handler");
const { createServerORPCClient } = await import("@/lib/orpc/server-client");
const { default: startHandler } =
  await import("@tanstack/react-start/server-entry");

const instancesBuilt = () => vi.mocked(createAuthConfig).mock.calls.length;

/** Signs a User in with a Sign-in Code and returns their Cookie header. */
async function signInCookie(email: string) {
  const queueSend = vi.spyOn(env.QUEUE, "send").mockResolvedValue({
    metadata: { metrics: { backlogBytes: 0, backlogCount: 0 } },
  });
  const auth = getAuth({ db: getDb(env), env });
  await auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } });
  const message = queueSend.mock.calls.at(-1)?.[0] as {
    data: { html: string };
  };
  const otp = /letter-spacing:8px[^>]*>(\d{6})</.exec(message.data.html)?.[1];
  if (!otp) throw new Error("No Sign-in Code in the queued email");

  const { headers } = await auth.api.signInEmailOTP({
    body: { email, otp },
    returnHeaders: true,
  });
  return headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

async function callApi(path: string, headers = new Headers()) {
  const request = new Request(`http://localhost:3000/api${path}`, { headers });
  const { response } = await openAPIHandler.handle(request, {
    prefix: "/api",
    context: createApiContext(request.headers, env, createMockExecutionCtx()),
  });
  if (!response) throw new Error(`No route matched ${path}`);
  return response;
}

beforeEach(() => {
  vi.mocked(createAuthConfig).mockClear();
});

describe("Better Auth on /api", () => {
  it("builds no instance for a public procedure", async () => {
    const response = await callApi("/site/domain");

    expect(response.status).toBe(200);
    expect(instancesBuilt()).toBe(0);
  });

  it("builds one instance and reads a cookie session", async () => {
    const cookie = await signInCookie("lazy-cookie@example.com");
    vi.mocked(createAuthConfig).mockClear();

    const signedIn = await callApi(
      "/me/notifications/reply",
      new Headers({ cookie }),
    );
    expect(signedIn.status).toBe(200);
    expect(instancesBuilt()).toBe(1);

    expect((await callApi("/me/notifications/reply")).status).toBe(401);
  });

  it("builds one instance and reads an API key session", async () => {
    const key = await seedAdminApiKey("lazy-auth");
    vi.mocked(createAuthConfig).mockClear();

    const response = await callApi(
      "/admin/categories/options",
      new Headers({ "x-api-key": key }),
    );

    expect(response.status).toBe(200);
    expect(instancesBuilt()).toBe(1);
  });
});

describe("Better Auth during SSR", () => {
  it("builds no instance while a page calls only public procedures", async () => {
    ssr.context = { env, executionCtx: createMockExecutionCtx() };
    ssr.headers = new Headers();
    const client = createServerORPCClient();

    await client.config.siteConfig();
    await client.config.siteDomain();
    await client.posts.pinned();

    expect(instancesBuilt()).toBe(0);
  });

  it("shares one instance across a request's procedure calls and session query", async () => {
    const cookie = await signInCookie("lazy-ssr@example.com");
    vi.mocked(createAuthConfig).mockClear();
    ssr.context = { env, executionCtx: createMockExecutionCtx() };
    ssr.headers = new Headers({ cookie });
    const client = createServerORPCClient();

    const session = await getRequestSession();
    await client.email.replyStatus();
    await client.email.availability();
    await client.config.siteConfig();

    expect(session?.user.email).toBe("lazy-ssr@example.com");
    expect(instancesBuilt()).toBe(1);

    // The next request gets its own instance.
    ssr.context = { env, executionCtx: createMockExecutionCtx() };
    await client.email.replyStatus();
    expect(instancesBuilt()).toBe(2);
  });
});

// getRequestAuth keys instances by this ExecutionContext, so it must not be
// shared by the isolate's requests.
it("gives each Worker request its own ExecutionContext", async () => {
  const fetch = vi.spyOn(startHandler, "fetch");

  await exports.default.fetch("http://localhost:3000/");
  await exports.default.fetch("http://localhost:3000/");

  const [first, second] = fetch.mock.calls.map(
    ([, options]) => options?.context?.executionCtx,
  );
  expect(first).toBeDefined();
  expect(second).toBeDefined();
  expect(first).not.toBe(second);
});
