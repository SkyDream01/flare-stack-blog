import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BookOpen, Hash, Loader2, Search, X } from "lucide-react";
import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import DropdownMenu from "@/components/ui/dropdown-menu";
import { PostRow } from "@/features/posts/components/post-manager/components/post-row";
import { PostManagerSkeleton } from "@/features/posts/components/post-manager/post-manager-skeleton";
import type {
  AdminPostListItem,
  SortField,
} from "@/features/posts/components/post-manager/types";
import { adminPostsQuery } from "@/features/posts/queries";
import { useContentMotion } from "@/hooks/use-motion";
import { m } from "@/paraglide/messages";
import { AdminPagination } from "./admin-pagination";
import type { TaxonomyReturn, TaxonomyState } from "./taxonomy-state";
import {
  TAXONOMY_PAGE_SIZE,
  taxonomyFilterForSelection,
  taxonomyPageCount,
  type TaxonomyEntry,
} from "./taxonomy-workspace.model";
import { useTaxonomyScroll } from "./use-taxonomy-scroll";
import type { useTaxonomySearch } from "./use-taxonomy-search";

type StateChange = (patch: Partial<TaxonomyState>, replace?: boolean) => void;
type DeletePost = (
  post: AdminPostListItem,
  trigger: HTMLButtonElement | null,
) => void;
type SearchControl = ReturnType<typeof useTaxonomySearch>;
type PostsQuery = Pick<
  UseQueryResult<{ items: AdminPostListItem[]; total: number }>,
  "data" | "isPending" | "isError" | "isFetching" | "refetch"
>;

