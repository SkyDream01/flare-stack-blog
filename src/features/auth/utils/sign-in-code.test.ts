import { describe, expect, it } from "vitest";
import {
  getResendCooldownMs,
  getSecondsLeft,
  isSignInCode,
  normalizeSignInCode,
  RESEND_COOLDOWN_MS,
} from "./sign-in-code";

describe("sign-in code input", () => {
  it("strips pasted spaces and dashes", () => {
    expect(normalizeSignInCode(" 123 456\n")).toBe("123456");
    expect(normalizeSignInCode("123-456")).toBe("123456");
  });

  it("accepts exactly six digits", () => {
    expect(isSignInCode("123456")).toBe(true);
    expect(isSignInCode("123 456")).toBe(true);
    expect(isSignInCode("12345")).toBe(false);
    expect(isSignInCode("1234567")).toBe(false);
    expect(isSignInCode("12345a")).toBe(false);
    expect(isSignInCode("")).toBe(false);
  });
});

describe("resend cooldown", () => {
  it("waits a minute by default", () => {
    expect(getResendCooldownMs()).toBe(RESEND_COOLDOWN_MS);
    expect(getResendCooldownMs(5_000)).toBe(RESEND_COOLDOWN_MS);
  });

  it("follows the server when it asks for longer", () => {
    expect(getResendCooldownMs(300_000)).toBe(300_000);
  });

  it("counts whole seconds left and never goes negative", () => {
    expect(getSecondsLeft(61_000, 1_000)).toBe(60);
    expect(getSecondsLeft(1_001, 1_000)).toBe(1);
    expect(getSecondsLeft(1_000, 2_000)).toBe(0);
  });
});
