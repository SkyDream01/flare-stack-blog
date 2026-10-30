import { describe, expect, it } from "vitest";
import { calculateDraftFingerprint } from "./sync";
import {
  hasUnpublishedChanges,
  needsFingerprints,
} from "./unpublished-changes";

const draft = {
  title: "Title",
  contentJson: { type: "doc", content: [] },
  summary: null,
  tagIds: [3, 12],
  slug: "title",
  publishedAt: new Date("2026-10-01T08:00:00.000Z"),
  coverMediaId: null,
  categoryId: 4,
};

describe("calculateDraftFingerprint", () => {
  it("does not depend on tag order or on the date's milliseconds", async () => {
    const same = await calculateDraftFingerprint({
      ...draft,
      tagIds: [12, 3],
      publishedAt: new Date("2026-10-01T08:00:00.789Z"),
    });
    expect(same).toBe(await calculateDraftFingerprint(draft));
  });

  it.each([
    ["title", { title: "Other" }],
    ["summary", { summary: "Summary" }],
    ["slug", { slug: "other" }],
    ["content", { contentJson: { type: "doc", content: [{ type: "hr" }] } }],
    ["publication date", { publishedAt: new Date("2026-10-02T08:00:00Z") }],
    ["cover", { coverMediaId: 9 }],
    ["category", { categoryId: null }],
    ["tags", { tagIds: [3] }],
  ])("changes with the %s", async (_name, change) => {
    expect(await calculateDraftFingerprint({ ...draft, ...change })).not.toBe(
      await calculateDraftFingerprint(draft),
    );
  });
});

describe("hasUnpublishedChanges", () => {
  it("compares the fingerprints of a published post only", () => {
    expect(
      hasUnpublishedChanges({
        status: "published",
        draftFingerprint: "a",
        publishedFingerprint: "b",
      }),
    ).toBe(true);
    expect(
      hasUnpublishedChanges({
        status: "published",
        draftFingerprint: "a",
        publishedFingerprint: "a",
      }),
    ).toBe(false);
    expect(
      hasUnpublishedChanges({
        status: "draft",
        draftFingerprint: "a",
        publishedFingerprint: null,
      }),
    ).toBe(false);
  });

  it("asks a published post with a null fingerprint to be settled", () => {
    expect(
      needsFingerprints({
        status: "published",
        draftFingerprint: null,
        publishedFingerprint: "a",
      }),
    ).toBe(true);
    expect(
      needsFingerprints({
        status: "draft",
        draftFingerprint: null,
        publishedFingerprint: null,
      }),
    ).toBe(false);
  });
});
