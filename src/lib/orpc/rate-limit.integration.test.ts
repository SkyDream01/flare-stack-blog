import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { createTestContext } from "tests/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  publicProcedure,
  rateLimitErrors,
  withRateLimit,
} from "@/lib/orpc/procedure";

function createClient(capacity: number) {
  const context = createTestContext();
  const handler = new OpenAPIHandler({
    limited: publicProcedure
      .errors(rateLimitErrors)
      .use(withRateLimit({ capacity, interval: "1h", key: "test:limited" }))
      .route({ method: "GET", path: "/limited" })
      .handler(() => ({ success: true })),
  });

  return async (options: { userId?: string; ip?: string }) => {
    const headers = new Headers();
    if (options.ip) headers.set("cf-connecting-ip", options.ip);
    const auth = {
      api: {
        getSession: async () =>
          options.userId ? { user: { id: options.userId } } : null,
      },
    };
    const result = await handler.handle(
      new Request("http://localhost:3000/limited", { headers }),
      { context: { ...context, getAuth: async () => auth, headers } as never },
    );
    if (!result.response) throw new Error("Route was not matched");
    return result.response.status;
  };
}

describe("withRateLimit", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keys signed-in requests by user, not by shared IP", async () => {
    const request = createClient(2);
    const ip = "198.51.100.10";

    expect(await request({ userId: "rl-user-a", ip })).toBe(200);
    expect(await request({ userId: "rl-user-a", ip })).toBe(200);
    expect(await request({ userId: "rl-user-a", ip })).toBe(429);
    // Another user behind the same IP keeps their own bucket.
    expect(await request({ userId: "rl-user-b", ip })).toBe(200);
  });

  it("keeps the user bucket when the user changes IP", async () => {
    const request = createClient(1);

    expect(await request({ userId: "rl-user-c", ip: "198.51.100.11" })).toBe(
      200,
    );
    expect(await request({ userId: "rl-user-c", ip: "198.51.100.12" })).toBe(
      429,
    );
  });

  it("caps many users behind one IP at 30 per minute", async () => {
    // Frozen clock: the bucket must not refill while the loop runs.
    vi.useFakeTimers();
    const request = createClient(5);
    const ip = "198.51.100.13";

    for (let i = 0; i < 30; i++) {
      expect(await request({ userId: `rl-crowd-${i}`, ip })).toBe(200);
    }
    expect(await request({ userId: "rl-crowd-30", ip })).toBe(429);
    // A different network is unaffected.
    expect(await request({ userId: "rl-crowd-31", ip: "198.51.100.14" })).toBe(
      200,
    );
  });

  it("keys anonymous requests by IP, sharing one IPv6 /64", async () => {
    const request = createClient(2);

    expect(await request({ ip: "2001:db8:aa:bb::1" })).toBe(200);
    expect(await request({ ip: "2001:db8:aa:bb:1:2:3:4" })).toBe(200);
    expect(await request({ ip: "2001:DB8:AA:BB::ffff" })).toBe(429);
    expect(await request({ ip: "2001:db8:aa:cc::1" })).toBe(200);
  });
});
