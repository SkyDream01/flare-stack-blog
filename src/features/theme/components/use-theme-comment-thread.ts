import { useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import type { CommentTarget } from "@/features/comments/comment-target";
import type { RootCommentWithReplyCount } from "@/features/comments/comments.schema";
import { useScrollToComment } from "@/features/comments/hooks/use-scroll-to-comment";
import { commentThreadQuery } from "@/features/comments/queries";
import { m } from "@/paraglide/messages";

/** Resolve notification links in every theme, including threads beyond the first page. */
export function useThemeCommentThread(
  target: CommentTarget,
  listed: RootCommentWithReplyCount[],
) {
  const commentId = useSearch({
    strict: false,
    select: (search) => (search as { comment?: number }).comment,
  });
  const query = useQuery({
    ...commentThreadQuery(target, commentId ?? 0),
    enabled: commentId != null,
  });
  useScrollToComment(query.isSuccess ? commentId : undefined);
  useEffect(() => {
    if (query.isError) toast.error(m.comments_locate_failed());
  }, [query.isError]);

  const thread = query.data;
  return {
    rootComments:
      thread && !listed.some((root) => root.id === thread.id)
        ? [...listed, thread]
        : listed,
    highlightCommentId: commentId,
    expandedRootId: thread?.id,
  };
}
