import { classifyHost, isPublicAddress } from "@/lib/http/public-address";
import { err, ok } from "@/lib/errors";

/*
 * A GET of an address someone else chose, made only when every hop of it is
 * on the public internet.
 *
 * Workers cannot resolve a name or pin the address `fetch()` connects to, so
 * names are resolved over DNS-over-HTTPS (Cloudflare's 1.1.1.1, the resolver
 * Cloudflare's edge uses too) and refused when any A or AAAA answer is not
 * public. Redirects are followed by hand, each hop checked the same way.
 *
 * Limits: `fetch()` resolves the name again on its own, so a name whose
 * answers change between the two lookups (DNS rebinding with a short TTL)
 * can still reach a private address. Deployed Workers sit on Cloudflare's
 * network, which has no route into the deployment's own LAN and does not
 * fetch IP literals at all, so the private addresses that matter most are
 * those of a machine running workerd itself: local development and
 * self-hosting. There the check is what stands between the fetch and them.
 */

const DOH_ENDPOINT = "https://cloudflare-dns.com/dns-query";
const MAX_REDIRECTS = 5;
const DNS_TYPE = { A: 1, AAAA: 28 } as const;
const DNS_NOERROR = 0;
const DNS_NXDOMAIN = 3;

export type PublicFetchError =
  /** The address, or one it redirects to, is not on the public internet. */
  | { reason: "NOT_PUBLIC"; url: string }
  /** The address could not be checked or fetched. */
  | { reason: "UNREACHABLE" };

/**
 * What `checkPublicUrl` answers: also a name public DNS has no address for,
 * which only a private resolver, such as an intranet's, can know.
 */
export type PublicUrlCheck = PublicFetchError | { reason: "NO_ADDRESS" };

type Resolution =
  | { kind: "addresses"; addresses: Array<string> }
  | { kind: "unresolved" };

async function resolveType(
  name: string,
  type: keyof typeof DNS_TYPE,
  signal: AbortSignal,
): Promise<Resolution> {
  const query = new URL(DOH_ENDPOINT);
  query.searchParams.set("name", name);
  query.searchParams.set("type", type);
  const response = await fetch(query, {
    headers: { accept: "application/dns-json" },
    signal,
  });
  if (!response.ok) return { kind: "unresolved" };
  const body = (await response.json()) as {
    Status?: number;
    Answer?: Array<{ type?: number; data?: string }>;
  };
  if (body.Status === DNS_NXDOMAIN) return { kind: "addresses", addresses: [] };
  if (body.Status !== DNS_NOERROR) return { kind: "unresolved" };
  return {
    kind: "addresses",
    addresses: (body.Answer ?? [])
      .filter((answer) => answer.type === DNS_TYPE[type])
      .map((answer) => String(answer.data ?? "")),
  };
}

/**
 * Whether `url` may be fetched: http(s), and a host that is a public address
 * or a name all of whose addresses are public. A name without addresses is
 * refused too. Null when it may; the error otherwise.
 */
export async function checkPublicUrl(
  url: URL,
  signal: AbortSignal,
): Promise<PublicUrlCheck | null> {
  const notPublic = { reason: "NOT_PUBLIC", url: url.href } as const;
  if (url.protocol !== "http:" && url.protocol !== "https:") return notPublic;
  if (url.username || url.password) return notPublic;

  const host = classifyHost(url.hostname);
  if (host.kind === "public-ip") return null;
  if (host.kind === "non-public") return notPublic;

  let answers: Array<Resolution>;
  try {
    answers = await Promise.all([
      resolveType(host.name, "A", signal),
      resolveType(host.name, "AAAA", signal),
    ]);
  } catch {
    return { reason: "UNREACHABLE" };
  }
  const addresses: Array<string> = [];
  for (const answer of answers) {
    if (answer.kind === "unresolved") return { reason: "UNREACHABLE" };
    addresses.push(...answer.addresses);
  }
  if (addresses.length === 0) return { reason: "NO_ADDRESS" };
  return addresses.every(isPublicAddress) ? null : notPublic;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * GETs `url`, following up to five redirects, when it and every address it
 * redirects to pass `checkPublicUrl`. The final response is returned
 * whatever its status. A start address public DNS has no address for cannot
 * be reached; a redirect to one points into a private network, so it is
 * refused as not public.
 */
export async function fetchPublicUrl(
  url: URL,
  options: { signal: AbortSignal },
) {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const refused = await checkPublicUrl(current, options.signal);
    if (refused?.reason === "NO_ADDRESS") {
      return hop === 0
        ? err({ reason: "UNREACHABLE" } as const)
        : err({ reason: "NOT_PUBLIC", url: current.href } as const);
    }
    if (refused) return err(refused);

    let response: Response;
    try {
      response = await fetch(current, {
        redirect: "manual",
        signal: options.signal,
      });
    } catch {
      return err({ reason: "UNREACHABLE" } as const);
    }
    if (!REDIRECT_STATUSES.has(response.status)) return ok(response);

    await response.body?.cancel();
    const location = response.headers.get("location");
    if (!location) return err({ reason: "UNREACHABLE" } as const);
    try {
      current = new URL(location, current);
    } catch {
      return err({ reason: "UNREACHABLE" } as const);
    }
  }
  return err({ reason: "UNREACHABLE" } as const);
}
