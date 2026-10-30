import { orpc } from "@/lib/orpc";
import { emptyListOnNotFound } from "@/lib/orpc/null-on-not-found";
import type { GetTagsInput } from "../tags.schema";

export const tagsQueryOptions = orpc.tags.list.queryOptions();

export function tagsAdminQueryOptions(options: GetTagsInput = {}) {
  return orpc.tags.admin.list.queryOptions({
    input: options,
    staleTime: Infinity,
  });
}

/** Resolves to no tags for a post that does not exist (the server answers 404). */
export function tagsByPostIdQueryOptions(postId: number) {
  return emptyListOnNotFound(
    orpc.tags.admin.byPostId.queryOptions({ input: { postId } }),
    "POST_NOT_FOUND",
  );
}

export function tagsWithCountAdminQueryOptions(options: GetTagsInput = {}) {
  return orpc.tags.admin.listWithCount.queryOptions({
    input: { sortBy: "postCount", sortDir: "desc", ...options },
  });
}
