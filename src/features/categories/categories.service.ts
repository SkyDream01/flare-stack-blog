import { getCategoryOptions as readCategoryOptions } from "./data/category-options.data";
import { invalidate } from "@/features/cache/public-cache";
import { publicCategoryList } from "@/features/categories/categories.cache";
import * as CategoryRepo from "@/features/categories/data/categories.data";
import * as SearchService from "@/features/search/service/search.service";
import type {
  CreateCategoryInput,
  DeleteCategoryInput,
  GetCategoriesInput,
  UpdateCategoryInput,
} from "@/features/categories/categories.schema";
import { CATEGORY_NAME, isUniqueViolation } from "@/lib/db/unique-keys";
import { err, ok } from "@/lib/errors";

async function invalidateCategoryRelatedCache(
  context: DbContext & { executionCtx: ExecutionContext },
  affectedPosts: Array<{ id: number; slug: string | null }>,
) {
  await invalidate.categoryChanged(context, {
    slugs: affectedPosts.flatMap((post) => (post.slug ? [post.slug] : [])),
  });
}

export async function getPublicCategories(
  context: DbContext & {
    executionCtx: ExecutionContext;
  },
) {
  return publicCategoryList.get(context, {});
}

export async function getCategories(
  context: DbContext,
  data: GetCategoriesInput = {},
) {
  const { sortBy = "name", sortDir = "asc", publicOnly = false } = data;
  const [
    items,
    uncategorizedPostCount,
    publicItems,
    uncategorizedPublicPostCount,
  ] = await Promise.all([
    CategoryRepo.getAllCategoriesWithCount(context.db, {
      sortBy,
      sortDir,
      publicOnly,
    }),
    CategoryRepo.countUncategorizedPosts(context.db),
    CategoryRepo.getAllCategoriesWithCount(context.db, { publicOnly: true }),
    CategoryRepo.countUncategorizedPosts(context.db, true),
  ]);
  const publicCounts = new Map(
    publicItems.map((item) => [item.id, item.postCount]),
  );
  return {
    items: items.map((item) => ({
      ...item,
      publicPostCount: publicCounts.get(item.id) ?? 0,
    })),
    uncategorizedPostCount,
    uncategorizedPublicPostCount,
  };
}

export const createCategory = async (
  context: DbContext,
  data: CreateCategoryInput,
) => {
  const exists = await CategoryRepo.nameExists(context.db, data.name);
  if (exists) {
    return err({ reason: "CATEGORY_NAME_ALREADY_EXISTS" });
  }

  try {
    return ok(
      await CategoryRepo.insertCategory(context.db, { name: data.name }),
    );
  } catch (error) {
    // A concurrent create or rename took the name after the check.
    if (isUniqueViolation(error, CATEGORY_NAME)) {
      return err({ reason: "CATEGORY_NAME_ALREADY_EXISTS" });
    }
    throw error;
  }
};

export async function updateCategory(
  context: DbContext & { executionCtx: ExecutionContext },
  data: UpdateCategoryInput,
) {
  const existing = await CategoryRepo.findCategoryById(context.db, data.id);
  if (!existing) {
    return err({ reason: "CATEGORY_NOT_FOUND" });
  }

  if (data.data.name && data.data.name !== existing.name) {
    const exists = await CategoryRepo.nameExists(context.db, data.data.name, {
      excludeId: data.id,
    });
    if (exists) {
      return err({ reason: "CATEGORY_NAME_ALREADY_EXISTS" });
    }
  }

  const affectedPosts = await CategoryRepo.getPublishedPostsByCategoryId(
    context.db,
    data.id,
  );
  let category;
  try {
    category = await CategoryRepo.updateCategory(
      context.db,
      data.id,
      data.data,
    );
  } catch (error) {
    // A concurrent create or rename took the name after the check.
    if (isUniqueViolation(error, CATEGORY_NAME)) {
      return err({ reason: "CATEGORY_NAME_ALREADY_EXISTS" });
    }
    throw error;
  }

  // The new name is public at once, so search follows (not left to a rebuild).
  if (data.data.name && data.data.name !== existing.name) {
    await SearchService.reindexPosts(
      context,
      affectedPosts.map((post) => post.id),
    );
  }

  context.executionCtx.waitUntil(
    invalidateCategoryRelatedCache(context, affectedPosts),
  );

  return ok(category);
}

export async function deleteCategory(
  context: DbContext & { executionCtx: ExecutionContext },
  data: DeleteCategoryInput,
) {
  const category = await CategoryRepo.findCategoryById(context.db, data.id);
  if (!category) {
    return err({ reason: "CATEGORY_NOT_FOUND" });
  }

  const affectedPosts = await CategoryRepo.getPublishedPostsByCategoryId(
    context.db,
    data.id,
  );
  await CategoryRepo.deleteCategory(context.db, data.id);
  await SearchService.reindexPosts(
    context,
    affectedPosts.map((post) => post.id),
  );

  context.executionCtx.waitUntil(
    invalidateCategoryRelatedCache(context, affectedPosts),
  );

  return ok({ success: true });
}

export function getCategoryOptions(context: DbContext) {
  return readCategoryOptions(context.db);
}
