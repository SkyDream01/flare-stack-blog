// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createElement, useCallback, useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AdminChromeProvider } from "./admin-chrome";
import { taxonomySearchSchema, type TaxonomyState } from "./taxonomy-state";
import { TaxonomyWorkspace } from "./taxonomy-workspace";
import type { GetPostsInput } from "@/features/posts/schema/posts.schema";
import { m } from "@/paraglide/messages";

const requests = vi.hoisted(() => ({
  categories: vi.fn(),
  tags: vi.fn(),
  posts: vi.fn(),
}));

vi.mock("@/features/categories/queries", () => ({
  categoriesAdminQueryOptions: () => ({
    queryKey: ["categories"],
    queryFn: requests.categories,
  }),
}));
vi.mock("@/features/tags/queries", () => ({
  tagsWithCountAdminQueryOptions: () => ({
    queryKey: ["tags"],
    queryFn: requests.tags,
  }),
}));
vi.mock("@/features/posts/queries", () => ({
  adminPostsQuery: (input: GetPostsInput) => ({
    queryKey: ["posts", input],
    queryFn: () => requests.posts(input),
  }),
}));
vi.mock("@/lib/orpc", () => ({
  orpc: {
    categories: { key: () => ["categories"] },
    tags: { admin: { key: () => ["tags"] } },
  },
}));
vi.mock("@/features/categories/components/category-manager", () => ({
  CategoryManager: () => null,
}));
vi.mock("@/features/tags/components/tag-manager", () => ({
  TagManager: () => null,
}));
vi.mock("@/components/ui/confirmation-modal", () => ({
  default: () => null,
}));
vi.mock("@/features/posts/components/post-manager/components/post-row", () => ({
  PostRow: () => null,
}));
vi.mock("@/features/posts/components/post-manager/hooks/use-posts", () => ({
  useDeletePost: () => ({ isPending: false, mutate: vi.fn() }),
}));

const categories = {
  items: [
    { id: 11, name: "Alpha", postCount: 30, publicPostCount: 5 },
    { id: 12, name: "Beta", postCount: 2, publicPostCount: 0 },
  ],
  uncategorizedPostCount: 4,
  uncategorizedPublicPostCount: 1,
};
let queryClient: QueryClient;

beforeEach(() => {
  requests.categories.mockReset().mockResolvedValue(categories);
  requests.tags
    .mockReset()
    .mockResolvedValue([
      { id: 21, name: "Notes", postCount: 4, publicPostCount: 2 },
    ]);
  requests.posts.mockReset().mockResolvedValue({ items: [], total: 36 });
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)",
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function mountWorkspace(
  initial: Partial<TaxonomyState> = {},
  initialScroll = 0,
) {
  const changes = vi.fn();
  let currentState = taxonomySearchSchema.parse(initial);
  function ControlledWorkspace() {
    const [state, setState] = useState(currentState);
    currentState = state;
    const onChange = useCallback(
      (patch: Partial<TaxonomyState>, replace?: boolean) => {
        changes(patch, replace);
        setState((previous) => ({ ...previous, ...patch }));
      },
      [],
    );
    return createElement(TaxonomyWorkspace, { state, onChange });
  }
  const root = createRootRoute();
  const workspace = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: ControlledWorkspace,
  });
  const posts = createRoute({
    getParentRoute: () => root,
    path: "/admin/posts",
  });
  const history = createMemoryHistory({ initialEntries: ["/"] });
  history.replace("/", { taxonomyScrollTop: initialScroll });
  const router = createRouter({
    routeTree: root.addChildren([workspace, posts]),
    history,
  });
  await act(async () => {
    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          AdminChromeProvider,
          null,
          createElement(RouterProvider, { router }),
        ),
      ),
    );
    await router.load();
  });
  return { changes, state: () => currentState };
}

function postSearch() {
  return screen.getByRole<HTMLInputElement>("searchbox", {
    name: m.taxonomy_posts_search(),
  });
}

async function ready() {
  await waitFor(() => {
    expect(requests.posts).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "2" })).toBeDefined();
  });
}

it("selects the first Category without rewriting the default route state", async () => {
  const workspace = await mountWorkspace();
  await ready();
  expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Alpha");
  expect(requests.posts).toHaveBeenLastCalledWith({
    taxonomy: { kind: "category", id: 11, scope: "current" },
    search: "",
    sortBy: "updatedAt",
    sortDir: "DESC",
    limit: 12,
    offset: 0,
  });
  expect(workspace.changes).not.toHaveBeenCalled();
});

