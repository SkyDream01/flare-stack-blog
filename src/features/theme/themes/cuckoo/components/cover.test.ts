import { describe, expect, it } from "vitest";
import { blogConfig } from "@/blog.config";
import { coverBackgroundValue } from "./cover";

function background(source: string, slug = "first", cover?: string) {
  return coverBackgroundValue(
    {
      ...blogConfig,
      theme: {
        ...blogConfig.theme,
        cuckoo: { ...blogConfig.theme.cuckoo, defaultCover: source },
      },
    },
    slug,
    cover,
  );
}

describe("Cuckoo fallback covers", () => {
  it("gives each post a distinct, repeatable random-source request", () => {
    const source = "https://images.example/random";
    expect(background(source, "first")).not.toBe(background(source, "second"));
    expect(background(source, "first")).toBe(background(source, "first"));
    expect(background(source)).toBe(
      'url("https://images.example/random?_post=first")',
    );
  });

  it("preserves source parameters and fragments while encoding the post slug", () => {
    expect(
      background("https://images.example/random?size=large#image", "中文 &/?"),
    ).toBe(
      `url("https://images.example/random?size=large&_post=${encodeURIComponent("中文 &/?")}#image")`,
    );
  });

  it("keeps explicit slug templates in control of the source URL", () => {
    expect(background("https://images.example/{slug}?seed={slug}", "a/b")).toBe(
      'url("https://images.example/a%2Fb?seed=a%2Fb")',
    );
  });

  it("preserves post covers, local fallback images, and gradient fallbacks", () => {
    expect(
      background("https://images.example/random", "first", "/cover.webp"),
    ).toBe('url("/cover.webp")');
    expect(background("/fallback.svg")).toBe('url("/fallback.svg")');
    expect(background("")).toMatch(/^linear-gradient\(/);
  });
});
