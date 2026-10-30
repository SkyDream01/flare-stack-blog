import { lazy } from "@orpc/server";
import * as CategoryService from "@/features/categories/categories.service";
import { publicProcedure } from "@/lib/orpc/procedure";

const list = publicProcedure
  .route({
    method: "GET",
    path: "/categories",
    summary: "List public categories",
    tags: ["Categories"],
  })
  .handler(({ context }) => CategoryService.getPublicCategories(context));

export default {
  list,
  // Loaded on the first request under the prefix; public calls never load it.
  admin: lazy(() => import("./admin-router"), { prefix: "/admin/categories" }),
};
