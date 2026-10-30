import type { JSONContent } from "@tiptap/core";
import { getSchema } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { extensions as editorExtensions } from "@/features/posts/editor/config";
import { createSchemaExtensions } from "@/features/posts/editor/schema";
import { normalizePostContent } from "@/features/posts/utils/normalize-content";
import {
  inspectPostContent,
  LEGACY_NODE_ATTRIBUTES,
  POST_MARK_ATTRIBUTES,
  POST_MARK_TYPES,
  POST_NODE_ATTRIBUTES,
  POST_NODE_TYPES,
  publicPostContent,
  withEditorAttributes,
} from "./post-content-rules";

function attributesOf(
  types: Record<string, { spec: { attrs?: Record<string, unknown> } }>,
) {
  return Object.fromEntries(
    Object.entries(types).map(([name, type]) => [
      name,
      Object.keys(type.spec.attrs ?? {}).sort(),
    ]),
  );
}

function sorted(lists: Readonly<Record<string, ReadonlyArray<string>>>) {
  return Object.fromEntries(
    Object.entries(lists).map(([name, attrs]) => [name, [...attrs].sort()]),
  );
}

/**
 * A body carrying every attribute drafts on the live site hold, as the
 * editor saves them, with the values seen there.
 */
const EDITOR_BODY: JSONContent = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2, id: "intro", "data-toc-id": "toc-1" },
      content: [{ type: "text", text: "Intro" }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "a link",
          marks: [
            { type: "bold" },
            {
              type: "link",
              attrs: {
                href: "https://example.com",
                target: "_blank",
                rel: "noopener noreferrer nofollow",
                class: "notion-link-token",
                title: null,
              },
            },
          ],
        },
        { type: "hardBreak" },
        { type: "inlineMath", attrs: { latex: "x^2" } },
      ],
    },
    {
      type: "codeBlock",
      attrs: { language: "ts", highlightedHtml: "<pre>x</pre>" },
      content: [{ type: "text", text: "x" }],
    },
    {
      type: "image",
      attrs: {
        src: "/images/a.png",
        alt: "A",
        title: null,
        width: 640,
        height: 480,
        uploadId: null,
        align: "center",
        aspectRatio: 1.5,
        caption: "Old caption",
      },
    },
    {
      type: "orderedList",
      attrs: { start: 3, type: null },
      content: [
        {
          type: "listItem",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "i" }] },
          ],
        },
      ],
    },
    {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            {
              type: "tableHeader",
              attrs: {
                colspan: 2,
                rowspan: 1,
                colwidth: [100, 120],
                align: null,
              },
              content: [{ type: "paragraph" }],
            },
          ],
        },
        {
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              attrs: {
                colspan: 1,
                rowspan: 1,
                colwidth: null,
                align: "center",
              },
              content: [{ type: "paragraph" }],
            },
          ],
        },
      ],
    },
    {
      type: "video",
      attrs: {
        provider: "bilibili",
        videoId: "BV1fK4y1s7Qf",
        page: 2,
        start: 90,
        title: "A video",
        cover: "https://i0.hdslb.com/cover.jpg",
        duration: 321,
      },
    },
    { type: "blockMath", attrs: { latex: "y" } },
  ],
};

