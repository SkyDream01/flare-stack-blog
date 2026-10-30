// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { m } from "@/paraglide/messages";
import type { AdminPostListItem } from "../types";
import { PostRow } from "./post-row";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children }: { children: ReactNode }) =>
    createElement("a", null, children),
  ClientOnly: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/hooks/use-motion", () => ({
  MOTION: { popover: 120 },
  useMotionPresence: (open: boolean) => open,
}));

afterEach(cleanup);

const POST: AdminPostListItem = {
  id: 1,
  title: "Post",
  summary: null,
  slug: "post",
  publicSlug: null,
  status: "draft",
  hasUnpublishedChanges: false,
  publishedAt: null,
  pinnedAt: null,
  createdAt: new Date("2026-10-01"),
  updatedAt: new Date("2026-10-02"),
} as AdminPostListItem;

function renderRow(post: Partial<AdminPostListItem>) {
  render(
    createElement(
      "table",
      null,
      createElement(
        "tbody",
        null,
        createElement(PostRow, {
          post: { ...POST, ...post },
          sortBy: "updatedAt",
          onDelete: vi.fn(),
        }),
      ),
    ),
  );
}

it("badges a draft, a published post and a published post with changes", () => {
  renderRow({ status: "draft" });
  expect(screen.getByText(m.admin_posts_status_draft())).toBeDefined();
  cleanup();

  renderRow({ status: "published", publicSlug: "post" });
  expect(screen.getByText(m.admin_posts_status_published())).toBeDefined();
  cleanup();

  renderRow({
    status: "published",
    publicSlug: "post",
    hasUnpublishedChanges: true,
  });
  expect(
    screen.getByText(m.admin_posts_status_published_changed()),
  ).toBeDefined();
});
