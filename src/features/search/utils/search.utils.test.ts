import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SearchHighlight } from "@/features/search/components/search-highlight";
import { buildSnippet } from "@/features/search/utils/search.utils";

function snippet(text: string | null, terms: Array<string>, q = terms[0]) {
  return buildSnippet({ text, terms, fallbackTerm: q ?? "" });
}

/** What the public search page shows for an excerpt, as its text content. */
function shown(html: string | null) {
  return renderToStaticMarkup(
    createElement(SearchHighlight, { html, fallback: "" }),
  );
}

describe("buildSnippet", () => {
  it("escapes a text whether or not a term matched", () => {
    const title = "<b>Tom & Jerry</b> \"quoted\" 'single'";
    expect(snippet(title, ["tom"])).toBe(
      "&lt;b&gt;<mark>Tom</mark> &amp; Jerry&lt;/b&gt; &quot;quoted&quot; &#039;single&#039;",
    );
    expect(snippet(title, ["zzzzzz"])).toBe(
      "&lt;b&gt;Tom &amp; Jerry&lt;/b&gt; &quot;quoted&quot; &#039;single&#039;",
    );
    expect(snippet(title, [], "")).toBe(
      "&lt;b&gt;Tom &amp; Jerry&lt;/b&gt; &quot;quoted&quot; &#039;single&#039;",
    );
  });

  it("never marks inside an entity it wrote", () => {
    expect(snippet("Tom & Jerry", ["amp"])).toBe("Tom &amp; Jerry");
    expect(snippet("a < b, lt c", ["lt"])).toBe("a &lt; b, <mark>lt</mark> c");
  });

  it("marks terms that are themselves special characters", () => {
    expect(snippet("R&D <notes>", ["r&d"])).toBe(
      "<mark>R&amp;D</mark> &lt;notes&gt;",
    );
  });

  it("is null for an empty text", () => {
    expect(snippet(null, ["x"])).toBeNull();
    expect(snippet("   ", ["x"])).toBeNull();
  });
});

describe("the public search page's excerpt", () => {
  it.each([
    ["Tom & Jerry", ["tom"], "<mark>Tom</mark> &amp; Jerry"],
    ["Tom & Jerry", ["zzzzzz"], "Tom &amp; Jerry"],
    ["Tom & Jerry", ["amp"], "Tom &amp; Jerry"],
    [
      "<script>x</script> hi",
      ["hi"],
      "&lt;script&gt;x&lt;/script&gt; <mark>hi</mark>",
    ],
    ["<script>x</script>", ["zzzzzz"], "&lt;script&gt;x&lt;/script&gt;"],
    ["a &lt; b", ["zzzzzz"], "a &amp;lt; b"],
    ["a &lt; b", ["a"], "<mark>a</mark> &amp;lt; b"],
  ])("shows %j searched for %j as written", (text, terms, html) => {
    // The page renders the same markup React would for the text itself, with
    // only the matched words in <mark>.
    expect(shown(snippet(text, terms))).toBe(html);
  });
});
