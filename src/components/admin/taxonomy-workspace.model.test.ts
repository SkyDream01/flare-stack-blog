import { describe, expect, it } from "vitest";
import { taxonomySearchSchema } from "./taxonomy-state";
import {
  buildTaxonomySelection,
  missingTaxonomySelection,
  taxonomyFilterForSelection,
  taxonomyPageCount,
} from "./taxonomy-workspace.model";

const initialState = taxonomySearchSchema.parse({});
const categories = {
  items: [
    {
      id: 9,
      name: "Travel",
      postCount: 4,
      publicPostCount: 2,
      createdAt: new Date("2026-01-01"),
    },
    { id: 1, name: "Notes", postCount: 0, publicPostCount: 3 },
  ],
  uncategorizedPostCount: 7,
  uncategorizedPublicPostCount: 5,
};
const tags = [
  { id: 1, name: "TypeScript", postCount: 2, publicPostCount: 0 },
  { id: 9, name: "Workers", postCount: 1, publicPostCount: 4 },
];

describe("taxonomy selection", () => {
  it("uses Uncategorized for empty Categories and no selection for empty Tags", () => {
    const categorySelection = buildTaxonomySelection(
      initialState,
      undefined,
      undefined,
      "未分类",
    );
    expect(categorySelection.items).toEqual([]);
    expect(categorySelection.selected).toEqual({
      kind: "uncategorized",
      id: null,
      name: "未分类",
      postCount: 0,
      publicPostCount: 0,
    });
    expect(missingTaxonomySelection(initialState, categorySelection)).toBe(
      false,
    );

    const tagState = { ...initialState, kind: "tag" as const };
    const tagSelection = buildTaxonomySelection(
      tagState,
      categories,
      [],
      "未分类",
    );
    expect(tagSelection.tagMode).toBe(true);
    expect(tagSelection.selected).toBeUndefined();
    expect(missingTaxonomySelection(tagState, tagSelection)).toBe(false);
    expect(
      taxonomyFilterForSelection(tagSelection.selected, "current"),
    ).toBeUndefined();
  });

  it.each(["category", "tag"] as const)(
    "defaults to the first supplied %s only when no explicit ID exists",
    (kind) => {
      const state = { ...initialState, kind };
      const selection = buildTaxonomySelection(
        state,
        categories,
        tags,
        "Uncategorized",
      );
      const first = kind === "tag" ? tags[0] : categories.items[0];
      expect(selection.selected).toEqual({ ...first, kind });
      expect(first).not.toHaveProperty("kind");
      expect(missingTaxonomySelection(state, selection)).toBe(false);

      const missingState = { ...state, id: 404 };
      const missing = buildTaxonomySelection(
        missingState,
        categories,
        tags,
        "Uncategorized",
      );
      expect(missing.selected).toBeUndefined();
      expect(missingTaxonomySelection(missingState, missing)).toBe(true);
    },
  );

  it.each(["current", "public"] as const)(
    "keeps overlapping Category and Tag IDs distinct in %s scope",
    (scope) => {
      for (const kind of ["category", "tag"] as const) {
        const state = { ...initialState, kind, id: 9, scope };
        const selection = buildTaxonomySelection(
          state,
          categories,
          tags,
          "Uncategorized",
        );
        const expected = kind === "category" ? categories.items[0] : tags[1];
        expect(selection.selected).toEqual({ ...expected, kind });
        expect(taxonomyFilterForSelection(selection.selected, scope)).toEqual({
          kind,
          id: 9,
          scope,
        });
        expect(missingTaxonomySelection(state, selection)).toBe(false);
      }
    },
  );

  it("does not turn Uncategorized into an entity even when an ID is present", () => {
    const state = { ...initialState, kind: "uncategorized" as const, id: 9 };
    const selection = buildTaxonomySelection(
      state,
      categories,
      tags,
      "Uncategorized",
    );
    expect(selection.selected).toEqual({
      kind: "uncategorized",
      id: null,
      name: "Uncategorized",
      postCount: 7,
      publicPostCount: 5,
    });
    expect(missingTaxonomySelection(state, selection)).toBe(false);
    for (const scope of ["current", "public"] as const) {
      expect(taxonomyFilterForSelection(selection.selected, scope)).toEqual({
        kind: "uncategorized",
        scope,
      });
    }
  });
});

it.each([
  [0, 1],
  [1, 1],
  [12, 1],
  [13, 2],
  [24, 2],
  [25, 3],
])("shows %i Posts across %i pages", (total, expectedPages) => {
  expect(taxonomyPageCount(total)).toBe(expectedPages);
});
