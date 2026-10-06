// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import DropdownMenu from "./dropdown-menu";

// Unmount the menu as soon as it closes; exit motion is not under test.
vi.mock("@/hooks/use-motion", () => ({
  MOTION: { popover: 120 },
  useMotionPresence: (open: boolean) => open,
}));

const OPTIONS = [
  { label: "Newest", value: "newest" },
  { label: "Oldest", value: "oldest" },
];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderMenu(onChange = vi.fn()) {
  render(
    createElement(DropdownMenu, {
      value: "newest",
      options: OPTIONS,
      onChange,
      ariaLabel: "Sort",
    }),
  );
  return onChange;
}

function trigger() {
  return screen.getByRole("button", { name: "Sort" });
}

function placeTrigger(rect: { top: number; bottom: number; right: number }) {
  vi.spyOn(trigger(), "getBoundingClientRect").mockReturnValue({
    ...rect,
    left: rect.right - 80,
    width: 80,
    height: rect.bottom - rect.top,
    x: rect.right - 80,
    y: rect.top,
    toJSON: () => ({}),
  });
}

it("anchors the menu below the trigger's right edge", () => {
  renderMenu();
  placeTrigger({ top: 100, bottom: 124, right: 900 });

  fireEvent.click(trigger());

  const menu = screen.getByRole("menu");
  expect(menu.style.position).toBe("fixed");
  expect(menu.style.top).toBe("128px");
  expect(menu.style.right).toBe(`${window.innerWidth - 900}px`);
  expect(menu.style.width).toBe("176px");
  expect(menu.style.transformOrigin).toBe("top right");
  expect(menu.style.getPropertyValue("--popover-offset")).toBe("-4px");
});

it("opens upward when there is no room below the trigger", () => {
  renderMenu();
  const top = window.innerHeight - 60;
  placeTrigger({ top, bottom: top + 24, right: 900 });

  fireEvent.click(trigger());

  const menu = screen.getByRole("menu");
  expect(menu.style.top).toBe("");
  expect(menu.style.bottom).toBe("64px");
  expect(menu.style.transformOrigin).toBe("bottom right");
  expect(menu.style.getPropertyValue("--popover-offset")).toBe("4px");
});

it("closes on a click outside but not on one inside", () => {
  const onChange = renderMenu();
  fireEvent.click(trigger());

  fireEvent.mouseDown(screen.getByRole("menu"));
  expect(screen.getByRole("menu")).toBeTruthy();

  fireEvent.mouseDown(document.body);
  expect(screen.queryByRole("menu")).toBeNull();
  expect(onChange).not.toHaveBeenCalled();
});

it("picks an option and returns focus to the trigger", () => {
  const onChange = renderMenu();
  fireEvent.click(trigger());

  fireEvent.click(screen.getByRole("menuitemradio", { name: "Oldest" }));

  expect(onChange).toHaveBeenCalledWith("oldest");
  expect(screen.queryByRole("menu")).toBeNull();
  expect(document.activeElement).toBe(trigger());
});
