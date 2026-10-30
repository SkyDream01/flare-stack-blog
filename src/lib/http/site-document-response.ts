import { CACHE_CONTROL } from "@/lib/constants";

export function siteDocumentResponse(
  body: BodyInit | null,
  contentType: string,
  cacheControl: string,
  method: string,
) {
  return new Response(method === "HEAD" ? null : body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": cacheControl,
      "CDN-Cache-Control": CACHE_CONTROL.html["CDN-Cache-Control"],
    },
  });
}
