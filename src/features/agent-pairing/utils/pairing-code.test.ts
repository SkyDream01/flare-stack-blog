import { describe, expect, it } from "vitest";
import {
  hashPairingCode,
  newPairingCode,
  normalizePairingCode,
} from "./pairing-code";

describe("Pairing Codes", () => {
  it("are eight characters without 0, O, 1, I or L, shown as ABCD-EFGH", () => {
    const codes = Array.from({ length: 200 }, newPairingCode);
    for (const code of codes) {
      expect(code).toMatch(/^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
    }
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("are read without case, hyphens or spaces", () => {
    for (const typed of [
      "abcd-efgh",
      "ABCDEFGH",
      " AbCd EfGh ",
      "AB-CD-EF-GH",
    ]) {
      expect(normalizePairingCode(typed), typed).toBe("ABCDEFGH");
    }
  });

  it("refuse what no code can be", () => {
    for (const typed of [
      "",
      "ABCD-EFG",
      "ABCD-EFGHJ",
      "ABCD-EFG0",
      "OIL2-3456",
    ]) {
      expect(normalizePairingCode(typed), typed).toBeNull();
    }
  });

  it("are stored as a SHA-256 hash of the normalized code", async () => {
    const hash = await hashPairingCode("ABCDEFGH");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("ABCDEFGH");
    expect(await hashPairingCode(normalizePairingCode("abcd-efgh")!)).toBe(
      hash,
    );
  });
});
