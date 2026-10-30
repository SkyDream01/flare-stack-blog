import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { COMMENT_STATUSES, CommentsTable } from "@/lib/db/schema";
import { PageOffsetSchema, pageLimitSchema } from "@/lib/orpc/pagination";
import { coercedDate } from "@/lib/orpc/dates";
import { PathIdSchema } from "@/lib/orpc/path-ids";

/** A Comment as public APIs return it; when an Admin handled it stays private. */
export const CommentSelectSchema = createSelectSchema(CommentsTable, {
  createdAt: coercedDate,
  updatedAt: coercedDate,
}).omit({ handledAt: true });

// User info schema for joined queries
const CommentUserSchema = z.object({
  id: z.string().nullable(),
  name: z.string().nullable(),
  image: z.string().nullable(),
  role: z.string().nullable(),
  mutedAt: coercedDate.nullable(),
});

const CommentWithUserSchema = CommentSelectSchema.extend({
  user: CommentUserSchema.nullable(),
  post: z
    .object({
      title: z.string().optional().nullable(),
      slug: z.string().optional().nullable(),
    })
    .nullable()
    .optional(),
  replyToUser: z
    .object({
      id: z.string().optional().nullable(),
      name: z.string().optional().nullable(),
    })
    .nullable()
    .optional(),
});

// Public API Schemas
export const GetCommentsByPostIdInputSchema = z.object({
  postId: PathIdSchema,
  offset: PageOffsetSchema.optional(),
  limit: pageLimitSchema(100).optional(),
});

export const GetRepliesByRootIdInputSchema = z.object({
  postId: PathIdSchema,
  rootId: PathIdSchema,
  offset: PageOffsetSchema.optional(),
  limit: pageLimitSchema(100).optional(),
});

const ReplyWithUserAndReplyToSchema = CommentWithUserSchema.extend({
  replyTo: z
    .object({
      id: z.string().nullable(),
      name: z.string().nullable(),
    })
    .nullable(),
});

export const GetRepliesResponseSchema = z.object({
  items: z.array(ReplyWithUserAndReplyToSchema),
  total: z.number(),
});

export const RootCommentWithReplyCountSchema = CommentWithUserSchema.extend({
  replyCount: z.number(),
  replies: z.array(ReplyWithUserAndReplyToSchema),
});

export const GetRootCommentsResponseSchema = z.object({
  items: z.array(RootCommentWithReplyCountSchema),
  total: z
    .number()
    .describe(
      "Total published comments on this post, including roots and replies but excluding deleted placeholders. This is not the number of paginated root threads.",
    ),
  viewerMuted: z.boolean(),
});

// Authed User API Schemas
const CommentBodySchema = z.string().trim().min(1);

export const CreateCommentInputSchema = z.object({
  postId: PathIdSchema,
  content: CommentBodySchema,
  rootId: z.number().optional(),
  replyToCommentId: z.number().optional(),
});

export const DeleteCommentInputSchema = z.object({
  id: PathIdSchema,
});

export const GetThreadByCommentIdInputSchema = z.object({
  postId: PathIdSchema,
  id: PathIdSchema,
});

export const GetMyCommentsInputSchema = z.object({
  offset: PageOffsetSchema.optional(),
  limit: pageLimitSchema(100).optional(),
  status: z.enum(COMMENT_STATUSES).optional(),
});

// Admin API Schemas
export const CommentHandledInputSchema = z.strictObject({
  id: PathIdSchema,
});

export const CommentsHandledCountSchema = z.object({
  count: z.number().int().nonnegative(),
});

// Types
export type GetCommentsByPostIdInput = z.infer<
  typeof GetCommentsByPostIdInputSchema
>;
export type CreateCommentInput = z.infer<typeof CreateCommentInputSchema>;
export type DeleteCommentInput = z.infer<typeof DeleteCommentInputSchema>;
export type GetMyCommentsInput = z.infer<typeof GetMyCommentsInputSchema>;
export type RootCommentWithReplyCount = z.infer<
  typeof RootCommentWithReplyCountSchema
>;
export type CommentWithUser = z.infer<typeof CommentWithUserSchema>;
