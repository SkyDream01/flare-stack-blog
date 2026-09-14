// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useTaxonomyScroll } from "./use-taxonomy-scroll";

const location = vi.hoisted(() => ({ scrollTop: 180, lowHeight: false }));
vi.mock("@tanstack/react-router", () => ({
  useLocation: ({ select }: { select: (value: unknown) => unknown }) =>
    select({ state: { taxonomyScrollTop: location.scrollTop } }),
}));
vi.mock("@/hooks/use-motion", () => ({
  useMediaQuery: () => location.lowHeight,
}));

let outer: HTMLDivElement;
let inner: HTMLDivElement;
beforeEach(() => {
  location.scrollTop = 180;
  outer = document.createElement("div");
  outer.className = "admin-list-region";
  inner = document.createElement("div");
  outer.appendChild(inner);
  document.body.appendChild(outer);
});
afterEach(() => {
  cleanup();
  outer.remove();
});

it.each([false, true])(
  "restores after rows arrive, preserves refreshes, and resets changed queries (low height: %s)",
  (lowHeight) => {
    location.lowHeight = lowHeight;
    const scroller = lowHeight ? outer : inner;
    const other = lowHeight ? inner : outer;
    const ref = { current: inner };
    const { result, rerender } = renderHook(
      ({ key, ready }) => useTaxonomyScroll(ref, key, ready),
      { initialProps: { key: "category:1", ready: false } },
    );
    expect(scroller.scrollTop).toBe(0);
    rerender({ key: "category:1", ready: true });
    expect(scroller.scrollTop).toBe(180);
    expect(other.scrollTop).toBe(0);

    scroller.scrollTop = 240;
    expect(result.current()).toBe(240);
    rerender({ key: "category:1", ready: false });
    rerender({ key: "category:1", ready: true });
    expect(scroller.scrollTop).toBe(240);

    rerender({ key: "tag:1", ready: false });
    expect(scroller.scrollTop).toBe(240);
    rerender({ key: "tag:1", ready: true });
    expect(scroller.scrollTop).toBe(0);
    expect(result.current()).toBe(0);
  },
);

it("clamps a negative editor return position", () => {
  location.lowHeight = false;
  location.scrollTop = -10;
  inner.scrollTop = 50;
  renderHook(() => useTaxonomyScroll({ current: inner }, "category:1", true));
  expect(inner.scrollTop).toBe(0);
});
