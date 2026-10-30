import { z } from "zod";
import {
  AdminCategoryListSchema,
  CategoryOptionSchema,
  CategorySelectSchema,
  CreateCategoryInputSchema,
  DeleteCategoryInputSchema,
  DeleteCategoryResultSchema,
  GetCategoriesInputSchema,
  UpdateCategoryInputSchema,
} from "@/features/categories/categories.schema";
import * as CategoryService from "@/features/categories/categories.service";
import { adminProcedure } from "@/lib/orpc/procedure";
import { unwrapResult } from "@/lib/orpc/unwrap-result";

const categoryErrors = {
  CATEGORY_NOT_FOUND: { status: 404, message: "Category not found." },
  CATEGORY_NAME_ALREADY_EXISTS: {
    status: 409,
    message: "Category name already exists.",
  },
} as const;

const adminList = adminProcedure
  .route({
    method: "GET",
    path: "/admin/categories",
    summary: "List categories for admin",
    tags: ["Admin Categories"],
  })
  .input(GetCategoriesInputSchema)
  .output(AdminCategoryListSchema)
  .handler(({ context, input }) =>
    CategoryService.getCategories(context, input),
  );

const options = adminProcedure
  .route({
    method: "GET",
    path: "/admin/categories/options",
    summary: "List category options",
    tags: ["Admin Categories"],
  })
  .output(z.array(CategoryOptionSchema))
  .handler(({ context }) => CategoryService.getCategoryOptions(context));

const create = adminProcedure
  .errors({
    CATEGORY_NAME_ALREADY_EXISTS: categoryErrors.CATEGORY_NAME_ALREADY_EXISTS,
  })
  .route({
    method: "POST",
    path: "/admin/categories",
    summary: "Create a category",
    tags: ["Admin Categories"],
  })
  .input(CreateCategoryInputSchema)
  .output(CategorySelectSchema)
  .handler(({ context, input, errors }) =>
    unwrapResult(CategoryService.createCategory(context, input), {
      CATEGORY_NAME_ALREADY_EXISTS: () => {
        throw errors.CATEGORY_NAME_ALREADY_EXISTS();
      },
    }),
  );

const update = adminProcedure
  .errors(categoryErrors)
  .route({
    method: "PATCH",
    path: "/admin/categories/{id}",
    summary: "Update a category",
    tags: ["Admin Categories"],
  })
  .input(UpdateCategoryInputSchema)
  .output(CategorySelectSchema)
  .handler(({ context, input, errors }) =>
    unwrapResult(CategoryService.updateCategory(context, input), {
      CATEGORY_NOT_FOUND: () => {
        throw errors.CATEGORY_NOT_FOUND();
      },
      CATEGORY_NAME_ALREADY_EXISTS: () => {
        throw errors.CATEGORY_NAME_ALREADY_EXISTS();
      },
    }),
  );

const remove = adminProcedure
  .errors({ CATEGORY_NOT_FOUND: categoryErrors.CATEGORY_NOT_FOUND })
  .route({
    method: "DELETE",
    path: "/admin/categories/{id}",
    summary: "Delete a category",
    tags: ["Admin Categories"],
  })
  .input(DeleteCategoryInputSchema)
  .output(DeleteCategoryResultSchema)
  .handler(({ context, input, errors }) =>
    unwrapResult(CategoryService.deleteCategory(context, input), {
      CATEGORY_NOT_FOUND: () => {
        throw errors.CATEGORY_NOT_FOUND();
      },
    }),
  );

export default {
  list: adminList,
  options,
  create,
  update,
  remove,
};
