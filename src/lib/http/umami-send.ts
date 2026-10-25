/**
 * The request the `/api/send` proxy forwards to Umami.
 *
 * Workers rewrite `cf-connecting-ip` on outbound requests, so Umami would
 * record the Worker's own address. Umami prefers `payload.ip` in the body over
 * any header, and with it set looks the location up from that IP instead of
 * the Worker's `cf-ipcountry`. The visitor's IP goes there; a body that is not
 * an Umami event passes through unchanged.
 */
export async function umamiSendRequest(
  request: Request,
  sendUrl: string,
): Promise<Request> {
  const ip = request.headers.get("cf-connecting-ip");
  if (request.method !== "POST" || !ip) return new Request(sendUrl, request);

  const text = await request.text();
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  return new Request(sendUrl, {
    method: "POST",
    headers,
    body: withPayloadIp(text, ip),
  });
}

function withPayloadIp(text: string, ip: string): string {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return text;
  }
  if (!isRecord(body) || !isRecord(body.payload)) return text;
  return JSON.stringify({ ...body, payload: { ...body.payload, ip } });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