export function TaxonomyPosts({
  state,
  selected,
  navigationReady,
  onChange,
  search,
  action,
  focusTargets,
  onDelete,
}: {
  state: TaxonomyState;
  selected: TaxonomyEntry | undefined;
  navigationReady: boolean;
  onChange: StateChange;
  search: SearchControl;
  action: ReactNode;
  focusTargets: {
    search: RefObject<HTMLInputElement | null>;
    heading: RefObject<HTMLHeadingElement | null>;
  };
  onDelete: DeletePost;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<HTMLTableSectionElement>(null);
  const taxonomy = taxonomyFilterForSelection(selected, state.scope);
  const postsQuery = useQuery({
    ...adminPostsQuery({
      taxonomy,
      search: state.search,
      sortBy: state.sortBy,
      sortDir: "DESC",
      limit: TAXONOMY_PAGE_SIZE,
      offset: (state.page - 1) * TAXONOMY_PAGE_SIZE,
    }),
    enabled: !!selected && navigationReady,
    refetchOnMount: "always",
  });
  const posts = postsQuery.data?.items ?? [];
  const total = postsQuery.data?.total ?? 0;
  const totalPages = taxonomyPageCount(total);
  const queryKey = JSON.stringify([
    taxonomy,
    state.search,
    state.sortBy,
    state.page,
  ]);
  useContentMotion(
    rowsRef,
    `${queryKey}:${posts.map((post) => post.id).join(",")}`,
  );
  const getScrollTop = useTaxonomyScroll(
    scrollRef,
    queryKey,
    postsQuery.isSuccess,
  );
  useEffect(() => {
    if (selected && postsQuery.isSuccess && state.page > totalPages)
      onChange({ page: totalPages }, true);
  }, [selected, postsQuery.isSuccess, state.page, totalPages, onChange]);

  const returnState = (): { taxonomyReturn: TaxonomyReturn } => ({
    taxonomyReturn: {
      search: {
        ...state,
        kind: selected?.kind ?? state.kind,
        id: selected?.id ?? undefined,
      },
      scrollTop: getScrollTop(),
    },
  });

  return (
    <section className="taxonomy-results">
      <header className="taxonomy-selection-heading">
        <h2 ref={focusTargets.heading} tabIndex={-1}>
          {selected?.name ??
            (state.kind === "tag"
              ? m.tag_manager_title()
              : m.category_manager_title())}
        </h2>
        {action}
      </header>
      <TaxonomyPostControls
        state={state}
        selected={selected}
        search={search}
        isFetching={postsQuery.isFetching}
        onChange={onChange}
        searchRef={focusTargets.search}
      />
      <TaxonomyPostList
        state={state}
        selected={selected}
        query={postsQuery}
        scrollRef={scrollRef}
        rowsRef={rowsRef}
        editorState={returnState}
        onDelete={onDelete}
        onClearSearch={() => search.changeContext({})}
      />
      {selected && !postsQuery.isPending && !postsQuery.isError ? (
        <footer className="taxonomy-post-footer">
          {totalPages > 1 ? (
            <AdminPagination
              currentPage={state.page}
              totalPages={totalPages}
              totalItems={total}
              itemsPerPage={TAXONOMY_PAGE_SIZE}
              currentPageItemCount={posts.length}
              onPageChange={(page) => onChange({ page })}
            />
          ) : (
            <span>
              {state.search
                ? m.admin_posts_results({ count: total })
                : m.admin_posts_total({ count: total })}
            </span>
          )}
        </footer>
      ) : null}
    </section>
  );
}

function TaxonomyPostControls({
  state,
  selected,
  search,
  isFetching,
  onChange,
  searchRef,
}: {
  state: TaxonomyState;
  selected: TaxonomyEntry | undefined;
  search: SearchControl;
  isFetching: boolean;
  onChange: StateChange;
  searchRef: RefObject<HTMLInputElement | null>;
}) {
  return (
    <>
      <div
        className="taxonomy-scope-tabs"
        role="group"
        aria-label={m.taxonomy_usage_summary({
          current: selected?.postCount ?? 0,
          public: selected?.publicPostCount ?? 0,
        })}
      >
        <button
          type="button"
          disabled={!selected}
          aria-pressed={state.scope === "current"}
          onClick={() => search.changeContext({ scope: "current" })}
        >
          {m.taxonomy_scope_current()} <span>{selected?.postCount ?? "—"}</span>
        </button>
        <button
          type="button"
          disabled={!selected}
          aria-pressed={state.scope === "public"}
          onClick={() => search.changeContext({ scope: "public" })}
        >
          {m.taxonomy_scope_public()}{" "}
          <span>{selected?.publicPostCount ?? "—"}</span>
        </button>
        {isFetching ? <Loader2 size={14} className="animate-spin" /> : null}
      </div>
      <p className="taxonomy-scope-hint">
        {state.scope === "current"
          ? m.taxonomy_scope_current_hint()
          : m.taxonomy_scope_public_hint()}
      </p>
      <div className="taxonomy-post-controls">
        <div className="taxonomy-search">
          <Search size={17} />
          <input
            ref={searchRef}
            type="search"
            aria-label={m.taxonomy_posts_search()}
            placeholder={m.taxonomy_posts_search()}
            value={search.value}
            disabled={!selected}
            onChange={(event) => search.update(event.target.value)}
          />
          {search.value ? (
            <button
              type="button"
              aria-label={m.admin_posts_clear_search()}
              onClick={() => search.changeContext({})}
            >
              <X size={15} />
            </button>
          ) : null}
        </div>
        <div className="taxonomy-sort">
          <span>{m.admin_posts_sort_label()}</span>
          <DropdownMenu
            value={state.sortBy}
            ariaLabel={m.admin_posts_sort_label()}
            triggerClassName="taxonomy-sort-trigger"
            options={[
              {
                value: "updatedAt",
                label: m.admin_posts_sort_recent_upd(),
              },
              {
                value: "publishedAt",
                label: m.admin_posts_sort_recent_pub(),
              },
            ]}
            onChange={(value) =>
              onChange({ sortBy: value as SortField, page: 1 })
            }
          />
        </div>
      </div>
    </>
  );
}

function TaxonomyPostList({
  state,
  selected,
  query,
  scrollRef,
  rowsRef,
  editorState,
  onDelete,
  onClearSearch,
}: {
  state: TaxonomyState;
  selected: TaxonomyEntry | undefined;
  query: PostsQuery;
  scrollRef: RefObject<HTMLDivElement | null>;
  rowsRef: RefObject<HTMLTableSectionElement | null>;
  editorState: () => { taxonomyReturn: TaxonomyReturn };
  onDelete: DeletePost;
  onClearSearch: () => void;
}) {
  const posts = query.data?.items ?? [];
  return (
    <div
      ref={scrollRef}
      className="taxonomy-post-scroll custom-scrollbar"
      role="region"
      aria-label={selected?.name ?? m.taxonomy_manager_title()}
      tabIndex={0}
      aria-busy={query.isFetching}
    >
      {!selected ? (
        <div className="taxonomy-empty">
          <Hash size={28} />
          <p>{m.taxonomy_empty_selection()}</p>
        </div>
      ) : query.isError ? (
        <div className="taxonomy-empty" role="alert">
          <p>{m.error_desc()}</p>
          <button type="button" onClick={() => void query.refetch()}>
            {m.error_retry()}
          </button>
        </div>
      ) : (
        <>
          <table className="post-list-table">
            <colgroup>
              <col className="post-list-title-col" />
              <col className="post-list-status-col" />
              <col className="post-list-date-col" />
              <col className="post-list-actions-col" />
            </colgroup>
            <thead>
              <tr>
                <th>{m.admin_posts_col_title()}</th>
                <th>{m.admin_posts_col_status()}</th>
                <th>
                  {state.sortBy === "updatedAt"
                    ? m.admin_posts_sort_recent_upd()
                    : m.admin_posts_sort_recent_pub()}
                </th>
                <th>{m.admin_posts_col_actions()}</th>
              </tr>
            </thead>
            <tbody ref={rowsRef}>
              {query.isPending ? (
                <PostManagerSkeleton />
              ) : (
                posts.map((post) => (
                  <PostRow
                    key={post.id}
                    post={post}
                    sortBy={state.sortBy}
                    editorState={editorState}
                    onDelete={onDelete}
                  />
                ))
              )}
            </tbody>
          </table>
          {!query.isPending && posts.length === 0 ? (
            <div className="taxonomy-empty">
              <BookOpen size={26} />
              <p>
                {state.search
                  ? m.admin_posts_no_match()
                  : state.scope === "current"
                    ? m.taxonomy_current_empty()
                    : m.taxonomy_public_empty()}
              </p>
              {state.search ? (
                <button type="button" onClick={onClearSearch}>
                  {m.admin_posts_clear_filters()}
                </button>
              ) : (
                <Link to="/admin/posts">{m.admin_posts_title()}</Link>
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
