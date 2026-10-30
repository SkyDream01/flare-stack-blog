import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { StatusPage } from "@/components/common/status-page";
import { buttonClass } from "@/components/ui/button";
import { PostEditor } from "@/features/posts/components/post-editor";
import { savePostEdits } from "@/features/posts/components/post-editor/post-editor.save";
import { PostEditorSkeleton } from "@/features/posts/components/post-editor/post-editor-skeleton";
import type { PostEditorSave } from "@/features/posts/components/post-editor/types";
import { postByIdQuery } from "@/features/posts/queries";
import { categoryOptionsQuery } from "@/features/categories/queries";
import {
  tagsAdminQueryOptions,
  tagsByPostIdQueryOptions,
} from "@/features/tags/queries";
import { orpc } from "@/lib/orpc";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/admin/posts/edit/$id/")({
  ssr: "data-only",
  component: EditPost,
  pendingComponent: PostEditorSkeleton,
  loader: async ({ context, params }) => {
    const postId = Number(params.id);
    const [post] = await Promise.all([
      context.queryClient.ensureQueryData(postByIdQuery(postId)),
      context.queryClient.ensureQueryData(tagsByPostIdQueryOptions(postId)),
      context.queryClient.prefetchQuery(tagsAdminQueryOptions()),
      context.queryClient.prefetchQuery(categoryOptionsQuery),
    ]);
    return { title: post?.title };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.title,
      },
    ],
  }),
});

function EditPost() {
  const { id } = Route.useParams();
  const postId = Number(id);
  const queryClient = useQueryClient();
  // Mounting the editor afresh is how it takes in the post as stored.
  const [loadCount, setLoadCount] = useState(0);

  const { data: post } = useQuery(postByIdQuery(postId));
  const { data: tags } = useQuery(tagsByPostIdQueryOptions(postId));

  if (!post || !tags) {
    return (
      <StatusPage
        title={m.admin_post_edit_not_found_title()}
        description={m.admin_post_edit_not_found_desc({ id: String(postId) })}
        action={
          <Link
            to="/admin/posts"
            className={buttonClass({ variant: "primary", size: "lg" })}
          >
            {m.common_back()}
          </Link>
        }
      />
    );
  }

  const initialData = {
    id: post.id,
    title: post.title,
    summary: post.summary ?? "",
    slug: post.slug,
    contentJson: post.contentJson ?? null,
    publishedAt: post.publishedAt,
    tagIds: tags.map((t) => t.id),
    categoryId: post.categoryId ?? null,
    hasPublicSnapshot: post.hasPublicSnapshot,
    publicSnapshotContentJson: post.publicSnapshotContentJson,
    serverToday: post.serverToday,
    coverMediaId: post.coverMediaId,
    cover: post.cover,
    saveToken: post.saveToken,
  };

  const savePost = savePostEdits(post.id);
  const handleSave: PostEditorSave = async (...args) => {
    const result = await savePost(...args);

    // Waited for, so the status shown follows the save instead of lagging it.
    await queryClient.invalidateQueries({
      queryKey: orpc.posts.admin.get.key({ input: { id: postId } }),
    });
    void queryClient.invalidateQueries({ queryKey: orpc.posts.list.key() });
    void queryClient.invalidateQueries({
      queryKey: orpc.posts.admin.list.key(),
    });
    void queryClient.invalidateQueries({ queryKey: orpc.tags.admin.key() });
    void queryClient.invalidateQueries({ queryKey: orpc.categories.key() });
    void queryClient.invalidateQueries({
      queryKey: orpc.media.linkedKeys.key(),
    });
    return result;
  };

  const handleReload = async () => {
    await Promise.all([
      queryClient.fetchQuery({ ...postByIdQuery(postId), staleTime: 0 }),
      queryClient.fetchQuery({
        ...tagsByPostIdQueryOptions(postId),
        staleTime: 0,
      }),
    ]);
    setLoadCount((count) => count + 1);
  };

  return (
    <PostEditor
      key={`${post.id}:${loadCount}`}
      initialData={initialData}
      publicSlug={post.publicSlug}
      hasUnpublishedChanges={post.hasUnpublishedChanges}
      onSave={handleSave}
      onReload={handleReload}
    />
  );
}
