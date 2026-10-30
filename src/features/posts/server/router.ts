import { lazy } from "@orpc/server";
import { z } from "zod";
import {
  HomePostsInputSchema,
  HomePostsResponseSchema,
  AdjacentPostsSchema,
  FindPostBySlugInputSchema,
  GetPostsCursorInputSchema,
  PostItemSchema,
  PostListResponseSchema,
  PostWithTocSchema,
} from "@/features/posts/schema/posts.schema";
import * as PostService from "@/features/posts/services/posts.service";
import { postPopularityService } from "@/features/post-popularity/service/post-popularity.service";
import { publicProcedure } from "@/lib/orpc/procedure";

const list = publicProcedure
  .route({
    method: "GET",
    path: "/posts",
    summary: "List published posts",
    tags: ["Posts"],
  })
  .input(GetPostsCursorInputSchema)
  .output(PostListResponseSchema)
  .handler(async ({ context, input }) => {
    const result = await PostService.getPostsCursor(context, input);
    return {
      ...result,
      items: await postPopularityService.attachViewCounts(
        context,
        result.items,
      ),
    };
  });

const home = publicProcedure
  .route({
    method: "GET",
    path: "/posts/home/page",
    summary: "List homepage posts, pinned first",
    tags: ["Posts"],
  })
  .input(HomePostsInputSchema)
  .output(HomePostsResponseSchema)
  .handler(async ({ context, input }) => {
    const result = await PostService.getHomePosts(context, input.page);
    return {
      ...result,
      items: await postPopularityService.attachViewCounts(
        context,
        result.items,
      ),
    };
  });

const bySlug = publicProcedure
  .errors({
    POST_NOT_FOUND: { status: 404, message: "Post not found." },
  })
  .route({
    method: "GET",
    path: "/posts/{slug}",
    summary: "Get a published post by slug",
    description:
      "Returns the published post, or answers 404 POST_NOT_FOUND when no published post has that slug. A draft, or a post that was unpublished, has none.",
    tags: ["Posts"],
  })
  .input(FindPostBySlugInputSchema)
  .output(PostWithTocSchema)
  .handler(async ({ context, input, errors }) => {
    const post = await PostService.findPostBySlug(context, input);
    if (!post) throw errors.POST_NOT_FOUND();
    return post;
  });

const adjacent = publicProcedure
  .route({
    method: "GET",
    path: "/posts/{slug}/adjacent",
    summary: "Get the adjacent published posts by publication date",
    tags: ["Posts"],
  })
  .input(FindPostBySlugInputSchema)
  .output(AdjacentPostsSchema)
  .handler(({ context, input }) =>
    PostService.getAdjacentPosts(context, input),
  );

const pinned = publicProcedure
  .route({
    method: "GET",
    path: "/posts/pinned",
    summary: "List pinned published posts",
    tags: ["Posts"],
  })
  .output(z.array(PostItemSchema))
  .handler(async ({ context }) =>
    postPopularityService.attachViewCounts(
      context,
      await PostService.getPinnedPosts(context),
    ),
  );

const popular = publicProcedure
  .route({
    method: "GET",
    path: "/posts/popular",
    summary: "List popular published posts",
    tags: ["Posts"],
  })
  .input(z.object({ limit: z.number().int().min(1).max(20).optional() }))
  .output(z.array(PostItemSchema))
  .handler(({ context, input }) =>
    postPopularityService.getPopular(context, input.limit),
  );

export default {
  list,
  home,
  bySlug,
  adjacent,
  pinned,
  popular,
  // Loaded on the first request under the prefix; public calls never load it.
  admin: lazy(() => import("./admin-router"), { prefix: "/admin/posts" }),
};
