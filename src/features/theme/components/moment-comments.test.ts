// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CommentTarget } from "@/features/comments/comment-target";
import { m } from "@/paraglide/messages";
import { CuckooCommentSection } from "../themes/cuckoo/components/comments/view/comment-section";
import { CommentSection as DefaultCommentSection } from "../themes/default/components/comments/view/comment-section";
import { FuwariCommentSection } from "../themes/fuwari/components/comments/view/comment-section";

const state = vi.hoisted(() => ({
  muted: false,
  comment: undefined as number | undefined,
  thread: undefined as { id: number } | undefined,
  failed: false,
  create: vi.fn(async (_input: unknown) => ({ id: 12 })),
  targets: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/lib/auth/auth-client", () => ({
  useSession: () => ({ data: { user: { id: "reader", name: "Reader" } } }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) =>
    createElement("a", null, children),
  useSearch: ({ select }: { select: (s: object) => unknown }) =>
    select({ comment: state.comment }),
}));
vi.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: () => ({
    data: { pages: [{ items: [], total: 0, viewerMuted: state.muted }] },
    isLoading: false,
  }),
  useQuery: () => ({
    data: state.thread,
    isSuccess: !!state.thread,
    isError: state.failed,
  }),
}));
vi.mock("@/features/comments/queries", () => ({
  rootCommentsInfiniteQuery: (target: CommentTarget) => {
    state.targets(target);
    return {};
  },
  commentThreadQuery: () => ({}),
}));
vi.mock("@/features/comments/hooks/use-comments", () => ({
  useComments: () => ({ createComment: state.create, deleteComment: vi.fn() }),
}));
vi.mock("@/features/comments/hooks/use-scroll-to-comment", () => ({
  useScrollToComment: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: state.error } }));
vi.mock("@/components/common/turnstile", () => ({
  Turnstile: () => null,
  useTurnstile: () => ({
    isPending: false,
    reset: vi.fn(),
    turnstileProps: {},
  }),
}));

function Editor({ onSubmit }: { onSubmit: (body: object) => Promise<void> }) {
  return createElement(
    "button",
    {
      onClick: () =>
        onSubmit({
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "hello" }] },
          ],
        }),
    },
    "Send",
  );
}
function List({
  rootComments,
  onReply,
  onSubmitReply,
}: {
  rootComments: Array<{ id: number }>;
  onReply?: (root: number, id: number, name: string) => void;
  onSubmitReply: (body: object) => Promise<void>;
}) {
  return createElement(
    "div",
    null,
    ...rootComments.map((root) =>
      createElement("p", { key: root.id }, `thread ${root.id}`),
    ),
    onReply
      ? createElement(
          "button",
          { onClick: () => onReply(3, 4, "Reader") },
          "Reply",
        )
      : null,
    createElement(
      "button",
      {
        onClick: () =>
          onSubmitReply({
            type: "doc",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "reply" }] },
            ],
          }),
      },
      "Send reply",
    ),
  );
}
vi.mock("../themes/default/components/comments/view/comment-editor", () => ({
  CommentEditor: Editor,
}));
vi.mock("../themes/fuwari/components/comments/editor/comment-editor", () => ({
  FuwariCommentEditor: Editor,
}));
vi.mock("../themes/cuckoo/components/comments/editor/comment-editor", () => ({
  CuckooCommentEditor: Editor,
}));
vi.mock("../themes/default/components/comments/view/comment-list", () => ({
  CommentList: List,
}));
vi.mock("../themes/fuwari/components/comments/view/comment-list", () => ({
  FuwariCommentList: List,
}));
vi.mock("../themes/cuckoo/components/comments/view/comment-list", () => ({
  CuckooCommentList: List,
}));
vi.mock("@/components/ui/confirmation-modal", () => ({ default: () => null }));
vi.mock("../themes/fuwari/components/comments/view/confirmation-modal", () => ({
  default: () => null,
}));
vi.mock("../themes/cuckoo/components/comments/view/confirmation-modal", () => ({
  default: () => null,
}));

beforeEach(() => {
  state.muted = false;
  state.comment = undefined;
  state.thread = undefined;
  state.failed = false;
  vi.clearAllMocks();
});
afterEach(cleanup);

describe.each([
  ["default", DefaultCommentSection],
  ["fuwari", FuwariCommentSection],
  ["cuckoo", CuckooCommentSection],
] as const)("%s comments", (_name, Section) => {
  it.each(["post", "moment"] as const)(
    "reads and writes roots and replies on the %s target",
    async (type) => {
      const target = { type, id: 7 };
      const view = render(createElement(Section, { target }));
      expect(view.container.querySelectorAll("#comments")).toHaveLength(1);
      expect(state.targets).toHaveBeenCalledWith(target);
      fireEvent.click(screen.getByText("Send"));
      const key = type === "post" ? "postId" : "momentId";
      await waitFor(() =>
        expect(state.create).toHaveBeenCalledWith({
          [key]: 7,
          content: "hello",
        }),
      );
      fireEvent.click(screen.getByText("Reply"));
      fireEvent.click(screen.getByText("Send reply"));
      await waitFor(() =>
        expect(state.create).toHaveBeenCalledWith({
          [key]: 7,
          content: "reply",
          rootId: 3,
          replyToCommentId: 4,
        }),
      );
    },
  );

  it("shows the muted notice outside the avatar and hides composing", () => {
    state.muted = true;
    render(createElement(Section, { target: { type: "moment", id: 7 } }));
    expect(screen.getByRole("status").textContent).toBe(
      m.comments_muted_message(),
    );
    expect(screen.queryByText("Send")).toBeNull();
    expect(screen.queryByText("Reply")).toBeNull();
  });

  it("includes a linked thread beyond the first page and reports a missing comment", () => {
    state.comment = 21;
    state.thread = { id: 20 };
    const view = render(
      createElement(Section, { target: { type: "moment", id: 7 } }),
    );
    expect(screen.getByText("thread 20")).toBeTruthy();
    state.thread = undefined;
    state.failed = true;
    view.rerender(
      createElement(Section, { target: { type: "moment", id: 7 } }),
    );
    expect(state.error).toHaveBeenCalledWith(m.comments_locate_failed());
  });
});
