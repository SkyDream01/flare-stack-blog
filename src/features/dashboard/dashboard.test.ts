import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "@/features/config/config.schema";
import {
  adminEmailNeedsSetup,
  commentSnippet,
  popularityAlertFromStatus,
  popularityState,
  rankTopPosts,
  siteIdentityIsDefault,
  totalViews,
} from "./dashboard";

describe("popularityAlertFromStatus", () => {
  it("hides when Umami is not configured", () => {
    expect(
      popularityAlertFromStatus({
        configured: false,
        expired: true,
        lastError: "missing key",
      }),
    ).toBeNull();
  });

  it("hides when the snapshot is healthy", () => {
    expect(
      popularityAlertFromStatus({
        configured: true,
        expired: false,
        lastError: null,
      }),
    ).toBeNull();
  });

  it("prefers a failed sync over expiry", () => {
    expect(
      popularityAlertFromStatus({
        configured: true,
        expired: true,
        lastError: "umami 502",
      }),
    ).toBe("failed");
  });

  it("surfaces an expired snapshot", () => {
    expect(
      popularityAlertFromStatus({
        configured: true,
        expired: true,
        lastError: null,
      }),
    ).toBe("expired");
  });
});

describe("adminEmailNeedsSetup", () => {
  it("surfaces the default config", () => {
    expect(adminEmailNeedsSetup(DEFAULT_CONFIG)).toBe(true);
  });

  it("hides when admin email notifications are off", () => {
    expect(
      adminEmailNeedsSetup({
        ...DEFAULT_CONFIG,
        notification: {
          ...DEFAULT_CONFIG.notification,
          admin: { channels: { email: false } },
        },
      }),
    ).toBe(false);
  });

  it("hides when SMTP is complete", () => {
    expect(
      adminEmailNeedsSetup({
        ...DEFAULT_CONFIG,
        email: {
          host: "smtp.example.com",
          port: 465,
          username: "blog",
          password: "secret",
          senderAddress: "blog@example.com",
        },
      }),
    ).toBe(false);
  });
});

describe("siteIdentityIsDefault", () => {
  it("surfaces the shipped title or author", () => {
    expect(siteIdentityIsDefault(DEFAULT_CONFIG.site)).toBe(true);
    expect(
      siteIdentityIsDefault({ ...DEFAULT_CONFIG.site, title: "冷静的阿矿" }),
    ).toBe(true);
  });

  it("hides after both title and author change", () => {
    expect(
      siteIdentityIsDefault({
        ...DEFAULT_CONFIG.site,
        title: "冷静的阿矿",
        author: "阿矿",
      }),
    ).toBe(false);
  });
});

describe("commentSnippet", () => {
  it("collapses whitespace from plain text", () => {
    expect(commentSnippet("hello\n\n  world")).toBe("hello world");
  });

  it("truncates long text", () => {
    const snippet = commentSnippet("a".repeat(90), 80);
    expect(snippet.endsWith("…")).toBe(true);
    expect(snippet.length).toBe(81);
  });

  it("flattens leftover json comments", () => {
    expect(
      commentSnippet({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "感谢" }],
          },
        ],
      }),
    ).toBe("感谢");
  });
});

describe("popularityState", () => {
  it("says nothing without Umami, even with an old snapshot", () => {
    expect(popularityState({ configured: false, expired: false }, true)).toBe(
      "unconfigured",
    );
  });

  it("tells a missing snapshot from an expired one", () => {
    expect(popularityState({ configured: true, expired: false }, false)).toBe(
      "missing",
    );
    expect(popularityState({ configured: true, expired: true }, true)).toBe(
      "expired",
    );
    expect(popularityState({ configured: true, expired: false }, true)).toBe(
      "ready",
    );
  });
});

describe("rankTopPosts", () => {
  const entries = [
    { postId: 9, score: 50 },
    { postId: 3, score: 40 },
    { postId: 7, score: 30 },
    { postId: 1, score: 20 },
  ];

  it("keeps snapshot order and skips Posts that are no longer public", () => {
    const posts = [1, 3, 7].map((id) => ({ id, title: `post ${id}` }));
    expect(rankTopPosts(entries, posts, 2)).toEqual([
      { id: 3, title: "post 3", views: 40 },
      { id: 7, title: "post 7", views: 30 },
    ]);
  });

  it("sums every entry for the total", () => {
    expect(totalViews(entries)).toBe(140);
    expect(totalViews([])).toBe(0);
  });
});
