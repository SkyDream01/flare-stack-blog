import type { AdminTaxonomyFilter } from "@/features/posts/schema/posts.schema";
import type { TaxonomyState } from "./taxonomy-state";

type EntryCounts = {
  name: string;
  postCount: number;
  publicPostCount: number;
};

type CountedItem = EntryCounts & { id: number };
type NamedEntry = CountedItem & { kind: "category" | "tag" };
type UncategorizedEntry = EntryCounts & { kind: "uncategorized"; id: null };

export type TaxonomyEntry = NamedEntry | UncategorizedEntry;

export type TaxonomySelection = {
  tagMode: boolean;
  items: NamedEntry[];
  uncategorized: UncategorizedEntry;
  selected: TaxonomyEntry | undefined;
};

export function buildTaxonomySelection(
  state: TaxonomyState,
  categories:
    | {
        items: CountedItem[];
        uncategorizedPostCount: number;
        uncategorizedPublicPostCount: number;
      }
    | undefined,
  tags: CountedItem[] | undefined,
  uncategorizedName: string,
): TaxonomySelection {
  const tagMode = state.kind === "tag";
  const items: NamedEntry[] = tagMode
    ? (tags ?? []).map((item) => ({ ...item, kind: "tag" }))
    : (categories?.items ?? []).map((item) => ({ ...item, kind: "category" }));
  const uncategorized: UncategorizedEntry = {
    kind: "uncategorized",
    id: null,
    name: uncategorizedName,
    postCount: categories?.uncategorizedPostCount ?? 0,
    publicPostCount: categories?.uncategorizedPublicPostCount ?? 0,
  };
  const selected =
    state.kind === "uncategorized"
      ? uncategorized
      : state.id
        ? items.find((item) => item.id === state.id)
        : (items[0] ?? (!tagMode ? uncategorized : undefined));

  return { tagMode, items, uncategorized, selected };
}

export function taxonomyFilterForSelection(
  selected: TaxonomyEntry | undefined,
  scope: TaxonomyState["scope"],
): AdminTaxonomyFilter | undefined {
  if (!selected) return undefined;
  return selected.kind === "uncategorized"
    ? { kind: "uncategorized", scope }
    : { kind: selected.kind, id: selected.id, scope };
}

export function missingTaxonomySelection(
  state: TaxonomyState,
  selection: TaxonomySelection,
): boolean {
  return Boolean(
    state.id &&
    state.kind !== "uncategorized" &&
    !selection.items.some((item) => item.id === state.id),
  );
}

export const TAXONOMY_PAGE_SIZE = 12;

export function taxonomyPageCount(total: number): number {
  return Math.max(1, Math.ceil(total / TAXONOMY_PAGE_SIZE));
}
