// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PostsPage as SharedPostsPage } from "@/features/posts/components/posts-page";
import type { PostsPageProps } from "../contract/pages";
import { PostsPage as CuckooPostsPage } from "../themes/cuckoo/pages/posts/page";
import { PostsPage as DefaultPostsPage } from "../themes/default/pages/posts/page";
import { PostsPage as FuwariPostsPage } from "../themes/fuwari/pages/posts/page";
import { m } from "@/paraglide/messages";

vi.mock("@tanstack/react-router", () => ({
  useRouteContext: () => ({ siteConfig: { description: "Blog" } }),
}));
vi.mock("@/features/posts/components/archive/archive-panel", () => ({
  ArchivePanel: () => null,
}));
vi.mock("../themes/default/components/post-item", () => ({
  PostItem: () => null,
}));
vi.mock("../themes/cuckoo/components/post-card", () => ({
  PostCard: () => null,
}));
vi.mock("../themes/cuckoo/components/reveal", () => ({
  Reveal: () => null,
}));
vi.mock("../themes/fuwari/components/archive/archive-panel", () => ({
  ArchivePanel: () => null,
}));

beforeEach(() => {
  // A visible footer must never request another page by itself.
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(private callback: IntersectionObserverCallback) {}
      observe() {
        this.callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        );
      }
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe.each([
  ["shared", SharedPostsPage, () => m.posts_load_more()],
  ["default", DefaultPostsPage, () => m.posts_load_more()],
  ["cuckoo", CuckooPostsPage, () => m.posts_load_more_cuckoo()],
  ["retained Fuwari", FuwariPostsPage, () => m.posts_load_more()],
] as const)("%s Post pagination", (_name, Page, buttonName) => {
  function props(): PostsPageProps {
    return {
      posts: [],
      tags: [],
      onTagClick: vi.fn(),
      hasNextPage: true,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
    };
  }

  it("requests the next page only when clicked, and refuses repeat clicks while loading", () => {
    const data = props();
    const { getByRole, rerender } = render(createElement(Page, data));
    expect(data.fetchNextPage).not.toHaveBeenCalled();
    fireEvent.click(getByRole("button", { name: buttonName() }));
    expect(data.fetchNextPage).toHaveBeenCalledOnce();

    rerender(createElement(Page, { ...data, isFetchingNextPage: true }));
    const button = getByRole("button", {
      name: buttonName(),
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(data.fetchNextPage).toHaveBeenCalledOnce();
  });

  it("removes the load control when there are no more Posts", () => {
    const data = { ...props(), hasNextPage: false };
    const { queryByRole } = render(createElement(Page, data));
    expect(queryByRole("button", { name: buttonName() })).toBeNull();
    expect(data.fetchNextPage).not.toHaveBeenCalled();
  });
});
