import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { PostsFilterNotFound } from "./posts-filter-not-found";

vi.mock("@tanstack/react-router", async () => ({
  ...(await vi.importActual("@tanstack/react-router")),
  Link: ({ children, to }: { children: ReactNode; to: string }) =>
    createElement("a", { href: to }, children),
}));
vi.mock("@/paraglide/runtime", async () => ({
  ...(await vi.importActual("@/paraglide/runtime")),
  getLocale: () => "zh",
}));

it("names the Tag that does not exist and leads to all posts", () => {
  const html = renderToStaticMarkup(
    createElement(PostsFilterNotFound, {
      data: { kind: "tag", name: "不存在的标签" },
    }),
  );
  expect(html).toContain("标签「不存在的标签」不存在");
  expect(html).toContain("该标签不存在，或其下没有已发布的文章。");
  expect(html).toContain('<a href="/posts">');
  expect(html).toContain("404");
});

it("names the Category that does not exist", () => {
  const html = renderToStaticMarkup(
    createElement(PostsFilterNotFound, {
      data: { kind: "category", name: "无此分类" },
    }),
  );
  expect(html).toContain("分类「无此分类」不存在");
  expect(html).toContain("该分类不存在，或其下没有已发布的文章。");
});
