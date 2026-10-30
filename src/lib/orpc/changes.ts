import type { z } from "zod";

export const NOTHING_TO_CHANGE =
  "There is nothing to change: send at least one field to change.";

/**
 * The fields to change in an update. An update with no field has nothing to
 * write, so it answers 400 saying so instead of reaching the database as an
 * empty `SET`.
 */
export function atLeastOneField<TSchema extends z.ZodType<object>>(
  schema: TSchema,
): TSchema {
  return schema.refine(
    (fields) => Object.values(fields).some((value) => value !== undefined),
    { message: NOTHING_TO_CHANGE },
  );
}
