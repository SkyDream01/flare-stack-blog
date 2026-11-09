import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { JSONContent } from "@tiptap/react";
import { LogIn } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Turnstile, useTurnstile } from "@/components/common/turnstile";
import { Button } from "@/components/ui/button";
import { jsonCommentToPlainText } from "@/features/comments/comment-body";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { useComments } from "@/features/comments/hooks/use-comments";
import { rootCommentsInfiniteQuery } from "@/features/comments/queries";
import {
  createCommentInput,
  type CommentTarget,
} from "@/features/comments/comment-target";
import { useThemeCommentThread } from "@/features/theme/components/use-theme-comment-thread";
import { useSession } from "@/lib/auth/auth-client";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { CommentEditor } from "./comment-editor";
import { CommentList } from "./comment-list";
import { CommentSectionSkeleton } from "./comment-section-skeleton";

interface CommentSectionProps {
  target: CommentTarget;
  className?: string;
}

export const CommentSection = ({ target, className }: CommentSectionProps) => {
  const { data: session } = useSession();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery(rootCommentsInfiniteQuery(target));

  const listed = data?.pages.flatMap((page) => page.items) ?? [];
  const { rootComments, highlightCommentId, expandedRootId } =
    useThemeCommentThread(target, listed);
  const [locallyMuted, setLocallyMuted] = useState(false);
  const viewerMuted = locallyMuted || (data?.pages[0]?.viewerMuted ?? false);
  const totalCount = data?.pages[0]?.total ?? 0;

  const { createComment, deleteComment, isCreating, isDeleting } = useComments(
    target,
    { onMuted: () => setLocallyMuted(true) },
  );

  const [replyTarget, setReplyTarget] = useState<{
    rootId: number;
    commentId: number;
    userName: string;
  } | null>(null);

  const [commentToDelete, setCommentToDelete] = useState<number | null>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const {
    isPending: turnstilePending,
    reset: resetTurnstile,
    turnstileProps,
  } = useTurnstile("comment");

  const requireTurnstile = () => {
    if (!turnstilePending) return false;
    toast.error(m.comments_turnstile_required());
    turnstileRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    // Throw so CommentEditor's catch block fires and content is preserved
    throw new Error("TURNSTILE_PENDING");
  };

  const handleCreateComment = async (content: JSONContent) => {
    requireTurnstile();
    try {
      await createComment(
        createCommentInput(target, {
          content: jsonCommentToPlainText(content),
        }),
      );
    } finally {
      resetTurnstile();
    }
  };

  const handleCreateReply = async (content: JSONContent) => {
    if (!replyTarget) return;
    requireTurnstile();
    try {
      await createComment(
        createCommentInput(target, {
          content: jsonCommentToPlainText(content),
          rootId: replyTarget.rootId,
          replyToCommentId: replyTarget.commentId,
        }),
      );
      setReplyTarget(null);
    } finally {
      resetTurnstile();
    }
  };

  const handleDelete = async () => {
    if (commentToDelete) {
      await deleteComment({ id: commentToDelete });
      setCommentToDelete(null);
    }
  };

  useEffect(() => {
    setReplyTarget(null);
    setLocallyMuted(false);
  }, [target.type, target.id, session?.user.id]);

  if (isLoading || !data) {
    return <CommentSectionSkeleton className={className} />;
  }

  return (
    <section
      id="comments"
      className={cn(
        "space-y-12 mt-24 pt-12 border-t border-border/20 animate-in fade-in duration-700",
        className,
      )}
    >
      <header className="flex items-center justify-between">
        <div className="space-y-2">
          <p className="text-xl font-serif font-medium text-foreground">
            {m.comments_count({ count: totalCount })}
          </p>
        </div>
      </header>

      {/* Main Editor */}
      {viewerMuted ? (
        <p role="status" className="w-full text-sm text-muted-foreground">
          {m.comments_muted_message()}
        </p>
      ) : session ? (
        <div className="space-y-6">
          <CommentEditor
            onSubmit={handleCreateComment}
            isSubmitting={isCreating && !replyTarget}
          />
        </div>
      ) : (
        <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
          <p className="text-xs font-mono text-muted-foreground/60 tracking-wider">
            {m.comments_join_discussion()}
          </p>
          <Link to="/login">
            <Button
              variant="outline"
              className="h-10 px-6 text-[10px] uppercase tracking-[0.25em] font-bold border-border/40 bg-transparent hover:bg-foreground hover:text-background transition-all"
            >
              <LogIn size={12} className="mr-2.5 opacity-70" />
              {m.comments_login()}
            </Button>
          </Link>
        </div>
      )}

      <div ref={turnstileRef}>
        <Turnstile {...turnstileProps} />
      </div>

      {/* Comments List */}
      <CommentList
        rootComments={rootComments}
        target={target}
        onReply={
          viewerMuted
            ? undefined
            : (rootIdArg, commentId, userName) =>
                setReplyTarget({ rootId: rootIdArg, commentId, userName })
        }
        onDelete={(id) => setCommentToDelete(id)}
        replyTarget={viewerMuted ? null : replyTarget}
        onCancelReply={() => setReplyTarget(null)}
        onSubmitReply={handleCreateReply}
        isSubmittingReply={isCreating}
        initialExpandedRootId={expandedRootId}
        highlightCommentId={highlightCommentId}
      />

      {/* Load More Root Comments */}
      {hasNextPage && (
        <div className="flex justify-center pt-8">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="px-8 py-5 text-[10px] uppercase tracking-[0.2em] font-bold border-border hover:bg-foreground hover:text-background transition-all"
          >
            {isFetchingNextPage ? m.comments_loading() : m.comments_load_more()}
          </Button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!commentToDelete}
        onClose={() => setCommentToDelete(null)}
        onConfirm={handleDelete}
        title={m.comments_delete_title()}
        message={m.comments_delete_desc()}
        confirmLabel={m.comments_delete_confirm()}
        isDanger={true}
        isLoading={isDeleting}
      />
    </section>
  );
};
