// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Reveal } from "./reveal";

let reduced: boolean;
let top: number;
let intersect: (entries: Array<{ isIntersecting: boolean }>) => void;
let preferenceChange: () => void;
const observe = vi.fn();
const disconnect = vi.fn();

beforeEach(() => {
  reduced = false;
  top = 1200;
  vi.stubGlobal("matchMedia", () => ({
    get matches() {
      return reduced;
    },
    addEventListener: (_: string, callback: () => void) => {
      preferenceChange = callback;
    },
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = observe;
      disconnect = disconnect;
      constructor(callback: typeof intersect) {
        intersect = callback;
      }
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () => ({ top, bottom: top + 200, height: 200 }) as DOMRect,
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const content = () =>
  createElement(Reveal, {
    delay: 5000,
    children: createElement("button", null, "Read"),
  });

it("keeps server content visible without JavaScript or observer support", () => {
  expect(renderToString(content())).not.toContain("data-reveal=");
  vi.stubGlobal("IntersectionObserver", undefined);
  const { container } = render(content());
  expect(container.firstElementChild?.hasAttribute("data-reveal")).toBe(false);
});

it("reveals offscreen content once, without carrying a long list's delay into scrolling", () => {
  const { container, unmount } = render(content());
  const element = container.firstElementChild as HTMLElement;
  expect(element.dataset.reveal).toBe("pending");
  expect(element.style.getPropertyValue("--cuckoo-reveal-delay")).toBe("0ms");
  expect(observe).toHaveBeenCalledWith(element);
  act(() => intersect([{ isIntersecting: false }]));
  expect(element.dataset.reveal).toBe("pending");
  act(() => intersect([{ isIntersecting: true }]));
  expect(element.dataset.reveal).toBe("visible");
  expect(disconnect).toHaveBeenCalledTimes(1);
  unmount();
  expect(disconnect).toHaveBeenCalledTimes(2);
});

it("caps the initial stagger and leaves content above a restored scroll position alone", () => {
  top = 100;
  const first = render(content());
  const element = first.container.firstElementChild as HTMLElement;
  expect(element.dataset.reveal).toBe("visible");
  expect(element.style.getPropertyValue("--cuckoo-reveal-delay")).toBe("180ms");
  first.unmount();
  top = -300;
  const restored = render(content());
  expect(
    restored.container.firstElementChild?.hasAttribute("data-reveal"),
  ).toBe(false);
});

it("reveals keyboard targets immediately", () => {
  const { container, getByRole } = render(content());
  fireEvent.focusIn(getByRole("button"));
  expect((container.firstElementChild as HTMLElement).dataset.reveal).toBe(
    "visible",
  );
  expect(disconnect).toHaveBeenCalledTimes(1);
});

it("waits for layout when Suspense is still hiding the hydrated tree", () => {
  vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockReturnValue({
    top: 0,
    bottom: 0,
    height: 0,
  } as DOMRect);
  const { container } = render(content());
  const element = container.firstElementChild as HTMLElement;
  expect(element.dataset.reveal).toBe("pending");
  expect(observe).toHaveBeenCalledWith(element);
  act(() => intersect([{ isIntersecting: true }]));
  expect(element.dataset.reveal).toBe("visible");
});

it("respects reduced motion on mount and when the preference changes", () => {
  reduced = true;
  const first = render(content());
  expect(first.container.firstElementChild?.hasAttribute("data-reveal")).toBe(
    false,
  );
  expect(observe).not.toHaveBeenCalled();
  first.unmount();
  reduced = false;
  const next = render(content());
  act(() => {
    reduced = true;
    preferenceChange();
  });
  expect(next.container.firstElementChild?.hasAttribute("data-reveal")).toBe(
    false,
  );
  expect(disconnect).toHaveBeenCalledTimes(1);
});
