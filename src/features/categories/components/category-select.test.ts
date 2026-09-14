// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { createElement, useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { categoriesAdminQueryOptions, categoryOptionsQuery } from "../queries";
import { PostEditorSummary } from "@/features/posts/components/post-editor/post-editor-summary";
import type { orpcClient } from "@/lib/orpc";
import { m } from "@/paraglide/messages";
import { CategorySelect } from "./category-select";

const requests = vi.hoisted(() => ({
  options: vi.fn<() => Promise<Array<{ id: number; name: string }>>>(),
  adminList: vi.fn<typeof orpcClient.categories.admin.list>(),
}));
vi.mock("@/lib/orpc", async () => {
  const { createTanstackQueryUtils } = await import("@orpc/tanstack-query");
  return {
    orpc: createTanstackQueryUtils({
      categories: {
        list: async () => [],
        admin: { options: requests.options, list: requests.adminList },
      },
      tags: { list: async () => [], admin: { list: async () => [] } },
    }),
  };
});

let queryClient: QueryClient;
afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.unstubAllGlobals();
});

it("uses lightweight options for selection and summary without replacing the management count cache", async () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  requests.options.mockResolvedValue([
    { id: 2, name: "Alpha new" },
    { id: 1, name: "Zeta unused" },
  ]);
  const management = {
    items: [],
    uncategorizedPostCount: 5,
    uncategorizedPublicPostCount: 3,
  };
  requests.adminList.mockResolvedValue(management);
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(categoriesAdminQueryOptions().queryKey, management);
  function EditorCategory() {
    const [categoryId, setCategoryId] = useState<number | null>(2);
    return createElement(
      "div",
      null,
      createElement(CategorySelect, {
        value: categoryId,
        onChange: setCategoryId,
      }),
      createElement(PostEditorSummary, {
        categoryId,
        tagIds: [],
        hasCover: false,
        onOpenInfo: () => {},
      }),
    );
  }
  render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(EditorCategory),
    ),
  );
  const picker = await screen.findByRole("button", { name: "Alpha new" });
  const summary = screen.getByRole("button", { name: m.editor_info_title() });
  expect(within(summary).getByText("Alpha new")).toBeDefined();
  expect(categoryOptionsQuery.queryKey).not.toEqual(
    categoriesAdminQueryOptions().queryKey,
  );
  expect(
    queryClient.getQueryData(categoriesAdminQueryOptions().queryKey),
  ).toEqual(management);
  expect(requests.adminList).not.toHaveBeenCalled();

  await act(async () => fireEvent.click(picker));
  fireEvent.click(screen.getByRole("option", { name: "Zeta unused" }));
  expect(within(summary).getByText("Zeta unused")).toBeDefined();
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Zeta unused" })),
  );
  fireEvent.click(
    screen.getByRole("option", { name: m.editor_meta_uncategorized() }),
  );
  expect(
    within(summary).getByText(m.editor_meta_uncategorized()),
  ).toBeDefined();
});
