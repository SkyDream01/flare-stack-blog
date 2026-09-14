import { Loader2, Search, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Select } from "@/components/ui/select";
import { m } from "@/paraglide/messages";
import type { TaxonomyState } from "./taxonomy-state";
import type {
  TaxonomyEntry,
  TaxonomySelection,
} from "./taxonomy-workspace.model";

export function TaxonomyExplorer({
  selection,
  status,
  onRetry,
  onChoose,
  action,
}: {
  selection: TaxonomySelection;
  status: "pending" | "error" | "ready";
  onRetry: () => void;
  onChoose: (kind: TaxonomyState["kind"], id?: number) => void;
  action: ReactNode;
}) {
  const { tagMode, items, selected, uncategorized } = selection;
  const [navSearch, setNavSearch] = useState("");
  const pending = status === "pending";
  const navError = status === "error";
  const visibleItems = items.filter(
    (item) =>
      !tagMode ||
      item.name.toLowerCase().includes(navSearch.trim().toLowerCase()),
  );
  const navRow = (item: TaxonomyEntry) => (
    <button
      key={`${item.kind}:${item.id}`}
      type="button"
      className="taxonomy-nav-item"
      aria-pressed={selected?.kind === item.kind && selected?.id === item.id}
      onClick={() => onChoose(item.kind, item.id ?? undefined)}
    >
      <span className="taxonomy-nav-name">{item.name}</span>
      <span className="taxonomy-nav-count">
        {item.postCount}
        {item.publicPostCount > 0 && item.postCount === 0 ? (
          <small>
            {m.taxonomy_public_short({ count: item.publicPostCount })}
          </small>
        ) : null}
      </span>
    </button>
  );

  return (
    <aside
      className="taxonomy-explorer"
      aria-label={m.taxonomy_manager_title()}
    >
      <div
        className="taxonomy-mode-tabs"
        role="group"
        aria-label={m.taxonomy_manager_title()}
      >
        <button
          type="button"
          aria-pressed={!tagMode}
          onClick={() => {
            setNavSearch("");
            onChoose("category");
          }}
        >
          {m.category_manager_title()}
        </button>
        <button
          type="button"
          aria-pressed={tagMode}
          onClick={() => onChoose("tag")}
        >
          {m.tag_manager_title()}
        </button>
      </div>
      {tagMode ? (
        <div className="taxonomy-search taxonomy-nav-search">
          <Search size={15} />
          <input
            aria-label={m.tag_manager_search_placeholder()}
            placeholder={m.tag_manager_search_placeholder()}
            value={navSearch}
            onChange={(event) => setNavSearch(event.target.value)}
          />
          {navSearch ? (
            <button
              type="button"
              aria-label={m.tag_manager_clear_search()}
              onClick={() => setNavSearch("")}
            >
              <X size={14} />
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="taxonomy-nav-scroll custom-scrollbar">
        {pending ? (
          <div className="taxonomy-loading">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : navError ? (
          <div className="taxonomy-empty" role="alert">
            <p>{m.error_desc()}</p>
            <button type="button" onClick={onRetry}>
              {m.error_retry()}
            </button>
          </div>
        ) : (
          <>
            {visibleItems.map(navRow)}
            {tagMode && visibleItems.length === 0 ? (
              <p className="taxonomy-nav-empty">
                {items.length
                  ? m.tag_manager_no_match()
                  : m.tag_manager_empty()}
              </p>
            ) : null}
            {!tagMode ? (
              <div className="taxonomy-uncategorized">
                {navRow(uncategorized)}
              </div>
            ) : null}
          </>
        )}
      </div>
      <div className="taxonomy-mobile-picker">
        <Select
          value={
            selected?.kind === "uncategorized"
              ? "uncategorized"
              : String(selected?.id ?? "")
          }
          options={[
            ...visibleItems.map((item) => ({
              value: String(item.id),
              label: `${item.name} · ${item.postCount}`,
            })),
            ...(!tagMode
              ? [
                  {
                    value: "uncategorized",
                    label: `${uncategorized.name} · ${uncategorized.postCount}`,
                  },
                ]
              : []),
          ]}
          onChange={(value) =>
            value === "uncategorized"
              ? onChoose("uncategorized")
              : onChoose(tagMode ? "tag" : "category", Number(value))
          }
          disabled={pending || navError}
        />
        {action}
      </div>
    </aside>
  );
}
