// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SearchPageProps } from "@/features/theme/contract/pages";
import { m } from "@/paraglide/messages";
import { SearchPage } from "./page";

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  vi.stubGlobal("IntersectionObserver", undefined);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function props(): SearchPageProps {
  return {
    query: "hello",
    results: [],
    isSearching: false,
    onQueryChange: vi.fn(),
    onSelectPost: vi.fn(),
    onBack: vi.fn(),
  };
}

it("preserves Chinese input composition callbacks", () => {
  const handlers = { ...props(), onCompositionChange: vi.fn() };
  const { getByRole } = render(createElement(SearchPage, handlers));
  const input = getByRole("textbox");
  fireEvent.compositionStart(input);
  fireEvent.change(input, { target: { value: "你好" } });
  fireEvent.compositionEnd(input);
  expect(handlers.onQueryChange).toHaveBeenCalledWith("你好");
  expect(handlers.onCompositionChange.mock.calls).toEqual([[true], [false]]);
});

it("renders retry on errors instead of a misleading empty result", () => {
  const onRetry = vi.fn();
  const { getByRole, queryByText } = render(
    createElement(SearchPage, { ...props(), hasError: true, onRetry }),
  );
  fireEvent.click(getByRole("button", { name: m.search_retry() }));
  expect(onRetry).toHaveBeenCalledOnce();
  expect(queryByText(m.search_no_results())).toBeNull();
});

it("keeps highlighted matches and literal markup safe while selecting a result", () => {
  const data = props();
  data.results = [
    {
      post: {
        id: "1",
        slug: "hello",
        title: '<img src=x onerror="alert(1)">',
        summary: null,
        tags: [],
      },
      score: 1,
      matches: {
        title: null,
        summary: "<mark>hello</mark> &lt;script&gt;example&lt;/script&gt;",
        contentSnippet: null,
      },
    },
  ];
  const { container, getByRole } = render(createElement(SearchPage, data));
  expect(container.querySelector("img, script")).toBeNull();
  expect(container.querySelector("mark")?.textContent).toBe("hello");
  expect(container.textContent).toContain("<script>example</script>");
  fireEvent.click(getByRole("button", { name: /img src=x/ }));
  expect(data.onSelectPost).toHaveBeenCalledWith("hello");
});
