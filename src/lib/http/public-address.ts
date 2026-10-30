/*
 * Whether a host names the public internet, for fetches the server makes on
 * an address someone else chose (importing an image from a URL). Loopback,
 * private, link-local, shared (CGNAT), reserved and documentation ranges are
 * not public, in every way an address can be written: IPv4 in the dotted,
 * shortened, octal and hex forms `inet_aton` accepts, IPv6 compressed or with
 * an IPv4 tail, and IPv4 inside IPv6 (mapped, NAT64, 6to4).
 */

type Ipv4 = [number, number, number, number];
type Ipv6 = Array<number>; // 16 bytes

const IPV4_PART = /^(?:0x[0-9a-f]*|0[0-7]*|[1-9][0-9]*)$/i;

function parseIpv4Part(part: string): number | null {
  if (!IPV4_PART.test(part)) return null;
  if (/^0x/i.test(part)) return part.length === 2 ? 0 : parseInt(part, 16);
  if (part.length > 1 && part.startsWith("0")) return parseInt(part, 8);
  return Number(part);
}

/**
 * An IPv4 address in any form `inet_aton` and the URL parser accept:
 * `127.0.0.1`, `127.1`, `2130706433`, `0x7f.0.0.1`, `0177.0.0.1`. Null when
 * `text` is not one.
 */
export function parseIpv4(text: string): Ipv4 | null {
  const parts = text.replace(/\.$/, "").split(".");
  if (parts.length < 1 || parts.length > 4) return null;
  const values = parts.map(parseIpv4Part);
  if (values.some((value) => value === null || !Number.isSafeInteger(value))) {
    return null;
  }
  const numbers = values as Array<number>;
  const last = numbers.pop() as number;
  if (numbers.some((value) => value > 255)) return null;
  if (last >= 256 ** (4 - numbers.length)) return null;

  const bytes: Array<number> = [...numbers];
  for (let shift = 3 - numbers.length; shift >= 0; shift--) {
    bytes.push(Math.floor(last / 256 ** shift) % 256);
  }
  return bytes as Ipv4;
}

const STRICT_IPV4 =
  /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/**
 * An IPv6 address, with or without brackets, compressed or with an IPv4
 * tail. A zone (`fe80::1%eth0`) is never public, so it is not parsed.
 */
