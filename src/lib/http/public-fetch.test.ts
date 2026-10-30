import { afterEach, describe, expect, it, vi } from "vitest";
import { checkPublicUrl, fetchPublicUrl } from "@/lib/http/public-fetch";

type DnsRecords = Record<string, { A?: Array<string>; AAAA?: Array<string> }>;

/**
 * A network with a DNS-over-HTTPS resolver answering `dns` and web servers
 * answering `pages`, keyed by URL. Records every request it is sent.
 */
function stubNetwork(
  dns: DnsRecords,
  pages: Record<string, () => Response> = {},
) {
  const fetchMock = vi.fn(async (input: URL) => {
    const url = new URL(input);
    if (url.hostname === "cloudflare-dns.com") {
      const name = url.searchParams.get("name") ?? "";
      const type = url.searchParams.get("type") as "A" | "AAAA";
      const records = dns[name];
      if (!records) return Response.json({ Status: 3 });
      return Response.json({
        Status: 0,
        Answer: [
          { name, type: 5, data: "alias.example.net." },
          ...(records[type] ?? []).map((data) => ({
            name,
            type: type === "A" ? 1 : 28,
            data,
          })),
        ],
      });
    }
    const page = pages[url.href];
    if (!page) throw new Error(`unexpected fetch of ${url.href}`);
    return page();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function fetchedPages(fetchMock: ReturnType<typeof stubNetwork>) {
  return fetchMock.mock.calls
    .map(([input]) => input.href)
    .filter((url) => !url.startsWith("https://cloudflare-dns.com/"));
}

const signal = () => AbortSignal.timeout(5_000);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("checkPublicUrl", () => {
  it("refuses a name that resolves to loopback, like localtest.me", async () => {
    stubNetwork({ "localtest.me": { A: ["127.0.0.1"], AAAA: ["::1"] } });
    expect(
      await checkPublicUrl(new URL("http://localtest.me:3000/x.png"), signal()),
    ).toMatchObject({ reason: "NOT_PUBLIC" });
  });

  it("refuses a name when any one of its answers is private", async () => {
    stubNetwork({
      "mixed.example": { A: ["93.184.216.34"], AAAA: ["fd00::1"] },
    });
    expect(
      await checkPublicUrl(new URL("https://mixed.example/"), signal()),
    ).toMatchObject({ reason: "NOT_PUBLIC" });
  });

  it("accepts a name whose answers are all public", async () => {
    stubNetwork({
      "images.example": {
        A: ["93.184.216.34"],
        AAAA: ["2606:2800:220:1::1"],
      },
    });
    expect(
      await checkPublicUrl(new URL("https://images.example/a.png"), signal()),
    ).toBeNull();
  });

  it("tells a name public DNS does not know from a failed lookup", async () => {
    stubNetwork({});
    expect(
      await checkPublicUrl(new URL("https://nowhere.example/"), signal()),
    ).toEqual({ reason: "NO_ADDRESS" });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 503 })),
    );
    expect(
      await checkPublicUrl(new URL("https://nowhere.example/"), signal()),
    ).toEqual({ reason: "UNREACHABLE" });
  });

  it("does not ask DNS about an IP literal", async () => {
    const fetchMock = stubNetwork({});
    expect(
      await checkPublicUrl(
        new URL("http://[::ffff:127.0.0.1]:3000/x.png"),
        signal(),
      ),
    ).toMatchObject({ reason: "NOT_PUBLIC" });
    expect(await checkPublicUrl(new URL("http://8.8.8.8/"), signal())).toBe(
      null,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses other schemes and credentials in the address", async () => {
    stubNetwork({});
    expect(
      await checkPublicUrl(new URL("file:///etc/passwd"), signal()),
    ).toMatchObject({ reason: "NOT_PUBLIC" });
    expect(
      await checkPublicUrl(new URL("http://user:pw@8.8.8.8/"), signal()),
    ).toMatchObject({ reason: "NOT_PUBLIC" });
  });
});

describe("fetchPublicUrl", () => {
  const publicDns: DnsRecords = {
    "images.example": { A: ["93.184.216.34"] },
    "cdn.example": { A: ["93.184.216.35"] },
    "rebind.example": { A: ["10.0.0.7"] },
  };

  it("follows a redirect to another public address", async () => {
    const fetchMock = stubNetwork(publicDns, {
      "https://images.example/a.png": () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://cdn.example/a.png" },
        }),
      "https://cdn.example/a.png": () => new Response("png"),
    });

    const result = await fetchPublicUrl(
      new URL("https://images.example/a.png"),
      {
        signal: signal(),
      },
    );

    expect(await result.data?.text()).toBe("png");
    expect(fetchedPages(fetchMock)).toEqual([
      "https://images.example/a.png",
      "https://cdn.example/a.png",
    ]);
  });

  it.each([
    "http://127.0.0.1/secret",
    "http://[::ffff:127.0.0.1]:3000/secret",
    "http://localhost:3000/secret",
    "http://rebind.example/secret",
  ])("refuses a redirect to %s without fetching it", async (location) => {
    const fetchMock = stubNetwork(publicDns, {
      "https://images.example/a.png": () =>
        new Response(null, { status: 301, headers: { location } }),
    });

    const result = await fetchPublicUrl(
      new URL("https://images.example/a.png"),
      {
        signal: signal(),
      },
    );

    expect(result.error).toMatchObject({ reason: "NOT_PUBLIC" });
    expect(fetchedPages(fetchMock)).toEqual(["https://images.example/a.png"]);
  });

  it("refuses a redirect to a name public DNS does not know, like an intranet host", async () => {
    const fetchMock = stubNetwork(publicDns, {
      "https://images.example/a.png": () =>
        new Response(null, {
          status: 302,
          headers: { location: "http://nas.corp.example/x.png" },
        }),
    });

    const result = await fetchPublicUrl(
      new URL("https://images.example/a.png"),
      { signal: signal() },
    );

    expect(result.error).toEqual({
      reason: "NOT_PUBLIC",
      url: "http://nas.corp.example/x.png",
    });
    expect(fetchedPages(fetchMock)).toEqual(["https://images.example/a.png"]);
  });

  it("cannot fetch a start address whose name does not resolve", async () => {
    const fetchMock = stubNetwork(publicDns);
    const result = await fetchPublicUrl(new URL("https://nowhere.example/"), {
      signal: signal(),
    });
    expect(result.error).toEqual({ reason: "UNREACHABLE" });
    expect(fetchedPages(fetchMock)).toEqual([]);
  });

  it("gives up after five redirects", async () => {
    stubNetwork(publicDns, {
      "https://images.example/loop": () =>
        new Response(null, {
          status: 307,
          headers: { location: "/loop" },
        }),
    });

    const result = await fetchPublicUrl(
      new URL("https://images.example/loop"),
      {
        signal: signal(),
      },
    );

    expect(result.error).toEqual({ reason: "UNREACHABLE" });
  });

  it("never fetches a private start address", async () => {
    const fetchMock = stubNetwork(publicDns);
    const result = await fetchPublicUrl(new URL("http://[::1]:3000/x.png"), {
      signal: signal(),
    });
    expect(result.error).toMatchObject({ reason: "NOT_PUBLIC" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
