import { describe, expect, it } from "vitest";
import { sameJson } from "./same-json";

describe("sameJson", () => {
  it("equates values written the same", () => {
    expect(sameJson(null, null)).toBe(true);
    expect(sameJson("a", "a")).toBe(true);
    expect(sameJson({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
  });

  it("ignores the order of object keys but not of array items", () => {
    expect(sameJson({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(sameJson([1, 2], [2, 1])).toBe(false);
  });

  it("tells values apart", () => {
    expect(sameJson({ a: 1 }, { a: 2 })).toBe(false);
    expect(sameJson({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(sameJson({ a: 1, b: 2 }, { a: 1 })).toBe(false);
    expect(sameJson(null, {})).toBe(false);
    expect(sameJson([], {})).toBe(false);
    expect(sameJson("1", 1)).toBe(false);
  });

  it("counts a key holding undefined as absent", () => {
    expect(sameJson({ a: 1, b: undefined }, { a: 1 })).toBe(true);
  });
});
