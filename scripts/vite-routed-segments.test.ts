import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { routedFirstSegments } from "./vite-routed-segments";

const tree = (...keys: string[]) =>
  `export interface FileRoutesByFullPath {\n${keys
    .map((key) => `  '${key}': typeof Route`)
    .join("\n")}\n}\n`;

describe("routedFirstSegments", () => {
  it("takes the first segment of each full path, lowercased, deduped and sorted", () => {
    expect(
      routedFirstSegments(
        tree("/", "/Posts", "/admin", "/admin/posts", "/admin/", "/api/auth/$"),
      ),
    ).toEqual(["admin", "api", "posts"]);
  });

  it("keeps dotted file routes whole and static segments under a splat", () => {
    expect(
      routedFirstSegments(tree("/rss.xml", "/images/$", "/post/$slug")),
    ).toEqual(["images", "post", "rss.xml"]);
  });

  it("skips the root catch-all", () => {
    expect(routedFirstSegments(tree("/$", "/search"))).toEqual(["search"]);
  });

  it("throws on a dynamic first segment", () => {
    expect(() => routedFirstSegments(tree("/$slug", "/search"))).toThrow(
      "Dynamic first segment /$slug",
    );
  });

  it("throws when the route tree has no FileRoutesByFullPath", () => {
    expect(() => routedFirstSegments("export const x = 1")).toThrow(
      "FileRoutesByFullPath not found",
    );
  });

  it("parses the generated route tree", () => {
    const source = readFileSync(
      path.join(__dirname, "../src/routeTree.gen.ts"),
      "utf8",
    );
    const segments = routedFirstSegments(source);
    expect(segments).toEqual(expect.arrayContaining(["admin", "posts", "api"]));
    expect(segments).not.toContain("$");
    expect(segments).not.toContain("");
  });
});
