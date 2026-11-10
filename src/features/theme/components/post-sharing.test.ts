// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PostPageProps } from "../contract/pages";
import { PostPage as CuckooPostPage } from "../themes/cuckoo/pages/post/page";
import { PostPage as DefaultPostPage } from "../themes/default/pages/post/page";
import { PostPage as FuwariPostPage } from "../themes/fuwari/pages/post/page";
import { m } from "@/paraglide/messages";

const share = vi.hoisted(() => vi.fn());
vi.mock("@/lib/share", () => ({ shareLink: share }));
vi.mock("@/lib/auth/auth-client", () => ({
  useSession: () => ({ data: null }),
}));
vi.mock("@tanstack/react-router", () => ({
  ClientOnly: ({ children }: { children: ReactNode }) => children,
  Link: ({ children }: { children: ReactNode }) =>
    createElement("a", null, children),
  useNavigate: () => vi.fn(),
  useRouteContext: () => ({
    siteConfig: { theme: { cuckoo: { defaultCover: "" } } },
  }),
}));
vi.mock("@/features/posts/components/post-adjacent-nav", () => ({
  PostAdjacentNav: () => null,
}));
vi.mock("@/features/posts/components/compact-table-of-contents", () => ({
  CompactTableOfContents: () => null,
}));
vi.mock("@/features/posts/components/table-of-contents", () => ({
  default: () => null,
}));
vi.mock("../themes/default/pages/post/components/table-of-contents", () => ({
  default: () => null,
}));
vi.mock("@/features/posts/components/content/use-heading-anchors", () => ({
  useHeadingAnchors: () => {},
}));
vi.mock("./post-cover", () => ({ PostCover: () => null }));
vi.mock("../themes/default/components/comments/view/comment-section", () => ({
  CommentSection: () => null,
}));
vi.mock("../themes/fuwari/components/comments/view/comment-section", () => ({
  FuwariCommentSection: () => null,
}));
vi.mock("../themes/cuckoo/components/comments/view/comment-section", () => ({
  CuckooCommentSection: () => null,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe.each([
  ["default", DefaultPostPage],
  ["fuwari", FuwariPostPage],
  ["cuckoo", CuckooPostPage],
] as const)("%s Post sharing", (_theme, PostPage) => {
  it("shares the title and route's canonical address instead of the browser location", () => {
    const props: PostPageProps = {
      canonicalHref: "https://example.com/post/%E6%96%87%E7%AB%A0",
      post: {
        id: 1,
        title: "A published Post",
        slug: "文章",
        summary: null,
        contentJson: null,
        status: "published",
        publishedAt: new Date(),
        pinnedAt: null,
        updatedAt: new Date(),
        createdAt: new Date(),
        readTimeInMinutes: 1,
        toc: [],
        tags: [],
        category: null,
        cover: null,
      },
    };
    window.history.replaceState({}, "", "/post/elsewhere?comment=42#reply");
    render(createElement(PostPage, props));

    fireEvent.click(screen.getByRole("button", { name: m.common_share() }));

    expect(share).toHaveBeenCalledExactlyOnceWith({
      title: props.post.title,
      url: props.canonicalHref,
    });
  });
});
