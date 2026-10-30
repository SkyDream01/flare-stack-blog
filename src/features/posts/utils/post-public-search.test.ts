import { describe, expect, it } from "vitest";
import {
  findMissingPublicFilter,
  isMissingPublicFilter,
  resolvePublicName,
  withCategoryFilter,
  withTagFilter,
  withUncategorizedFilter,
} from "./post-public-search";

describe("posts public search", () => {
  it("opens a Tag as the only filter", () => {
    expect(withTagFilter("Workers")).toEqual({ tagName: "Workers" });
  });

  it("opens a Category as the only filter", () => {
    expect(withCategoryFilter("生活")).toEqual({ categoryName: "生活" });
  });

  it("opens uncategorized as its own view", () => {
    expect(withUncategorizedFilter()).toEqual({ uncategorized: true });
  });

  it("addresses a Tag or Category by its name in any case", () => {
    const names = ["Workers", "生活", "workers-kv"];
    expect(resolvePublicName(names, "Workers")).toBe("Workers");
    expect(resolvePublicName(names, "workers")).toBe("Workers");
    expect(resolvePublicName(names, "WORKERS-KV")).toBe("workers-kv");
    expect(resolvePublicName(names, "生活")).toBe("生活");
  });

  it("prefers the exact spelling when two names differ only in case", () => {
    expect(resolvePublicName(["Go", "GO"], "GO")).toBe("GO");
    expect(resolvePublicName(["Go", "GO"], "go")).toBe("Go");
  });

  it("finds no page for an unknown name and no filter for no name", () => {
    expect(resolvePublicName(["Workers"], "Pages")).toBeNull();
    expect(resolvePublicName([], "Workers")).toBeNull();
    expect(resolvePublicName(["Workers"], undefined)).toBeUndefined();
  });
});

describe("missing public filter", () => {
  it("names the Tag or Category that does not exist", () => {
    expect(
      findMissingPublicFilter(
        { tagName: null, categoryName: undefined },
        { tagName: "nope" },
      ),
    ).toEqual({ kind: "tag", name: "nope" });
    expect(
      findMissingPublicFilter(
        { tagName: "Workers", categoryName: null },
        { tagName: "workers", categoryName: "无此分类" },
      ),
    ).toEqual({ kind: "category", name: "无此分类" });
  });

  it("names the Tag first when neither exists", () => {
    expect(
      findMissingPublicFilter(
        { tagName: null, categoryName: null },
        { tagName: "a", categoryName: "b" },
      ),
    ).toEqual({ kind: "tag", name: "a" });
  });

  it("finds nothing missing when every requested name exists or none is requested", () => {
    expect(
      findMissingPublicFilter(
        { tagName: "Workers", categoryName: undefined },
        { tagName: "workers" },
      ),
    ).toBeNull();
    expect(
      findMissingPublicFilter(
        { tagName: undefined, categoryName: undefined },
        {},
      ),
    ).toBeNull();
  });

  it("recognizes the data a not-found carries", () => {
    expect(isMissingPublicFilter({ kind: "tag", name: "x" })).toBe(true);
    expect(isMissingPublicFilter({ kind: "page", name: "x" })).toBe(false);
    expect(isMissingPublicFilter(undefined)).toBe(false);
  });
});