export function parseIpv6(text: string): Ipv6 | null {
  const address = text.replace(/^\[(.*)\]$/, "$1");
  if (!address.includes(":") || address.includes("%")) return null;

  const halves = address.split("::");
  if (halves.length > 2) return null;

  const groupsOf = (half: string): Array<number> | null => {
    if (half === "") return [];
    const groups: Array<number> = [];
    const pieces = half.split(":");
    for (const [index, piece] of pieces.entries()) {
      if (index === pieces.length - 1 && piece.includes(".")) {
        if (!STRICT_IPV4.test(piece)) return null;
        const [a, b, c, d] = piece.split(".").map(Number);
        groups.push(a * 256 + b, c * 256 + d);
      } else if (/^[0-9a-f]{1,4}$/i.test(piece)) {
        groups.push(parseInt(piece, 16));
      } else {
        return null;
      }
    }
    return groups;
  };

  const head = groupsOf(halves[0]);
  const tail = halves.length === 2 ? groupsOf(halves[1]) : [];
  if (!head || !tail) return null;
  // An IPv4 tail is only allowed at the very end.
  if (halves.length === 2 && halves[0].includes(".")) return null;

  let groups: Array<number>;
  if (halves.length === 2) {
    const missing = 8 - head.length - tail.length;
    if (missing < 1) return null;
    groups = [...head, ...Array<number>(missing).fill(0), ...tail];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;
  return groups.flatMap((group) => [group >> 8, group & 0xff]);
}

function inPrefix(bytes: Array<number>, prefix: Array<number>, bits: number) {
  for (let bit = 0; bit < bits; bit++) {
    const index = bit >> 3;
    const mask = 0x80 >> (bit & 7);
    if ((bytes[index] & mask) !== ((prefix[index] ?? 0) & mask)) return false;
  }
  return true;
}

// Not reachable on the public internet (IANA special-purpose registry).
const NON_PUBLIC_IPV4: Array<[Array<number>, number]> = [
  [[0], 8], // "this network", 0.0.0.0
  [[10], 8], // private
  [[100, 64], 10], // shared address space (CGNAT)
  [[127], 8], // loopback
  [[169, 254], 16], // link-local
  [[172, 16], 12], // private
  [[192, 0, 0], 24], // IETF protocol assignments
  [[192, 0, 2], 24], // documentation
  [[192, 88, 99], 24], // 6to4 relay anycast
  [[192, 168], 16], // private
  [[198, 18], 15], // benchmarking
  [[198, 51, 100], 24], // documentation
  [[203, 0, 113], 24], // documentation
  [[224], 4], // multicast
  [[240], 4], // reserved, broadcast
];

export function isPublicIpv4(bytes: Ipv4): boolean {
  return !NON_PUBLIC_IPV4.some(([prefix, bits]) =>
    inPrefix(bytes, prefix, bits),
  );
}

/**
 * Public IPv6 is global unicast (2000::/3) outside its special ranges. An
 * address carrying IPv4 (mapped, NAT64, 6to4) is as public as that IPv4.
 * Everything else, `::`, `::1`, `fc00::/7`, `fe80::/10` and multicast among
 * it, is not.
 */
export function isPublicIpv6(bytes: Ipv6): boolean {
  const embedded = (offset: number) =>
    isPublicIpv4(bytes.slice(offset, offset + 4) as Ipv4);

  // ::ffff:a.b.c.d, IPv4-mapped
  if (inPrefix(bytes, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xff], 96)) {
    return embedded(12);
  }
  // 64:ff9b::a.b.c.d, NAT64
  if (inPrefix(bytes, [0, 0x64, 0xff, 0x9b], 96)) return embedded(12);
  if (!inPrefix(bytes, [0x20], 3)) return false;
  // 2002:aabb:ccdd::, 6to4
  if (inPrefix(bytes, [0x20, 0x02], 16)) return embedded(2);
  if (inPrefix(bytes, [0x20, 0x01], 23)) return false; // Teredo, ORCHID, …
  if (inPrefix(bytes, [0x20, 0x01, 0x0d, 0xb8], 32)) return false; // docs
  if (inPrefix(bytes, [0x3f, 0xff], 20)) return false; // documentation
  return true;
}

/** Names that never leave the machine or its network. */
const LOCAL_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".intranet",
  ".lan",
  ".home",
  ".corp",
  ".home.arpa",
  ".in-addr.arpa",
  ".ip6.arpa",
  ".test",
  ".invalid",
];

export type HostKind =
  | { kind: "public-ip" }
  | { kind: "non-public" }
  | { kind: "name"; name: string };

/**
 * What a URL's hostname is: a public IP literal, something that is not
 * public (a private literal or a local name), or a name whose addresses still
 * have to be checked. Accepts `URL.hostname` as is, IPv6 brackets included.
 */
export function classifyHost(hostname: string): HostKind {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (host === "") return { kind: "non-public" };

  const v6 = parseIpv6(host);
  if (v6)
    return isPublicIpv6(v6) ? { kind: "public-ip" } : { kind: "non-public" };
  if (host.startsWith("[") || host.includes(":")) return { kind: "non-public" };

  const v4 = parseIpv4(host);
  if (v4)
    return isPublicIpv4(v4) ? { kind: "public-ip" } : { kind: "non-public" };

  // A single label resolves only through a local resolver or hosts file.
  if (!host.includes(".")) return { kind: "non-public" };
  if (LOCAL_SUFFIXES.some((suffix) => `.${host}`.endsWith(suffix))) {
    return { kind: "non-public" };
  }
  return { kind: "name", name: host };
}

/** Whether a resolved address (as DNS answers it) is public. */
export function isPublicAddress(address: string): boolean {
  if (STRICT_IPV4.test(address)) {
    return isPublicIpv4(parseIpv4(address) as Ipv4);
  }
  const v6 = parseIpv6(address);
  return v6 ? isPublicIpv6(v6) : false;
}
