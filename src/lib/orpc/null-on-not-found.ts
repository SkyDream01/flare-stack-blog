import { ORPCError } from "@orpc/client";

type AnyQueryFn = (context: never) => unknown;

/**
 * Turns a query's defined 404 (`code`) into a `null` result, so a missing
 * resource reads as absent instead of failing the query and the route.
 * Any other error still fails the query.
 */
export function nullOnNotFound<TOptions extends { queryFn?: AnyQueryFn }>(
  options: TOptions,
  code: string,
) {
  const queryFn = options.queryFn as (context: unknown) => unknown;
  return {
    ...options,
    queryFn: async (
      context: Parameters<NonNullable<TOptions["queryFn"]>>[0],
    ): Promise<Awaited<
      ReturnType<NonNullable<TOptions["queryFn"]>>
    > | null> => {
      try {
        return (await queryFn(context)) as Awaited<
          ReturnType<NonNullable<TOptions["queryFn"]>>
        >;
      } catch (error) {
        if (error instanceof ORPCError && error.code === code) return null;
        throw error;
      }
    },
  };
}

/**
 * Turns a list query's defined 404 (`code`) into an empty list, so the screen
 * of a post or an image that is gone shows nothing listed instead of failing.
 * Any other error still fails the query.
 */
export function emptyListOnNotFound<TOptions extends { queryFn?: AnyQueryFn }>(
  options: TOptions,
  code: string,
) {
  const queryFn = options.queryFn as (context: unknown) => unknown;
  type Items = Awaited<ReturnType<NonNullable<TOptions["queryFn"]>>>;
  return {
    ...options,
    queryFn: async (
      context: Parameters<NonNullable<TOptions["queryFn"]>>[0],
    ): Promise<Items> => {
      try {
        return (await queryFn(context)) as Items;
      } catch (error) {
        if (error instanceof ORPCError && error.code === code) {
          return [] as unknown as Items;
        }
        throw error;
      }
    },
  };
}
