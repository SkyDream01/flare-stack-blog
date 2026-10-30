import { describe, expect, it } from "vitest";
import {
  hasControlCharacter,
  uniqueKeyOf,
  withoutControlCharacters,
} from "./unicode-text";

describe("hasControlCharacter", () => {
  it.each([
    ["NUL", "a\u0000b"],
    ["TAB", "a\tb"],
    ["line feed", "a\nb"],
    ["zero width space", "a\u200Bb"],
    ["zero width joiner between letters", "a\u200Db"],
    ["right-to-left override", "a\u202Eb"],
    ["right-to-left mark", "a\u200Fb"],
    ["byte order mark", "\uFEFFab"],
    ["soft hyphen", "a\u00ADb"],
  ])("finds %s", (_name, text) => {
    expect(hasControlCharacter(text)).toBe(true);
    expect(hasControlCharacter(text, { emoji: true })).toBe(true);
  });

  it.each([
    ["plain text", "Hello, world"],
    ["Chinese", "你好，世界"],
    ["a no-break space", "a\u00A0b"],
    ["fullwidth letters", "ＡＢＣ"],
    ["an emoji with a variation selector", "❤️"],
  ])("passes %s", (_name, text) => {
    expect(hasControlCharacter(text)).toBe(false);
  });

  it("allows a zero width joiner inside an emoji sequence only when asked", () => {
    for (const emoji of [
      "👩\u200D💻",
      "👨\u200D👩\u200D👧",
      "🏳️\u200D🌈",
      "👋🏽\u200D",
    ]) {
      expect(hasControlCharacter(emoji)).toBe(true);
    }
    expect(hasControlCharacter("👩\u200D💻 notes", { emoji: true })).toBe(
      false,
    );
    expect(hasControlCharacter("👨\u200D👩\u200D👧", { emoji: true })).toBe(
      false,
    );
    expect(hasControlCharacter("🏳️\u200D🌈", { emoji: true })).toBe(false);
    expect(hasControlCharacter("👩\u200D", { emoji: true })).toBe(true);
    expect(hasControlCharacter("a\u200D💻", { emoji: true })).toBe(true);
  });
});

describe("withoutControlCharacters", () => {
  it("turns line breaks and tabs into spaces and drops the rest", () => {
    expect(withoutControlCharacters("a\nb\tc\u200Bd\u202Ee\u0000f")).toBe(
      "a b cdef",
    );
  });

  it("keeps emoji joiners only when asked", () => {
    expect(withoutControlCharacters("👩\u200D💻\u200B", { emoji: true })).toBe(
      "👩\u200D💻",
    );
    expect(withoutControlCharacters("👩\u200D💻")).toBe("👩💻");
  });
});

describe("uniqueKeyOf", () => {
  it.each([
    ["case", "Hello", "hELLO"],
    ["fullwidth letters", "ＡＢＣ", "abc"],
    ["fullwidth digits and signs", "Ｃ＃１", "c#1"],
    ["a no-break space", "a\u00A0b", "a b"],
    ["an ideographic space", "a\u3000b", "a b"],
    ["a ligature", "ﬁle", "file"],
    ["a zero width space", "a\u200Bb", "ab"],
    ["accented capitals", "ÉCOLE", "école"],
    ["composed and decomposed accents", "é", "é"],
    ["sharp s", "Straße", "STRASSE"],
    ["capital sharp s and ss", "STRAẞE", "Strasse"],
    ["sharp s and capital sharp s", "Straße", "STRAẞE"],
    ["an emoji with a variation selector", "❤️", "❤"],
    ["a variation selector after a letter", "a️", "A"],
    ["a combining grapheme joiner", "a͏b", "AB"],
    ["a Hangul filler", "aㅤb", "ab"],
    ["a halfwidth Hangul filler", "aﾠb", "ab"],
    ["a tag character", "a\u{E0041}b", "ab"],
    ["Greek final sigma", "ΟΔΟΣ", "οδοσ"],
    ["Greek capital sigma and final sigma", "Σ", "ς"],
    ["Cyrillic", "Привет", "привет"],
  ])("equates %s", (_name, a, b) => {
    expect(uniqueKeyOf(a)).toBe(uniqueKeyOf(b));
  });

  it.each([
    ["different words", "react", "preact"],
    ["simplified and traditional Chinese", "笔记", "筆記"],
    ["a space and none", "a b", "ab"],
  ])("keeps %s apart", (_name, a, b) => {
    expect(uniqueKeyOf(a)).not.toBe(uniqueKeyOf(b));
  });

  it("gives case variants of any character one key, and folds a key to itself", () => {
    const failures: Array<string> = [];
    for (let code = 0; code <= 0x10ffff; code += 1) {
      if (code >= 0xd800 && code <= 0xdfff) continue;
      const character = String.fromCodePoint(code);
      const key = uniqueKeyOf(character);
      const variants = [
        character.toUpperCase(),
        character.toLowerCase(),
        character.toLowerCase().toUpperCase(),
      ];
      if (
        uniqueKeyOf(key) !== key ||
        variants.some((variant) => uniqueKeyOf(variant) !== key)
      ) {
        failures.push(code.toString(16));
      }
    }
    expect(failures).toEqual([]);
  }, 60_000);

  it("keeps apart what only looks alike", () => {
    expect(uniqueKeyOf("ss")).not.toBe(uniqueKeyOf("s s"));
    expect(uniqueKeyOf("e")).not.toBe(uniqueKeyOf("é"));
  });

  it("is SQLite's lower() for printable ASCII and CJK ideographs", () => {
    let ascii = "";
    for (let code = 0x20; code <= 0x7e; code += 1) {
      ascii += String.fromCharCode(code);
    }
    const asciiLower = ascii.replace(/[A-Z]/g, (c) => c.toLowerCase());
    expect(uniqueKeyOf(ascii)).toBe(asciiLower);
    for (let code = 0x4e00; code <= 0x9fff; code += 1) {
      const ideograph = String.fromCharCode(code);
      expect(uniqueKeyOf(ideograph)).toBe(ideograph);
    }
  });
});
