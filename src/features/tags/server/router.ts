import { lazy } from "@orpc/server";
import * as TagService from "@/features/tags/tags.service";
import { TagWithCountSchema } from "@/features/tags/tags.schema";
import { z } from "zod";
import { publicProcedure } from "@/lib/orpc/procedure";

const list = publicProcedure
  .route({
    method: "GET",
    path: "/tags",
    summary: "List public tags",
    description:
      "The tags of published posts, most used first. postCount counts published posts only.",
    tags: ["Tags"],
  })
  .output(z.array(TagWithCountSchema))
  .handler(({ context }) => TagService.getPublicTags(context));

export default {
  list,
  // Loaded on the first request under the prefix; public calls never load it.
  // Tagging a Post lives under /admin/posts, hence the broader prefix.
  admin: lazy(() => import("./admin-router"), { prefix: "/admin" }),
};
