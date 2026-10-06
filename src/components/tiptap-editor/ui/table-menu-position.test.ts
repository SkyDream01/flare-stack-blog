import { describe, expect, it } from "vitest";
import { tableMenuPosition } from "./table-menu-position";

const rect = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
});

const base = {
  menuWidth: 360,
  viewportWidth: 1400,
  visibleTop: 160,
};

describe("tableMenuPosition", () => {
  it("sits above the table, aligned to its right edge", () => {
    expect(
      tableMenuPosition({
        ...base,
        table: rect(344, 400, 974, 160),
        cell: rect(1000, 460, 318, 44),
      }),
    ).toEqual({ top: 400, left: 958 });
  });

  it("falls back to above the active cell once the table top has scrolled away", () => {
    expect(
      tableMenuPosition({
        ...base,
        table: rect(344, 40, 974, 900),
        cell: rect(344, 500, 318, 44),
      }),
    ).toEqual({ top: 500, left: 318 + 344 - 360 });
  });

  it("stays inside the viewport", () => {
    expect(
      tableMenuPosition({
        ...base,
        viewportWidth: 1100,
        table: rect(344, 400, 974, 160),
        cell: rect(1000, 460, 318, 44),
      }),
    ).toEqual({ top: 400, left: 1100 - 8 - 360 });
    expect(
      tableMenuPosition({
        ...base,
        menuWidth: 500,
        table: rect(0, 400, 300, 160),
        cell: rect(0, 460, 100, 44),
      }),
    ).toEqual({ top: 400, left: 8 });
  });
});
