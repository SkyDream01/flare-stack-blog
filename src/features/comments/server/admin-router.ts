import { z } from "zod";
import {
  CommentHandledInputSchema,
  CommentsHandledCountSchema,
} from "@/features/comments/comments.schema";
import * as CommentService from "@/features/comments/comments.service";
import { adminProcedure } from "@/lib/orpc/procedure";
import { unwrapResult } from "@/lib/orpc/unwrap-result";
import { commentErrors } from "./errors";

const markHandled = adminProcedure
  .errors({ COMMENT_NOT_FOUND: commentErrors.COMMENT_NOT_FOUND })
  .route({
    method: "PUT",
    path: "/admin/comments/{id}/handled",
    summary: "Mark a comment handled",
    description:
      "Takes the Comment off the dashboard's unreplied list without replying. An Admin reply marks the Comment it answers handled too.",
    tags: ["Admin Comments"],
  })
  .input(CommentHandledInputSchema)
  .output(z.object({ success: z.boolean() }))
  .handler(({ context, input, errors }) =>
    unwrapResult(CommentService.markCommentHandled(context, input), {
      COMMENT_NOT_FOUND: () => {
        throw errors.COMMENT_NOT_FOUND();
      },
    }),
  );

const unmarkHandled = adminProcedure
  .errors({ COMMENT_NOT_FOUND: commentErrors.COMMENT_NOT_FOUND })
  .route({
    method: "DELETE",
    path: "/admin/comments/{id}/handled",
    summary: "Unmark a handled comment",
    description:
      "Undoes marking the Comment handled. It returns to the unreplied list unless an Admin Comment still answers it.",
    tags: ["Admin Comments"],
  })
  .input(CommentHandledInputSchema)
  .output(z.object({ success: z.boolean() }))
  .handler(({ context, input, errors }) =>
    unwrapResult(CommentService.unmarkCommentHandled(context, input), {
      COMMENT_NOT_FOUND: () => {
        throw errors.COMMENT_NOT_FOUND();
      },
    }),
  );

const markAllHandled = adminProcedure
  .route({
    method: "POST",
    path: "/admin/comments/handled",
    summary: "Mark all unreplied comments handled",
    description:
      "Marks every Comment on the dashboard's unreplied list handled and returns how many it marked.",
    tags: ["Admin Comments"],
  })
  .output(CommentsHandledCountSchema)
  .handler(({ context }) =>
    CommentService.markAllUnrepliedCommentsHandled(context),
  );

export default {
  markHandled,
  unmarkHandled,
  markAllHandled,
};