describe("Post content rules", () => {
  it("know exactly the node and mark types of the editor schema", () => {
    const schema = getSchema(createSchemaExtensions());
    expect([...POST_NODE_TYPES].sort()).toEqual(
      Object.keys(schema.nodes).sort(),
    );
    expect([...POST_MARK_TYPES].sort()).toEqual(
      Object.keys(schema.marks).sort(),
    );
  });

  it("know exactly the attributes the editor gives each type", () => {
    const schema = getSchema(createSchemaExtensions());
    expect(sorted(POST_NODE_ATTRIBUTES)).toEqual(attributesOf(schema.nodes));
    expect(sorted(POST_MARK_ATTRIBUTES)).toEqual(attributesOf(schema.marks));

    // The editor's own extensions add none. Its image placeholder is never
    // saved (`postContentOf`).
    const editor = getSchema(editorExtensions);
    const { imagePlaceholder: _placeholder, ...editorNodes } = attributesOf(
      editor.nodes,
    );
    expect(sorted(POST_NODE_ATTRIBUTES)).toEqual(editorNodes);
    expect(sorted(POST_MARK_ATTRIBUTES)).toEqual(attributesOf(editor.marks));
  });

  it("finds unknown node and mark types at any depth, each once", () => {
    const problems = inspectPostContent({
      type: "doc",
      content: [
        { type: "callout", content: [{ type: "paragraph" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "a", marks: [{ type: "highlight" }] },
            { type: "text", text: "b", marks: [{ type: "highlight" }] },
          ],
        },
        { type: "callout" },
        { content: [] },
      ],
    });
    expect(problems.nodeTypes).toEqual(["callout", "(missing type)"]);
    expect(problems.markTypes).toEqual(["highlight"]);
  });

  it("lists image sources, an absent one as empty", () => {
    const problems = inspectPostContent({
      type: "doc",
      content: [
        { type: "image", attrs: { src: "/images/a.png" } },
        { type: "image", attrs: {} },
      ],
    });
    expect(problems.imageSources).toEqual(["/images/a.png", ""]);
  });

  it("names attributes the editor does not give a node or mark, each once", () => {
    const problems = inspectPostContent({
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { style: "position:fixed" },
          content: [
            {
              type: "text",
              text: "a",
              marks: [
                {
                  type: "link",
                  attrs: { href: "https://example.com", onclick: "x()" },
                },
              ],
            },
            {
              type: "text",
              text: "b",
              marks: [{ type: "link", attrs: { onclick: "y()" } }],
            },
          ],
        },
        { type: "image", attrs: { src: "/images/a.png", onerror: "z()" } },
        { type: "heading", attrs: { level: 2, "data-toc-id": "t" } },
        { type: "callout", attrs: { tone: "warn" } },
      ],
    });
    expect(problems.attributes).toEqual([
      "paragraph.style",
      "link.onclick",
      "image.onerror",
    ]);
  });

  it("accept every attribute the editor and older editors stored", () => {
    expect(inspectPostContent(EDITOR_BODY)).toEqual({
      nodeTypes: [],
      markTypes: [],
      attributes: [],
      imageSources: ["/images/a.png"],
    });
  });

  it("drop the legacy attributes before a body is stored", () => {
    const stored = normalizePostContent(EDITOR_BODY);
    const kept: Array<string> = [];
    const visit = (node: JSONContent) => {
      for (const name of LEGACY_NODE_ATTRIBUTES[node.type ?? ""] ?? []) {
        if (node.attrs && name in node.attrs) kept.push(name);
      }
      node.content?.forEach(visit);
    };
    if (stored) visit(stored);
    expect(kept).toEqual([]);
  });

  it("keep only the editor's attributes for a restored revision", () => {
    const restored = withEditorAttributes({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2, id: "a", "data-toc-id": "t", onclick: "x()" },
          content: [{ type: "text", text: "A" }],
        },
        {
          type: "image",
          attrs: {
            src: "/images/a.png",
            alt: "A",
            caption: "c",
            align: "left",
          },
        },
      ],
    });
    expect(restored).toEqual({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2, id: "a" },
          content: [{ type: "text", text: "A" }],
        },
        { type: "image", attrs: { src: "/images/a.png", alt: "A" } },
      ],
    });
    expect(inspectPostContent(restored).attributes).toEqual([]);
  });

  it("leave a body with only the editor's attributes exactly as it was", () => {
    const body: JSONContent = {
      content: [
        {
          content: [
            {
              text: "a",
              type: "text",
              marks: [{ attrs: { title: null, href: "/a" }, type: "link" }],
            },
          ],
          type: "paragraph",
        },
      ],
      type: "doc",
    };
    const restored = withEditorAttributes(body);
    expect(JSON.stringify(restored)).toBe(JSON.stringify(body));
  });

  it("give out links without target, rel or class, and nothing unknown", () => {
    const shown = publicPostContent({
      type: "doc",
      content: [
        {
          type: "paragraph",
          onclick: "x()",
          content: [
            {
              type: "text",
              text: "a",
              marks: [
                {
                  type: "link",
                  attrs: {
                    href: "https://example.com",
                    target: "_self",
                    rel: "opener",
                    class: "fixed inset-0",
                    title: "T",
                    style: "color:red",
                  },
                },
              ],
            },
          ],
        },
        {
          type: "codeBlock",
          attrs: { language: "ts", highlightedHtml: "<pre>x</pre>" },
          content: [{ type: "text", text: "x" }],
        },
      ],
    });
    expect(shown).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "a",
              marks: [
                {
                  type: "link",
                  attrs: { href: "https://example.com", title: "T" },
                },
              ],
            },
          ],
        },
        {
          type: "codeBlock",
          attrs: { language: "ts", highlightedHtml: "<pre>x</pre>" },
          content: [{ type: "text", text: "x" }],
        },
      ],
    });
  });
});
