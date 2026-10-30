// @vitest-environment jsdom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { buildArticleJsonLd } from "@/lib/seo";

const HOSTILE_TITLE = "AUDIT2 T </script><script>window.X=1</script>";
const HOSTILE_SUMMARY =
  "<img src=x onerror=alert(1)> <!-- <script> & \u2028\u2029 </SCRIPT >";
const HOSTILE_TAG = "</script ><script>alert('tag')</script>";

const post = {
  slug: "audit",
  title: HOSTILE_TITLE,
  summary: HOSTILE_SUMMARY,
  publishedAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-02T00:00:00.000Z",
  tags: [{ name: HOSTILE_TAG }, { name: "Tom & Jerry" }],
  cover: null,
  contentJson: null,
};

type HeadScript = { type?: string; children?: string };

let headOf: (loaderData: unknown) => { scripts?: Array<HeadScript> };

beforeAll(async () => {
  const { Route } = await import("@/routes/_public/post/$slug");
  const head = Route.options.head as unknown as (context: {
    loaderData: unknown;
  }) => { scripts?: Array<HeadScript> };
  headOf = (loaderData) => head({ loaderData });
}, 60_000);

/**
 * The post page's head scripts as the server writes them into the page:
 * TanStack Router renders a script's `children` as its inner HTML.
 */
function renderHeadScripts() {
  const { scripts = [] } = headOf({
    post,
    authorName: "Author </script>",
    canonicalHref: "https://blog.example/post/audit",
  });
  return renderToStaticMarkup(
    scripts.map((script, index) =>
      createElement("script", {
        key: index,
        type: script.type,
        dangerouslySetInnerHTML: { __html: script.children ?? "" },
      }),
    ),
  );
}

describe("post page JSON-LD", () => {
  it("cannot close its script element or open a comment", () => {
    const html = renderHeadScripts();
    const body = html.slice(html.indexOf(">") + 1, html.lastIndexOf("</"));

    expect(html.match(/<script/gi)).toHaveLength(1);
    expect(html.match(/<\/script/gi)).toHaveLength(1);
    expect(body).not.toMatch(/[<>&\u2028\u2029]/);
  });

  it("parses back to the post as written", () => {
    const document = new DOMParser().parseFromString(
      `<!doctype html><html><head>${renderHeadScripts()}</head></html>`,
      "text/html",
    );
    const scripts = document.querySelectorAll("script");
    expect(scripts).toHaveLength(1);
    expect(scripts[0].getAttribute("type")).toBe("application/ld+json");

    const jsonLd = JSON.parse(scripts[0].textContent ?? "");
    expect(jsonLd).toMatchObject({
      headline: HOSTILE_TITLE,
      description: HOSTILE_SUMMARY,
      keywords: [HOSTILE_TAG, "Tom & Jerry"],
      author: { name: "Author </script>" },
    });
  });

  it("escapes the same way when built directly", () => {
    const json = buildArticleJsonLd({
      authorName: "A",
      canonicalHref: "https://blog.example/post/audit",
      post,
    });
    expect(json).not.toMatch(/[<>&\u2028\u2029]/);
    expect(json).toContain("\\u003c/script\\u003e");
    expect(JSON.parse(json).headline).toBe(HOSTILE_TITLE);
  });
});
