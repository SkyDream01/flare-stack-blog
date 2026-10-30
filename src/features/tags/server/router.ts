import { lazy } from "@orpc/server";
import * as TagService from "@/features/tags/tags.service";
import { publicProcedure } from "@/lib/orpc/procedure";

const list = publicProcedure
  .route({
    method: "GET",
    path: "/tags",
    summary: "List public tags",
    tags: ["Tags"],
  })
  .handler(({ context }) => TagService.getPublicTags(context));

export default {
  list,
  // Loaded on the first request under the prefix; public calls never load it.
  // Tagging a Post lives under /admin/posts, hence the broader prefix.
  admin: lazy(() => import("./admin-router"), { prefix: "/admin" }),
};
