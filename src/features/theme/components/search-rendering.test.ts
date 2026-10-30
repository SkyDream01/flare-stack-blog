import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SearchPage as DefaultSearch } from "../themes/default/pages/search/page";
import { SearchPage as FuwariSearch } from "../themes/fuwari/pages/search/page";
import { SearchPage as CuckooSearch } from "../themes/cuckoo/pages/search/page";

describe.each([
  ["default", DefaultSearch],
  ["fuwari", FuwariSearch],
  ["cuckoo", CuckooSearch],
] as const)("%s search rendering", (_theme, SearchPage) => {
  function render(matches: { title: string | null; summary: string | null }) {
    return renderToStaticMarkup(
      createElement(SearchPage, {
        query: "Tom",
        searchedQuery: "Tom",
        results: [
          {
            post: {
              id: "1",
              slug: "search-safety",
              title: '<img src=x onerror=alert(1)> & "title"',
              summary: "<script>alert(2)</script> & summary",
              tags: [],
            },
            score: 1,
            matches: { ...matches, contentSnippet: null },
          },
        ],
        isSearching: false,
        hasError: false,
        onQueryChange: vi.fn(),
        onSelectPost: vi.fn(),
        onBack: vi.fn(),
      }),
    );
  }

  it("shows unhighlighted titles and summaries as text", () => {
    const html = render({ title: null, summary: null });
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("&lt;script&gt;alert(2)&lt;/script&gt;");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
  });

  it("preserves match marks and decodes escaped text exactly once", () => {
    const html = render({
      title: "<mark>Tom</mark> &amp; Jerry &lt;notes&gt;",
      summary: "&lt;script&gt;<mark>Tom</mark>&lt;/script&gt; &amp;lt;",
    });
    expect(html).toContain("<mark>Tom</mark> &amp; Jerry &lt;notes&gt;");
    expect(html).toContain(
      "&lt;script&gt;<mark>Tom</mark>&lt;/script&gt; &amp;lt;",
    );
    expect(html).not.toContain("<script");
  });
});
