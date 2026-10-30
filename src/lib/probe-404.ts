import { ROUTED_FIRST_SEGMENTS } from "virtual:routed-first-segments";
import { CACHE_CONTROL } from "@/lib/constants";

// First path segments the app routes come from the generated route tree
// (`scripts/vite-routed-segments.ts`), lowercased because the router is case
// insensitive. `_serverfn` is handled by TanStack Start itself, not by a file
// route.
export const FRAMEWORK_FIRST_SEGMENTS = ["_serverfn"] as const;

const KNOWN = new Set<string>([
  ...ROUTED_FIRST_SEGMENTS,
  ...FRAMEWORK_FIRST_SEGMENTS,
]);

/**
 * Whether the app can route this path. Scanners probe `/.env`, `/wp-admin/`
 * and the like, which would otherwise render the themed 404 inside the full
 * public layout. Static assets that exist are served before the Worker runs,
 * so `/assets/...` reaching here is a missing file and is unknown too.
 *
 * Leading slashes are skipped (`//x` is judged by `x`), so a doubled slash on a
 * real route still gets the router's normalizing redirect. The segment is
 * percent-decoded first, like the router does, and a malformed escape is
 * unknown. `/` and `//` are the index route.
 */
export function isRoutedPath(pathname: string): boolean {
  let start = 0;
  while (pathname.charCodeAt(start) === 47) start++;
  if (start >= pathname.length) return true;
  let end = pathname.indexOf("/", start);
  if (end === -1) end = pathname.length;
  let segment = pathname.slice(start, end);
  try {
    segment = decodeURIComponent(segment);
  } catch {
    return false;
  }
  return KNOWN.has(segment.toLowerCase());
}

const NOT_FOUND_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="color-scheme" content="light dark"><title>404 Not Found</title><style>body{font:16px/1.5 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0}main{text-align:center}h1{margin:0 0 .5em;font-size:1.25em}</style></head><body><main><h1>404 · Not Found / 页面不存在</h1><a href="/">Home / 返回首页</a></main></body></html>`;

/** A bare 404 for paths the app has no route for; HEAD gets no body. */
export function probeNotFoundResponse(request: Request): Response {
  return new Response(request.method === "HEAD" ? null : NOT_FOUND_HTML, {
    status: 404,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...CACHE_CONTROL.private,
    },
  });
}
