import { describe, expect, it } from "vitest";
import { matchesDeclaredImageType } from "./image-signature";

function bytes(...parts: Array<string | Array<number>>) {
  const out: Array<number> = [];
  for (const part of parts) {
    if (typeof part === "string") {
      out.push(...Array.from(part, (char) => char.charCodeAt(0)));
    } else {
      out.push(...part);
    }
  }
  return new Uint8Array(out).buffer;
}

const PNG = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "IHDR");
const JPEG = bytes([0xff, 0xd8, 0xff, 0xe0], "JFIF");
const GIF = bytes("GIF89a", [1, 0, 1, 0]);
const WEBP = bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 ");
const BOM = String.fromCharCode(0xfeff);
const text = (value: string) => new TextEncoder().encode(value).buffer;

describe("matchesDeclaredImageType", () => {
  it("accepts each raster format under its own type", () => {
    expect(matchesDeclaredImageType(PNG, "image/png")).toBe(true);
    expect(matchesDeclaredImageType(JPEG, "image/jpeg")).toBe(true);
    expect(matchesDeclaredImageType(JPEG, "image/jpg")).toBe(true);
    expect(matchesDeclaredImageType(GIF, "image/gif")).toBe(true);
    expect(matchesDeclaredImageType(bytes("GIF87a"), "image/gif")).toBe(true);
    expect(matchesDeclaredImageType(WEBP, "image/webp")).toBe(true);
  });

  it("refuses text declared as an image", () => {
    for (const type of ["image/png", "image/jpeg", "image/gif", "image/webp"]) {
      expect(matchesDeclaredImageType(text("not an image"), type)).toBe(false);
    }
  });

  it("refuses an image declared as another format", () => {
    expect(matchesDeclaredImageType(JPEG, "image/png")).toBe(false);
    expect(matchesDeclaredImageType(PNG, "image/gif")).toBe(false);
    expect(
      matchesDeclaredImageType(
        bytes("RIFF", [0, 0, 0, 0], "WAVE"),
        "image/webp",
      ),
    ).toBe(false);
  });

  it("refuses an empty or truncated file", () => {
    expect(matchesDeclaredImageType(new ArrayBuffer(0), "image/png")).toBe(
      false,
    );
    expect(matchesDeclaredImageType(bytes([0x89, 0x50]), "image/png")).toBe(
      false,
    );
  });

  it("accepts SVG text whose root element is svg", () => {
    expect(
      matchesDeclaredImageType(
        text('<svg xmlns="http://www.w3.org/2000/svg"/>'),
        "image/svg+xml",
      ),
    ).toBe(true);
    expect(
      matchesDeclaredImageType(
        text(
          BOM +
            '<?xml version="1.0"?>\n<!-- drawn by hand -->\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n<svg width="1" height="1"></svg>',
        ),
        "image/svg+xml",
      ),
    ).toBe(true);
  });

  it("refuses an SVG that is not SVG", () => {
    expect(
      matchesDeclaredImageType(text("<html></html>"), "image/svg+xml"),
    ).toBe(false);
    expect(matchesDeclaredImageType(text("plain text"), "image/svg+xml")).toBe(
      false,
    );
    expect(matchesDeclaredImageType(PNG, "image/svg+xml")).toBe(false);
  });

  it("refuses a type that is not accepted", () => {
    expect(matchesDeclaredImageType(PNG, "image/avif")).toBe(false);
  });
});
