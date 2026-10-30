import { describe, expect, it } from "vitest";
import { CACHE_CONTROL } from "@/lib/constants";
import { siteDocumentResponse } from "./site-document-response";

describe("siteDocumentResponse", () => {
  it("keeps the browser lifetime and gives the edge the HTML lifetime", () => {
    const response = siteDocumentResponse(
      "<rss />",
      "application/rss+xml; charset=utf-8",
      "public, max-age=3600, s-maxage=3600",
      "GET",
    );
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=3600, s-maxage=3600",
    );
    expect(response.headers.get("CDN-Cache-Control")).toBe(
      CACHE_CONTROL.html["CDN-Cache-Control"],
    );
  });

  it("sends no body for HEAD", async () => {
    const response = siteDocumentResponse("<rss />", "text/plain", "x", "HEAD");
    expect(await response.text()).toBe("");
  });
});
