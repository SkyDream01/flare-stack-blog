import { describe, expect, it } from "vitest";
import { POST_REVISION_REASONS } from "@/lib/db/schema";
import {
  PostRevisionListItemSchema,
  PostRevisionSelectSchema,
} from "@/features/posts/schema/post-revisions.schema";

// The OpenAPI document is the only place an agent learns what a revision's
// reason means, so every stored value must be explained there.

describe("Post Revision reason", () => {
  it.each([
    ["the revision list", PostRevisionListItemSchema],
    ["a single revision", PostRevisionSelectSchema],
  ])("describes every value in %s", (_name, schema) => {
    const description = schema.shape.reason.description ?? "";
    for (const reason of POST_REVISION_REASONS) {
      expect(description).toContain(`${reason}:`);
    }
  });
});
