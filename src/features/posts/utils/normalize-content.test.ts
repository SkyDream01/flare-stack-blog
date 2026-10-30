import { describe, expect, it } from "vitest";
import { normalizePostContent, parseImageSize } from "./normalize-content";

describe("parseImageSize", () => {
  it("drops percent widths", () => {
    expect(parseImageSize("100%")).toBeUndefined();
  });

  it("keeps positive pixel sizes", () => {
    expect(parseImageSize(640)).toBe(640);
    expect(parseImageSize("320")).toBe(320);
  });
});

describe("normalizePostContent", () => {
  it("clamps heading levels and strips dead heading and image attrs", () => {
    const result = normalizePostContent({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1, id: "title", "data-toc-id": "toc-1" },
          content: [{ type: "text", text: "Title" }],
        },
        {
          type: "image",
          attrs: {
            src: "https://cdn.example.com/a.png",
            alt: "A",
            width: "100%",
            height: "400",
            caption: "nope",
            align: "center",
            uploadId: "tmp",
          },
        },
      ],
    });

    expect(result?.content?.[0]?.attrs).toEqual({ level: 2, id: "title" });
    expect(result?.content?.[1]?.attrs).toEqual({
      src: "https://cdn.example.com/a.png",
      alt: "A",
      width: null,
      height: 400,
    });
  });

  it("strips highlighted HTML from draft code blocks", () => {
    const result = normalizePostContent({
      type: "doc",
      content: [
        {
          type: "codeBlock",
          attrs: {
            language: "ts",
            highlightedHtml: "<pre>draft</pre>",
          },
          content: [{ type: "text", text: "const answer = 42;" }],
        },
      ],
    });

    expect(result?.content?.[0]?.attrs).toEqual({ language: "ts" });
  });
});
