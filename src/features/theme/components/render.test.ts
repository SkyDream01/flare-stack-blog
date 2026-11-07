import type { JSONContent } from "@tiptap/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { directVideoAttrs } from "@/features/posts/utils/video-source";
import { renderReact as renderCuckoo } from "../themes/cuckoo/components/content/render";
import { renderReact as renderDefault } from "../themes/default/components/content/render";
import { renderReact as renderFuwari } from "../themes/fuwari/components/content/render";

describe.each([
  ["default", renderDefault],
  ["fuwari", renderFuwari],
  ["cuckoo", renderCuckoo],
] as const)("%s theme Direct Videos", (_theme, render) => {
  function post(src = "https://cdn.example.com/clip.mp4"): JSONContent {
    return {
      type: "doc",
      content: [
        {
          type: "video",
          attrs: directVideoAttrs({
            src,
            pageUrl: "https://example.com/watch/1",
            title: "A clip",
            cover: "https://cdn.example.com/poster.jpg",
            duration: 95,
          }),
        },
      ],
    };
  }

  it("renders the shared poster and source link before loading the video", () => {
    const html = renderToStaticMarkup(render(post()));
    expect(html).toContain("<button");
    expect(html).toContain('src="https://cdn.example.com/poster.jpg"');
    expect(html).toContain("A clip");
    expect(html).toContain("1:35");
    expect(html).toContain('href="https://example.com/watch/1"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain("clip.mp4");
    expect(html).not.toContain("<video");
    expect(html).not.toContain("<iframe");
  });

  it.each(["http://cdn.example.com/clip.mp4", "javascript:alert(1)"])(
    "omits a Direct Video at a refused address: %s",
    (src) => {
      expect(renderToStaticMarkup(render(post(src)))).toBe("");
    },
  );
});
