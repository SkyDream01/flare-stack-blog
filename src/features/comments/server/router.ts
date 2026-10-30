import { lazy } from "@orpc/server";
import {
  CommentSelectSchema,
  CreateCommentInputSchema,
  DeleteCommentInputSchema,
  GetCommentsByPostIdInputSchema,
  GetMyCommentsInputSchema,
  GetRepliesByRootIdInputSchema,
  GetRepliesResponseSchema,
  GetRootCommentsResponseSchema,
  GetThreadByCommentIdInputSchema,
  RootCommentWithReplyCountSchema,
} from "@/features/comments/comments.schema";
import { z } from "zod";
import * as CommentService from "@/features/comments/comments.service";
import {
  authProcedure,
  optionalSessionProcedure,
  rateLimitErrors,
  turnstileErrors,
  turnstileMiddleware,
  withRateLimit,
} from "@/lib/orpc/procedure";
import { unwrapResult } from "@/lib/orpc/unwrap-result";
import { commentErrors } from "./errors";

const roots = optionalSessionProcedure
  .route({
    method: "GET",
    path: "/posts/{postId}/comments",
    summary: "List root comments on a post",
    description:
      "Returns visible root threads with reply previews. Offset and limit paginate root threads, including deleted roots that still have published replies. Total counts all published roots and replies on the post, excluding deleted placeholders; it must not be used to calculate root pagination.",
    tags: ["Comments"],
  })
  .input(GetCommentsByPostIdInputSchema)
  .output(GetRootCommentsResponseSchema)
  .handler(({ context, input }) =>
    CommentService.getRootCommentsByPostId(context, input),
  );

const replies = optionalSessionProcedure
  .route({
    method: "GET",
    path: "/posts/{postId}/comments/{rootId}/replies",
    summary: "List replies in a comment thread",
    tags: ["Comments"],
  })
  .input(GetRepliesByRootIdInputSchema)
  .output(GetRepliesResponseSchema)
  .handler(({ context, input }) =>
    CommentService.getRepliesByRootId(context, input),
  );

const thread = optionalSessionProcedure
  .errors({ COMMENT_NOT_FOUND: commentErrors.COMMENT_NOT_FOUND })
  .route({
    method: "GET",
    path: "/posts/{postId}/comments/{id}/thread",
    summary: "Load the visible comment thread containing a comment",
    tags: ["Comments"],
  })
  .input(GetThreadByCommentIdInputSchema)
  .output(RootCommentWithReplyCountSchema)
  .handler(({ context, input, errors }) =>
    unwrapResult(CommentService.getThreadByCommentId(context, input), {
      COMMENT_NOT_FOUND: () => {
        throw errors.COMMENT_NOT_FOUND();
      },
    }),
  );

const create = authProcedure
  .errors({ ...rateLimitErrors, ...turnstileErrors })
  .use(withRateLimit({ capacity: 10, interval: "1m", key: "comments:create" }))
  .use(turnstileMiddleware)
  .errors(commentErrors)
  .route({
    method: "POST",
    path: "/posts/{postId}/comments",
    summary: "Create a comment",
    tags: ["Comments"],
  })
  .input(CreateCommentInputSchema)
  .handler(({ context, input, errors }) =>
    unwrapResult(CommentService.createComment(context, input), {
      ROOT_COMMENT_NOT_FOUND: () => {
        throw errors.ROOT_COMMENT_NOT_FOUND();
      },
      INVALID_ROOT_ID: () => {
        throw errors.INVALID_ROOT_ID();
      },
      ROOT_COMMENT_POST_MISMATCH: () => {
        throw errors.ROOT_COMMENT_POST_MISMATCH();
      },
      REPLY_TO_COMMENT_NOT_FOUND: () => {
        throw errors.REPLY_TO_COMMENT_NOT_FOUND();
      },
      REPLY_TO_COMMENT_ROOT_MISMATCH: () => {
        throw errors.REPLY_TO_COMMENT_ROOT_MISMATCH();
      },
      ROOT_COMMENT_CANNOT_HAVE_REPLY_TO: () => {
        throw errors.ROOT_COMMENT_CANNOT_HAVE_REPLY_TO();
      },
      POST_NOT_FOUND: () => {
        throw errors.POST_NOT_FOUND();
      },
      POST_NOT_PUBLISHED: () => {
        throw errors.POST_NOT_PUBLISHED();
      },
      USER_MUTED: () => {
        throw errors.USER_MUTED();
      },
      NAME_REQUIRED: () => {
        throw errors.NAME_REQUIRED();
      },
    }),
  );

const remove = authProcedure
  .errors(rateLimitErrors)
  .use(withRateLimit({ capacity: 10, interval: "1m", key: "comments:delete" }))
  .errors(commentErrors)
  .route({
    method: "DELETE",
    path: "/comments/{id}",
    summary: "Delete own comment",
    tags: ["Comments"],
  })
  .input(DeleteCommentInputSchema)
  .handler(({ context, input, errors }) =>
    unwrapResult(CommentService.deleteComment(context, input), {
      COMMENT_NOT_FOUND: () => {
        throw errors.COMMENT_NOT_FOUND();
      },
      PERMISSION_DENIED: () => {
        throw errors.FORBIDDEN();
      },
    }),
  );

const mine = authProcedure
  .route({
    method: "GET",
    path: "/me/comments",
    summary: "List the current user's comments",
    tags: ["Comments"],
  })
  .input(GetMyCommentsInputSchema)
  .output(z.array(CommentSelectSchema))
  .handler(({ context, input }) =>
    CommentService.getMyComments(context, input),
  );

export default {
  roots,
  replies,
  thread,
  create,
  remove,
  mine,
  // Loaded on the first request under the prefix; public calls never load it.
  admin: lazy(() => import("./admin-router"), { prefix: "/admin/comments" }),
};
