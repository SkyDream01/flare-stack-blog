import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyWorkersCachePolicy } from "@/features/cache/workers-cache-policy";
import { handleImageRequest } from "./service/media.service";

/**
 * What /images/{key} answers. In production the image route hands the
 * request to handleImageRequest, and App.fetch runs the Workers cache policy
 * over the response before Workers Caching stores it, so a cached copy
 * replays exactly these headers.
 */
async function serve(key: string, url: string) {
  const request = new Request(url, { headers: { Accept: "image/webp" } });
  const response = await handleImageRequest(env, key, request);
  return applyWorkersCachePolicy(request, response);
}

/** The source URL the image transform was asked to read. */
function transformSource(
  transform: { mock: { calls: Array<Array<unknown>> } },
  call: number,
) {
  const input = transform.mock.calls[call]?.[0];
  if (!(input instanceof Request)) throw new Error(`No transform call ${call}`);
  return input.url;
}

const SCRIPTED_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.cookie)</script></svg>';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("serving /images/{key}", () => {
  it("serves an SVG as a sandboxed document that cannot run script", async () => {
    await env.R2.put("drawing.svg", SCRIPTED_SVG, {
      httpMetadata: { contentType: "image/svg+xml" },
    });

    const response = await serve(
      "drawing.svg",
      "http://localhost:3000/images/drawing.svg",
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/svg+xml");
    const csp = response.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toMatch(/(^|;\s*)sandbox(;|$)/);
    expect(csp).toContain("default-src 'none'");
    expect(csp).not.toMatch(/script-src/);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Cache-Tag")).toBe("media:drawing.svg");
  });

  it("sends the same headers on a transformed image", async () => {
    await env.R2.put("photo.png", "png bytes", {
      httpMetadata: { contentType: "image/png" },
    });
    const stored = await env.R2.head("photo.png");
    const transform = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response("webp bytes", {
          headers: { "Content-Type": "image/webp" },
        }),
    );
    vi.stubGlobal("fetch", transform);

    const response = await serve(
      "photo.png",
      "https://blog.example/images/photo.png?quality=80&width=800",
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Security-Policy")).toMatch(/sandbox/);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Cache-Tag")).toBe("media:photo.png");
    // The address outlives a replaced file, so browsers revalidate it.
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=0, must-revalidate",
    );
    expect(response.headers.get("ETag")).toContain(stored!.etag);

    // The transform reads the stored file's version, so a replaced file is
    // never answered from a transform of the old one.
    const source = new URL(transformSource(transform, 0));
    expect(source.pathname).toBe("/images/photo.png");
    expect(source.searchParams.get("original")).toBe("true");
    expect(source.searchParams.get("v")).toBe(stored!.etag);
  });

  it("transforms a replaced file from its new version", async () => {
    const transform = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response("webp bytes"),
    );
    vi.stubGlobal("fetch", transform);
    const sourceVersion = (call: number) =>
      new URL(transformSource(transform, call)).searchParams.get("v");

    await env.R2.put("swap.png", "first", {
      httpMetadata: { contentType: "image/png" },
    });
    await serve("swap.png", "https://blog.example/images/swap.png?width=800");
    await env.R2.put("swap.png", "second", {
      httpMetadata: { contentType: "image/png" },
    });
    await serve("swap.png", "https://blog.example/images/swap.png?width=800");

    expect(sourceVersion(0)).not.toBe(sourceVersion(1));
  });
});
