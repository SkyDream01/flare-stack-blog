// @vitest-environment jsdom
import type { JSONContent } from "@tiptap/react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderReact as renderDefault } from "../themes/default/components/content/render";
import { renderReact as renderFuwari } from "../themes/fuwari/components/content/render";
import { renderReact as renderCuckoo } from "../themes/cuckoo/components/content/render";

const mermaid = vi.hoisted(() => ({ initialize: vi.fn(), render: vi.fn() }));
vi.mock("mermaid", () => ({ default: mermaid }));
vi.mock("@/components/common/theme-provider", () => ({
  useTheme: () => ({ appTheme: "light" }),
}));

const themes = [
  ["default", renderDefault],
  ["fuwari", renderFuwari],
  ["cuckoo", renderCuckoo],
] as const;

beforeEach(() => {
  mermaid.render.mockReset();
  mermaid.render.mockResolvedValue({
    svg: '<svg data-testid="diagram"></svg>',
  });
});
afterEach(cleanup);

describe.each(themes)("%s Post rendering", (_theme, renderPost) => {
  it("shows proportional columns and alignment through the theme renderer", () => {
    const cell = (text: string, width: number, align: string): JSONContent => ({
      type: "tableHeader",
      attrs: { colwidth: [width], colspan: 1, rowspan: 1, align },
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    });
    const html = renderToStaticMarkup(
      renderPost({
        type: "doc",
        content: [
          {
            type: "table",
            content: [
              {
                type: "tableRow",
                content: [cell("A", 100, "center"), cell("B", 300, "right")],
              },
            ],
          },
        ],
      }),
    );

    expect(html).toContain('class="fuwari-table-scroll"');
    expect(html).toContain("table-layout:fixed");
    expect(html).toContain('<col style="width:25%"');
    expect(html).toContain('<col style="width:75%"');
    expect(html).toContain("text-align:center");
    expect(html).toContain("text-align:right");
    expect(html).toContain("<thead>");
  });

  it("keeps heading anchors and rendered math", () => {
    const heading: JSONContent = {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Hello" }],
    };
    const html = renderToStaticMarkup(
      renderPost({
        type: "doc",
        content: [
          heading,
          structuredClone(heading),
          {
            type: "paragraph",
            content: [{ type: "inlineMath", attrs: { latex: "x^2" } }],
          },
        ],
      }),
    );

    const ids = [...html.matchAll(/<h2 id="([^"]+)"/g)].map(
      (match) => match[1],
    );
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(html).toContain("katex");
  });

  it("escapes source without snapshot HTML and labels new code languages", async () => {
    const source = "<img src=x onerror=alert(1)>";
    const { container } = render(
      renderPost({
        type: "doc",
        content: [
          {
            type: "codeBlock",
            attrs: { language: "ps1" },
            content: [{ type: "text", text: source }],
          },
        ],
      }),
    );
    await act(() => vi.dynamicImportSettled());

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("code")?.textContent).toBe(source);
    expect(screen.getByText("PowerShell")).toBeDefined();
    expect(mermaid.render).not.toHaveBeenCalled();
  });

  it("renders Mermaid within the theme's code frame and keeps the copy control", async () => {
    const source = "flowchart LR\n A --> B";
    render(
      renderPost({
        type: "doc",
        content: [
          {
            type: "codeBlock",
            attrs: { language: "Mermaid" },
            content: [{ type: "text", text: source }],
          },
        ],
      }),
    );

    expect(await screen.findByTestId("diagram")).toBeDefined();
    expect(screen.getByRole("button")).toBeDefined();
    expect(mermaid.render).toHaveBeenCalledWith(
      expect.any(String),
      source,
      expect.any(HTMLElement),
    );
  });
});
