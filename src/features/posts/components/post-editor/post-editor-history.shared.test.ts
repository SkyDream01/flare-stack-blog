import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";
import { m } from "@/paraglide/messages";
import { restoreFailureOf, toDateOrNull } from "./post-editor-history.shared";

describe("restoreFailureOf", () => {
  it("names an Edit Conflict and marks it as one a restore can still override", () => {
    const failure = restoreFailureOf(
      new ORPCError("EDIT_CONFLICT", {
        status: 409,
        defined: true,
        data: { saveToken: "token-2" },
      }),
      7,
    );
    expect(failure).toEqual({
      revisionId: 7,
      editConflict: true,
      message: m.editor_history_error_edit_conflict(),
    });
  });

  it("names a taken link without offering to override it", () => {
    const failure = restoreFailureOf(
      new ORPCError("SLUG_TAKEN", { status: 409, defined: true }),
      7,
    );
    expect(failure.editConflict).toBe(false);
    expect(failure.message).toBe(m.editor_history_error_slug_taken());
  });

  it("falls back to the unknown error for anything else", () => {
    const failure = restoreFailureOf(new Error("network"), 7);
    expect(failure.editConflict).toBe(false);
    expect(failure.message).toBe(m.editor_action_unknown_error());
  });
});

describe("toDateOrNull", () => {
  it("returns null for empty values", () => {
    expect(toDateOrNull(null)).toBeNull();
    expect(toDateOrNull(undefined)).toBeNull();
    expect(toDateOrNull("")).toBeNull();
  });

  it("keeps a valid Date", () => {
    const date = new Date("2026-08-22T12:00:00.000Z");
    expect(toDateOrNull(date)?.toISOString()).toBe(date.toISOString());
  });

  it("parses an ISO string", () => {
    expect(toDateOrNull("2026-08-22T12:00:00.000Z")?.toISOString()).toBe(
      "2026-08-22T12:00:00.000Z",
    );
  });

  it("returns null for invalid input", () => {
    expect(toDateOrNull("not-a-date")).toBeNull();
    expect(toDateOrNull({})).toBeNull();
  });
});
