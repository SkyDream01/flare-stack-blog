import { ROUTED_FIRST_SEGMENTS } from "virtual:routed-first-segments";
import { describe, expect, it } from "vitest";
import {
  FRAMEWORK_FIRST_SEGMENTS,
  isRoutedPath,
  probeNotFoundResponse,
} from "./probe-404";

describe("ROUTED_FIRST_SEGMENTS", () => {
  it("is generated from the route tree by the Vite plugin", () => {
    expect(ROUTED_FIRST_SEGMENTS).toEqual(
      expect.arrayContaining(["admin", "posts", "post", "rss.xml"]),
    );
  });

  it("is lowercase", () => {
    for (const segment of [
      ...ROUTED_FIRST_SEGMENTS,
      ...FRAMEWORK_FIRST_SEGMENTS,
    ]) {
      expect(segment).toBe(segment.toLowerCase());
    }
  });
});

describe("isRoutedPath", () => {
  it.each([
    "/",
    "//",
    "/posts",
    "/posts/",
    "/search",
    "/friend-links",
    "/unsubscribe",
    "/post/hello",
    "/post/v3.7.0",
    "/post/does-not-exist",
    "/images/2026/a.png",
    "/api/auth/get-session",
    "/api/send",
    "/api/rpc/posts",
    "/admin",
    "/admin/",
    "/admin/posts/edit/abc/history",
    "/rss.xml",
    "/atom.xml",
    "/feed.json",
    "/sitemap.xml",
    "/robots.txt",
    "/site.webmanifest",
    "/stats.js",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-link",
    "/verify-email",
    "/profile",
    "/submit-friend-link",
    "/_serverFn/abc",
  ])("routes %s", (pathname) => {
    expect(isRoutedPath(pathname)).toBe(true);
  });

  it("ignores the query string and keeps the index with ?page=2", () => {
    const { pathname } = new URL("https://example.com/?page=2");
    expect(isRoutedPath(pathname)).toBe(true);
  });

  it("matches case-insensitively and after percent-decoding, like the router", () => {
    expect(isRoutedPath("/Posts")).toBe(true);
    expect(isRoutedPath("/%6Cogin")).toBe(true);
    expect(isRoutedPath("/post%2Fx")).toBe(false);
  });

  it("skips leading slashes so a doubled slash on a real route keeps its redirect", () => {
    expect(isRoutedPath("//posts")).toBe(true);
    expect(isRoutedPath("///post/x")).toBe(true);
  });

  it.each([
    "/.env",
    "/.env.local",
    "/.git/config",
    "/.well-known/security.txt",
    "//.env",
    "//cms/wp-includes/wlwmanifest.xml",
    "/wp-admin/",
    "/https:/github.com/x",
    "/assets/missing.js.map",
    "/assets/assets/index.js",
    "/@fs/.env",
    "/__vite_rsc_findSourceMapURL",
    "/auth/login",
    "/staff",
    "/tos",
    "/userfiles",
    "/.s3cfg",
    "/localhost.key",
    "/%2e%2e/etc/passwd",
    "/%2e/.env",
    "/%E0%A4%A",
    "/loginx",
    "/zh/posts",
  ])("rejects %s", (pathname) => {
    expect(isRoutedPath(pathname)).toBe(false);
  });

  it("rejects dot-segment tricks after URL parsing", () => {
    for (const url of [
      "https://example.com/%2e%2e/etc/passwd",
      "https://example.com/posts/../.env",
      "https://example.com/./.env",
    ]) {
      const { pathname } = new URL(url);
      expect(isRoutedPath(pathname)).toBe(false);
    }
  });
});

describe("probeNotFoundResponse", () => {
  it("answers GET with a small private HTML 404 linking home", async () => {
    const response = probeNotFoundResponse(
      new Request("https://example.com/.env"),
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe(
      "text/html; charset=utf-8",
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("cdn-cache-control")).toBe("private, no-store");
    const body = await response.text();
    expect(body).toContain('href="/"');
    expect(body).not.toMatch(/<script|<link/);
  });

  it("answers HEAD with the status but no body", async () => {
    const response = probeNotFoundResponse(
      new Request("https://example.com/.env", { method: "HEAD" }),
    );
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
  });

  it("answers other methods like GET", async () => {
    const response = probeNotFoundResponse(
      new Request("https://example.com/staff", { method: "POST", body: "x" }),
    );
    expect(response.status).toBe(404);
    expect(await response.text()).toContain("404");
  });
});
