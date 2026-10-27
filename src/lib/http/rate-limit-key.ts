/**
 * Turns the `cf-connecting-ip` header into a rate-limit key. IPv6 clients
 * control a whole /64, so every address in it must share one bucket.
 */
export function rateLimitKeyFromIp(header: string | null | undefined) {
  const raw = header?.trim().toLowerCase();
  if (!raw) return "unknown";

  const address = raw.split("%")[0] ?? raw;
  if (!address.includes(":")) return address;

  const groups = parseIpv6(address);
  if (!groups) return address;

  const isMapped =
    groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;
  if (isMapped) {
    const high = groups[6]!;
    const low = groups[7]!;
    return [high >> 8, high & 0xff, low >> 8, low & 0xff].join(".");
  }

  const prefix = groups.slice(0, 4).map((group) => group.toString(16));
  return `${prefix.join(":")}::/64`;
}

function parseIpv6(address: string) {
  let text = address;
  const lastColon = text.lastIndexOf(":");
  const tail = text.slice(lastColon + 1);
  if (tail.includes(".")) {
    const octets = tail.split(".").map(Number);
    const valid =
      octets.length === 4 &&
      octets.every(
        (octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255,
      );
    if (!valid) return null;
    const high = ((octets[0]! << 8) | octets[1]!).toString(16);
    const low = ((octets[2]! << 8) | octets[3]!).toString(16);
    text = `${text.slice(0, lastColon + 1)}${high}:${low}`;
  }

  const halves = text.split("::");
  if (halves.length > 2) return null;
  const split = (part: string) => (part === "" ? [] : part.split(":"));
  const head = split(halves[0]!);
  const rest = halves.length === 2 ? split(halves[1]!) : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;

  const filler = halves.length === 2 ? Array<string>(missing).fill("0") : [];
  const numbers = [...head, ...filler, ...rest].map((group) =>
    /^[0-9a-f]{1,4}$/.test(group) ? Number.parseInt(group, 16) : Number.NaN,
  );
  return numbers.some(Number.isNaN) ? null : numbers;
}
