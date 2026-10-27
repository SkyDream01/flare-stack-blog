import { describe, expect, it } from "vitest";
import { rateLimitKeyFromIp } from "./rate-limit-key";

describe("rateLimitKeyFromIp", () => {
  it("keeps IPv4 unchanged", () => {
    expect(rateLimitKeyFromIp("203.0.113.7")).toBe("203.0.113.7");
  });

  it("returns unknown when the header is missing", () => {
    expect(rateLimitKeyFromIp(null)).toBe("unknown");
    expect(rateLimitKeyFromIp(undefined)).toBe("unknown");
    expect(rateLimitKeyFromIp("  ")).toBe("unknown");
  });

  it("cuts IPv6 to its /64 prefix", () => {
    expect(rateLimitKeyFromIp("2001:db8:1:2:aaaa:bbbb:cccc:dddd")).toBe(
      "2001:db8:1:2::/64",
    );
  });

  it("gives every address in one /64 the same key", () => {
    expect(rateLimitKeyFromIp("2001:db8:1:2::1")).toBe(
      rateLimitKeyFromIp("2001:0DB8:0001:0002:ffff:ffff:ffff:ffff"),
    );
    expect(rateLimitKeyFromIp("2001:db8:1:2::1")).not.toBe(
      rateLimitKeyFromIp("2001:db8:1:3::1"),
    );
  });

  it("expands :: compression inside the prefix", () => {
    expect(rateLimitKeyFromIp("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(rateLimitKeyFromIp("::1")).toBe("0:0:0:0::/64");
    expect(rateLimitKeyFromIp("2001:db8:0:0:1::")).toBe("2001:db8:0:0::/64");
  });

  it("normalizes case and leading zeros", () => {
    expect(rateLimitKeyFromIp("2001:DB8:00A:0::1")).toBe("2001:db8:a:0::/64");
  });

  it("treats IPv4-mapped addresses as that IPv4", () => {
    expect(rateLimitKeyFromIp("::ffff:203.0.113.7")).toBe("203.0.113.7");
    expect(rateLimitKeyFromIp("::FFFF:cb00:7107")).toBe("203.0.113.7");
    expect(rateLimitKeyFromIp("0:0:0:0:0:ffff:1.2.3.4")).toBe("1.2.3.4");
  });

  it("drops a zone id", () => {
    expect(rateLimitKeyFromIp("fe80::1%eth0")).toBe("fe80:0:0:0::/64");
  });
});
