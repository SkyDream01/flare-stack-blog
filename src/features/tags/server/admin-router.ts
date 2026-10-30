import { z } from "zod";
import { EditConflictDataSchema } from "@/features/posts/schema/posts.schema";
import {
  AdminTagWithCountSchema,
  CreateTagInputSchema,
  DeleteTagInputSchema,
  DeleteTagResultSchema,
  GetTagsByPostIdInputSchema,
  GetTagsInputSchema,
  SetPostTagsInputSchema,
  SetPostTagsResultSchema,
  TagListItemSchema,
  TagSelectSchema,
  UpdateTagInputSchema,
} from "@/features/tags/tags.schema";
import * as TagService from "@/features/tags/tags.service";
import { adminProcedure } from "@/lib/orpc/procedure";
import { unwrapResult } from "@/lib/orpc/unwrap-result";

const tagErrors = {
  TAG_NOT_FOUND: { status: 404, message: "Tag not found." },
  TAG_NAME_ALREADY_EXISTS: { status: 409, message: "Tag name already exists." },
} as const;

const postNotFoundErrors = {
  POST_NOT_FOUND: { status: 404, message: "Post not found." },
} as const;

const editConflictErrors = {
  EDIT_CONFLICT: {
    status: 409,
    message: "The post was saved since the stated saveToken was read.",
    data: EditConflictDataSchema,
  },
} as const;

const adminList = adminProcedure
  .route({
    method: "GET",
    path: "/admin/tags",
    summary: "List tags for admin",
    tags: ["Admin Tags"],
  })
  .input(GetTagsInputSchema)
  .output(z.array(TagListItemSchema))
  .handler(({ context, input }) => TagService.getTags(context, input));

const adminListWithCount = adminProcedure
  .route({
    method: "GET",
    path: "/admin/tags/with-count",
    summary: "List tags with post counts",
    tags: ["Admin Tags"],
  })
  .input(GetTagsInputSchema)
  .output(z.array(AdminTagWithCountSchema))
  .handler(({ context, input }) => TagService.getTagsWithCount(context, input));

const create = adminProcedure
  .errors({ TAG_NAME_ALREADY_EXISTS: tagErrors.TAG_NAME_ALREADY_EXISTS })
  .route({
    method: "POST",
    path: "/admin/tags",
    summary: "Create a tag",
    tags: ["Admin Tags"],
  })
  .input(CreateTagInputSchema)
  .output(TagSelectSchema)
  .handler(({ context, input, errors }) =>
    unwrapResult(TagService.createTag(context, input), {
      TAG_NAME_ALREADY_EXISTS: () => {
        throw errors.TAG_NAME_ALREADY_EXISTS();
      },
    }),
  );

const update = adminProcedure
  .errors(tagErrors)
  .route({
    method: "PATCH",
    path: "/admin/tags/{id}",
    summary: "Update a tag",
    tags: ["Admin Tags"],
  })
  .input(UpdateTagInputSchema)
  .output(TagSelectSchema)
  .handler(({ context, input, errors }) =>
    unwrapResult(TagService.updateTag(context, input), {
      TAG_NOT_FOUND: () => {
        throw errors.TAG_NOT_FOUND();
      },
      TAG_NAME_ALREADY_EXISTS: () => {
        throw errors.TAG_NAME_ALREADY_EXISTS();
      },
    }),
  );

const remove = adminProcedure
  .errors({ TAG_NOT_FOUND: tagErrors.TAG_NOT_FOUND })
  .route({
    method: "DELETE",
    path: "/admin/tags/{id}",
    summary: "Delete a tag",
    tags: ["Admin Tags"],
  })
  .input(DeleteTagInputSchema)
  .output(DeleteTagResultSchema)
  .handler(({ context, input, errors }) =>
    unwrapResult(TagService.deleteTag(context, input), {
      TAG_NOT_FOUND: () => {
        throw errors.TAG_NOT_FOUND();
      },
    }),
  );

const setPostTags = adminProcedure
  .errors({
    ...postNotFoundErrors,
    TAG_NOT_FOUND: tagErrors.TAG_NOT_FOUND,
    ...editConflictErrors,
  })
  .route({
    method: "PUT",
    path: "/admin/posts/{postId}/tags",
    summary: "Set tags on a post",
    description:
      "Replaces the post's draft tags; the public site shows them once the post is published. Like every write to a post, it replaces the post's saveToken and the response carries the new one, except that setting the tags the post already has writes nothing and answers its current saveToken. A post that does not exist answers 404 POST_NOT_FOUND, and a tag id no tag has answers 404 TAG_NOT_FOUND; either way nothing is written. With saveToken, the write happens only if the post was not saved since that token was read; otherwise it answers 409 EDIT_CONFLICT, writes nothing, and data.saveToken is the current token. Without it, the write is unconditional.",
    // Listed with the Post operations too: it writes a Post's draft, and
    // updating a Post takes no tags.
    tags: ["Admin Tags", "Admin Posts"],
  })
  .input(SetPostTagsInputSchema)
  .output(SetPostTagsResultSchema)
  .handler(({ context, input, errors }) =>
    unwrapResult(TagService.setPostTags(context, input), {
      POST_NOT_FOUND: () => {
        throw errors.POST_NOT_FOUND();
      },
      TAG_NOT_FOUND: () => {
        throw errors.TAG_NOT_FOUND();
      },
      EDIT_CONFLICT: ({ saveToken }) => {
        throw errors.EDIT_CONFLICT({ data: { saveToken } });
      },
    }),
  );

const byPostId = adminProcedure
  .errors(postNotFoundErrors)
  .route({
    method: "GET",
    path: "/admin/posts/{postId}/tags",
    summary: "List tags for a post",
    description:
      "Lists the tags the post's draft carries. A post that does not exist answers 404 POST_NOT_FOUND; a post without tags answers an empty list.",
    tags: ["Admin Tags"],
  })
  .input(GetTagsByPostIdInputSchema)
  .output(z.array(TagSelectSchema))
  .handler(({ context, input, errors }) =>
    unwrapResult(TagService.getTagsByPostId(context, input), {
      POST_NOT_FOUND: () => {
        throw errors.POST_NOT_FOUND();
      },
    }),
  );

export default {
  list: adminList,
  listWithCount: adminListWithCount,
  create,
  update,
  remove,
  setPostTags,
  byPostId,
};