it("keeps an explicit ID during loading and error, then replaces it only after navigation recovers", async () => {
  let rejectCategories!: (error: Error) => void;
  requests.categories.mockReturnValueOnce(
    new Promise((_resolve, reject) => {
      rejectCategories = reject;
    }),
  );
  const workspace = await mountWorkspace({ id: 999, page: 3, search: "draft" });
  expect(workspace.state().id).toBe(999);
  expect(workspace.changes).not.toHaveBeenCalled();
  expect(requests.posts).not.toHaveBeenCalled();

  await act(async () => rejectCategories(new Error("Navigation unavailable")));
  await screen.findByRole("alert");
  expect(workspace.changes).not.toHaveBeenCalled();
  expect(requests.posts).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: m.error_retry() }));
  await ready();
  expect(workspace.changes).toHaveBeenCalledExactlyOnceWith(
    { id: undefined, page: 1, search: "" },
    true,
  );
  expect(workspace.state()).toMatchObject({
    id: undefined,
    page: 1,
    search: "",
  });
});

it("shows an empty selection for an empty Tag list without requesting unrelated Posts", async () => {
  requests.tags.mockResolvedValue([]);
  const workspace = await mountWorkspace({ kind: "tag" });
  await screen.findByText(m.tag_manager_empty());
  expect(screen.getByText(m.taxonomy_empty_selection())).toBeDefined();
  expect(postSearch().disabled).toBe(true);
  expect(requests.posts).not.toHaveBeenCalled();
  expect(workspace.changes).not.toHaveBeenCalled();
});

it.each(["scope", "kind"] as const)(
  "cancels pending search when switching %s even when committed search is empty",
  async (context) => {
    const workspace = await mountWorkspace();
    await ready();
    vi.useFakeTimers();
    fireEvent.change(postSearch(), { target: { value: "unsent search" } });
    fireEvent.click(
      screen.getByRole("button", {
        name:
          context === "scope"
            ? `${m.taxonomy_scope_public()} 5`
            : m.tag_manager_title(),
      }),
    );
    expect(postSearch().value).toBe("");
    await act(async () => vi.advanceTimersByTimeAsync(350));
    expect(workspace.state()).toMatchObject({
      kind: context === "kind" ? "tag" : "category",
      scope: context === "scope" ? "public" : "current",
      page: 1,
      search: "",
    });
    expect(workspace.changes).toHaveBeenCalledTimes(1);
    expect(
      requests.posts.mock.calls.some(
        ([input]) => input.search === "unsent search",
      ),
    ).toBe(false);
  },
);

it.each(["sort", "page"] as const)(
  "preserves committed and pending search across a %s change",
  async (control) => {
    const workspace = await mountWorkspace({ search: "committed", page: 2 });
    await ready();
    vi.useFakeTimers();
    fireEvent.change(postSearch(), { target: { value: "next search" } });
    if (control === "sort") {
      fireEvent.click(
        screen.getByRole("button", { name: m.admin_posts_sort_label() }),
      );
      fireEvent.click(
        screen.getByRole("menuitemradio", {
          name: m.admin_posts_sort_recent_pub(),
        }),
      );
    } else {
      fireEvent.click(screen.getByRole("button", { name: "3" }));
    }
    expect(workspace.state()).toMatchObject({
      search: "committed",
      page: control === "sort" ? 1 : 3,
      sortBy: control === "sort" ? "publishedAt" : "updatedAt",
    });
    expect(postSearch().value).toBe("next search");
    await act(async () => vi.advanceTimersByTimeAsync(299));
    expect(workspace.state().search).toBe("committed");
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(workspace.state()).toMatchObject({ search: "next search", page: 1 });
    expect(workspace.changes).toHaveBeenLastCalledWith(
      { search: "next search", page: 1 },
      undefined,
    );
  },
);

it("replaces an out-of-range page after a successful Post count refresh", async () => {
  const workspace = await mountWorkspace({ page: 3, search: "kept" });
  await ready();
  expect(workspace.changes).not.toHaveBeenCalled();
  requests.posts.mockResolvedValue({ items: [], total: 13 });
  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: ["posts"] });
  });
  await waitFor(() => expect(workspace.state().page).toBe(2));
  expect(workspace.changes).toHaveBeenCalledExactlyOnceWith({ page: 2 }, true);
  expect(workspace.state().search).toBe("kept");
  expect(requests.posts).toHaveBeenLastCalledWith(
    expect.objectContaining({ offset: 12, search: "kept" }),
  );
});

it("restores initial scrolling once, preserves it on refresh, and resets it for a new page", async () => {
  await mountWorkspace({}, 140);
  await ready();
  const results = screen.getByRole("region", { name: "Alpha" });
  expect(results.scrollTop).toBe(140);
  results.scrollTop = 220;
  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: ["posts"] });
  });
  expect(results.scrollTop).toBe(220);
  fireEvent.click(screen.getByRole("button", { name: "2" }));
  await waitFor(() => expect(results.scrollTop).toBe(0));
});
