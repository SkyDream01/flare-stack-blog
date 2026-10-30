import { z } from "zod";

// Pagination parameters are whole numbers within bounds, so `limit=2.5` or
// `offset=-1` answers 400 instead of reaching the query.

const OFFSET_MAX = 1_000_000;

/** A page size from 1 to `max`. */
export function pageLimitSchema(max: number) {
  return z
    .number()
    .int()
    .min(1)
    .max(max)
    .describe(`How many items to return, a whole number from 1 to ${max}.`);
}

/** How many items to skip. */
export const PageOffsetSchema = z
  .number()
  .int()
  .min(0)
  .max(OFFSET_MAX)
  .describe(
    `How many items to skip, a whole number from 0 to ${OFFSET_MAX}. Defaults to 0.`,
  );

/** The id of the last item of the previous page. */
export const IdCursorSchema = z
  .number()
  .int()
  .positive()
  .describe(
    "nextCursor from the previous page: continue after that item. Omit for the first page.",
  );
