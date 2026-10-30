import { describe, expect, it } from "vitest";
import {
  classifyHost,
  isPublicAddress,
  parseIpv4,
  parseIpv6,
} from "@/lib/http/public-address";

/** The host as a URL hands it over, so the URL parser's rewriting counts. */
function hostOf(url: string) {
  return classifyHost(new URL(url).hostname).kind;
}

describe("parseIpv4", () => {
  it.each([
    ["127.0.0.1", [127, 0, 0, 1]],
    ["127.1", [127, 0, 0, 1]],
    ["127.0.1", [127, 0, 0, 1]],
    ["2130706433", [127, 0, 0, 1]],
    ["0x7f.0.0.1", [127, 0, 0, 1]],
    ["0x7f000001", [127, 0, 0, 1]],
    ["0177.0.0.01", [127, 0, 0, 1]],
    ["10.0.0.1.", [10, 0, 0, 1]],
    ["0", [0, 0, 0, 0]],
  ])("reads %s", (text, bytes) => {
    expect(parseIpv4(text)).toEqual(bytes);
  });

  it.each(["", "1.2.3.4.5", "256.0.0.1", "1.2.65536", "08.0.0.1", "a.b.c.d"])(
    "does not read %s",
    (text) => {
      expect(parseIpv4(text)).toBeNull();
    },
  );
});

describe("parseIpv6", () => {
  it("reads compressed, bracketed and IPv4-tailed forms", () => {
    expect(parseIpv6("::1")).toEqual([...Array(15).fill(0), 1]);
    expect(parseIpv6("[::]")).toEqual(Array(16).fill(0));
    expect(parseIpv6("::ffff:127.0.0.1")).toEqual(
      parseIpv6("0:0:0:0:0:ffff:7f00:1"),
    );
  });

  it.each([
    "1:::2",
    "1::2::3",
    "12345::",
    "fe80::1%eth0",
    "::1.2.3",
    "1.2.3.4",
  ])("does not read %s", (text) => {
    expect(parseIpv6(text)).toBeNull();
  });
});

describe("classifyHost", () => {
  it.each([
    // IPv4 loopback, private, link-local, CGNAT and reserved, in every form
    "http://127.0.0.1/",
    "http://127.1/",
    "http://2130706433/",
    "http://0x7f.0.0.1/",
    "http://0177.0.0.1/",
    "http://0.0.0.0/",
    "http://10.1.2.3/",
    "http://172.16.0.1/",
    "http://172.31.255.255/",
    "http://192.168.1.1/",
    "http://169.254.169.254/",
    "http://100.64.0.1/",
    "http://100.127.255.255/",
    "http://198.18.0.1/",
    "http://224.0.0.1/",
    "http://255.255.255.255/",
    // IPv6
    "http://[::1]/",
    "http://[::]/",
    "http://[0:0:0:0:0:0:0:1]/",
    "http://[::ffff:127.0.0.1]:3000/x.png",
    "http://[::ffff:7f00:1]/",
    "http://[::ffff:10.0.0.1]/",
    "http://[::ffff:169.254.169.254]/",
    "http://[64:ff9b::127.0.0.1]/",
    "http://[2002:7f00:1::]/",
    "http://[fc00::1]/",
    "http://[fd12:3456::1]/",
    "http://[fe80::1]/",
    "http://[febf::1]/",
    "http://[ff02::1]/",
    "http://[2001:db8::1]/",
    "http://[::127.0.0.1]/",
    // Local names
    "http://localhost/",
    "http://LOCALHOST./",
    "http://app.localhost/",
    "http://printer.local/",
    "http://metadata.google.internal/",
    "http://router.home.arpa/",
    "http://intranet/",
  ])("refuses %s", (url) => {
    expect(hostOf(url)).toBe("non-public");
  });

  it.each([
    "http://8.8.8.8/",
    "http://1.1.1.1/",
    "http://172.32.0.1/",
    "http://100.128.0.1/",
    "http://[2606:4700:4700::1111]/",
    "http://[::ffff:8.8.8.8]/",
    "http://[2002:808:808::]/",
  ])("accepts the public address %s", (url) => {
    expect(hostOf(url)).toBe("public-ip");
  });

  it("leaves a public-looking name to its DNS answers", () => {
    expect(classifyHost("localtest.me")).toEqual({
      kind: "name",
      name: "localtest.me",
    });
    expect(classifyHost("Example.COM.")).toEqual({
      kind: "name",
      name: "example.com",
    });
  });
});

describe("isPublicAddress", () => {
  it("checks DNS answers of either family", () => {
    expect(isPublicAddress("93.184.216.34")).toBe(true);
    expect(isPublicAddress("2606:2800:220:1::1")).toBe(true);
    expect(isPublicAddress("127.0.0.1")).toBe(false);
    expect(isPublicAddress("10.0.0.5")).toBe(false);
    expect(isPublicAddress("::1")).toBe(false);
    expect(isPublicAddress("::ffff:192.168.0.1")).toBe(false);
    expect(isPublicAddress("fd00::1")).toBe(false);
    expect(isPublicAddress("not an address")).toBe(false);
  });
});
