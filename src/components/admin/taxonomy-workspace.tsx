import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import {
  CategoryManager,
  type CategoryEdit,
} from "@/features/categories/components/category-manager";
import { categoriesAdminQueryOptions } from "@/features/categories/queries";
import {
  TagManager,
  type EditingTag,
} from "@/features/tags/components/tag-manager";
import { tagsWithCountAdminQueryOptions } from "@/features/tags/queries";
import { useDeletePost } from "@/features/posts/components/post-manager/hooks/use-posts";
import type { AdminPostListItem } from "@/features/posts/components/post-manager/types";
import { orpc } from "@/lib/orpc";
import { m } from "@/paraglide/messages";
import { useAdminChrome } from "./admin-chrome";
import { TaxonomyExplorer } from "./taxonomy-explorer";
import { TaxonomyPosts } from "./taxonomy-posts";
import type { TaxonomyState } from "./taxonomy-state";
import {
  buildTaxonomySelection,
  missingTaxonomySelection,
} from "./taxonomy-workspace.model";
import { useTaxonomySearch } from "./use-taxonomy-search";
import "@/features/posts/components/post-manager/post-manager.css";
import "./taxonomy.css";

export function TaxonomyWorkspace({
  state,
  onChange,
}: {
  state: TaxonomyState;
  onChange: (patch: Partial<TaxonomyState>, replace?: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { setPrimaryAction } = useAdminChrome();
  const categoriesQuery = useQuery({
    ...categoriesAdminQueryOptions(),
    refetchOnMount: "always",
  });
  const tagsQuery = useQuery({
    ...tagsWithCountAdminQueryOptions(),
    refetchOnMount: "always",
  });
  const selection = buildTaxonomySelection(
    state,
    categoriesQuery.data,
    tagsQuery.data,
    m.post_uncategorized(),
  );
  const { selected, tagMode } = selection;
  const pending = tagMode ? tagsQuery.isPending : categoriesQuery.isPending;
  const navError = tagMode ? tagsQuery.isError : categoriesQuery.isError;
  const navigationReady = !pending && !navError;
  const search = useTaxonomySearch(state.search, onChange);
  const [categoryEdit, setCategoryEdit] = useState<CategoryEdit | null>(null);
  const [tagEdit, setTagEdit] = useState<EditingTag | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [postToDelete, setPostToDelete] = useState<AdminPostListItem | null>(
    null,
  );
  const postDeleteTrigger = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (navigationReady && missingTaxonomySelection(state, selection))
      onChange({ id: undefined, page: 1, search: "" }, true);
  }, [navigationReady, state, selection, onChange]);

  const openCreate = useCallback(
    () =>
      setCategoryEdit({ id: null, name: "", postCount: 0, publicPostCount: 0 }),
    [],
  );
  useEffect(() => {
    setPrimaryAction({
      label: m.taxonomy_manager_create_category(),
      onClick: openCreate,
    });
    return () => setPrimaryAction(null);
  }, [setPrimaryAction, openCreate]);

  const choose = (kind: TaxonomyState["kind"], id?: number) =>
    search.changeContext({ kind, id, scope: "current" });
  const manage = () => {
    if (!selected || selected.kind === "uncategorized") return;
    if (selected.kind === "category") setCategoryEdit(selected);
    else setTagEdit(selected);
  };
  const invalidateCounts = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: orpc.categories.key() }),
      queryClient.invalidateQueries({ queryKey: orpc.tags.admin.key() }),
    ]);
  const deletePost = useDeletePost({
    onSuccess: () => {
      setPostToDelete(null);
      void invalidateCounts();
    },
  });
  const action =
    selected && selected.kind !== "uncategorized" ? (
      <button
        type="button"
        className="taxonomy-context-action"
        aria-label={
          selected.kind === "category"
            ? m.category_manager_rename()
            : m.tag_manager_edit()
        }
        aria-haspopup="dialog"
        onClick={manage}
      >
        <MoreHorizontal size={20} />
      </button>
    ) : null;

  return (
    <div className="taxonomy-workspace fuwari-card-base">
      <header className="taxonomy-heading">
        <div>
          <h1>{m.taxonomy_manager_title()}</h1>
          <p>{m.taxonomy_workspace_hint()}</p>
        </div>
        <button
          type="button"
          className="fuwari-btn-primary taxonomy-create"
          onClick={openCreate}
        >
          <Plus size={17} />
          {m.taxonomy_manager_create_category()}
        </button>
      </header>

      <div className="taxonomy-browser">
        <TaxonomyExplorer
          selection={selection}
          status={pending ? "pending" : navError ? "error" : "ready"}
          onRetry={() => {
            void (tagMode ? tagsQuery.refetch() : categoriesQuery.refetch());
          }}
          onChoose={choose}
          action={action}
        />
        <TaxonomyPosts
          state={state}
          selected={selected}
          navigationReady={navigationReady}
          onChange={onChange}
          search={search}
          action={action}
          focusTargets={{ search: searchRef, heading: headingRef }}
          onDelete={(target, trigger) => {
            postDeleteTrigger.current = trigger;
            setPostToDelete(target);
          }}
        />
      </div>
      <CategoryManager
        editing={categoryEdit}
        onClose={() => setCategoryEdit(null)}
        onCreated={(id) => choose("category", id)}
        fallbackFocus={() => searchRef.current ?? headingRef.current}
      />
      <TagManager
        editing={tagEdit}
        onClose={() => setTagEdit(null)}
        fallbackFocus={() => searchRef.current ?? headingRef.current}
      />
      <ConfirmationModal
        isOpen={postToDelete !== null}
        title={m.admin_posts_delete_confirm_title()}
        message={m.admin_posts_delete_confirm_desc({
          title: postToDelete?.title ?? "",
        })}
        confirmLabel={m.admin_posts_delete_confirm_btn()}
        isDanger
        isLoading={deletePost.isPending}
        onClose={() => setPostToDelete(null)}
        onConfirm={() => {
          if (postToDelete) deletePost.mutate(postToDelete);
        }}
        returnFocus={() =>
          postDeleteTrigger.current?.isConnected
            ? postDeleteTrigger.current
            : searchRef.current
        }
      />
    </div>
  );
}
