import { lazy } from "@orpc/server";
import { CategoryWithCountSchema } from "@/features/categories/categories.schema";
import * as CategoryService from "@/features/categories/categories.service";
import { z } from "zod";
import { publicProcedure } from "@/lib/orpc/procedure";

const list = publicProcedure
  .route({
    method: "GET",
    path: "/categories",
    summary: "List public categories",
    description:
      "The categories of published posts, ordered by name. postCount counts published posts only.",
    tags: ["Categories"],
  })
  .output(z.array(CategoryWithCountSchema))
  .handler(({ context }) => CategoryService.getPublicCategories(context));

export default {
  list,
  // Loaded on the first request under the prefix; public calls never load it.
  admin: lazy(() => import("./admin-router"), { prefix: "/admin/categories" }),
};
