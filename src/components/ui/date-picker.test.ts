// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement, type FormEvent } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import DatePicker from "./date-picker";

vi.mock("@/paraglide/runtime", async () => ({
  ...(await vi.importActual("@/paraglide/runtime")),
  getLocale: () => "en",
}));

const originalTZ = process.env.TZ;

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

it.each(["Pacific/Kiritimati", "Etc/GMT+12"])(
  "keeps the selected month and Sunday-first calendar correct in %s",
  (timezone) => {
    process.env.TZ = timezone;
    const { container } = render(
      createElement(DatePicker, {
        value: "2026-09-01",
        onChange: vi.fn(),
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "2026-09-01" }));
    expect(screen.getByRole("heading").textContent).toBe("September 2026");
    const calendars = container.querySelectorAll(".grid-cols-7");
    expect(Array.from(calendars[0].children, (day) => day.textContent)).toEqual(
      ["S", "M", "T", "W", "T", "F", "S"],
    );
    // September 1, 2026 is a Tuesday: Sunday and Monday are empty slots.
    expect(calendars[1].children[2].textContent).toBe("1");
  },
);

it("uses the supplied UTC today, disables future days, and keeps picks date-only", () => {
  process.env.TZ = "Pacific/Kiritimati";
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-01T23:30:00Z"));
  const onChange = vi.fn();
  const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
  render(
    createElement(
      "form",
      { onSubmit },
      createElement(DatePicker, {
        value: "2026-09-01",
        today: "2026-09-01",
        maxDate: "2026-09-01",
        onChange,
      }),
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "2026-09-01" }));
  const today = screen.getByRole("button", { name: "1" });
  expect(today.getAttribute("aria-current")).toBe("date");
  expect(today.getAttribute("aria-pressed")).toBe("true");
  const tomorrow = screen.getByRole("button", { name: "2" });
  expect((tomorrow as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(tomorrow);
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(today);
  expect(onChange).toHaveBeenCalledWith("2026-09-01");
  expect(onSubmit).not.toHaveBeenCalled();
});

it("defaults today to the UTC date when no server date is supplied", () => {
  process.env.TZ = "Etc/GMT+12";
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-01T00:30:00Z"));
  render(createElement(DatePicker, { value: "", onChange: vi.fn() }));
  fireEvent.click(screen.getByRole("button"));
  expect(screen.getByRole("heading").textContent).toBe("September 2026");
  expect(
    screen.getByRole("button", { name: "1" }).getAttribute("aria-current"),
  ).toBe("date");
});

it("follows changed values and resets the visible month when reopened", () => {
  process.env.TZ = "Etc/GMT+12";
  const onChange = vi.fn();
  const { rerender } = render(
    createElement(DatePicker, { value: "2026-09-01", onChange }),
  );
  fireEvent.click(screen.getByRole("button", { name: "2026-09-01" }));
  rerender(createElement(DatePicker, { value: "2026-12-01", onChange }));
  expect(screen.getByRole("heading").textContent).toBe("December 2026");
  fireEvent.click(screen.getByRole("button", { name: "January 2027" }));
  expect(screen.getByRole("heading").textContent).toBe("January 2027");
  fireEvent.click(screen.getByRole("button", { name: "2026-12-01" }));
  fireEvent.click(screen.getByRole("button", { name: "2026-12-01" }));
  expect(screen.getByRole("heading").textContent).toBe("December 2026");
});
