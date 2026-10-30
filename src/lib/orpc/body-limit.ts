import { ORPCError } from "@orpc/client";

/**
 * Largest JSON request body. A Post's body is stored in one D1 row, which
 * holds 2 MB at most, so a larger body could only fail later as a 500.
 */
export const JSON_BODY_LIMIT_BYTES = 2 * 1024 * 1024;

/** Multipart bodies carry a file; this leaves room for its form fields. */
export const FORM_BODY_OVERHEAD_BYTES = 1024 * 1024;

/** The 413 an oversized body is answered with. */
export function payloadTooLargeResponse(limit: number) {
  return Response.json(
    new ORPCError("PAYLOAD_TOO_LARGE", {
      message: `The request body is larger than the ${limit} bytes this operation takes.`,
    }).toJSON(),
    { status: 413 },
  );
}

/**
 * Reads the body of `request` up to `limit` bytes. Returns the request again
 * with the body in memory, or null when the body is larger: stopped as soon
 * as Content-Length says so, or as soon as the bytes read pass the limit.
 */
export async function readBodyWithin(
  request: Request,
  limit: number,
): Promise<Request | null> {
  if (!request.body) return request;
  if (Number(request.headers.get("content-length")) > limit) {
    await request.body.cancel().catch(() => undefined);
    return null;
  }
  const reader = request.body.getReader();
  const chunks: Array<Uint8Array> = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.length;
    if (received > limit) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }
  return new Request(request, { method: request.method, body });
}

/** The body limit of a request: a file upload may carry a file. */
export function bodyLimitOf(request: Request, maxFileBytes: number) {
  const contentType = request.headers.get("content-type") ?? "";
  return contentType.startsWith("multipart/form-data")
    ? maxFileBytes + FORM_BODY_OVERHEAD_BYTES
    : JSON_BODY_LIMIT_BYTES;
}
