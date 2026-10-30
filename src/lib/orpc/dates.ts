import { z } from "zod";

/**
 * A date field: a Date on the server, an ISO string once serialized as JSON.
 * One schema for every feature, so the OpenAPI document defines it once
 * (`DateTime` in `openapi-components.ts`) instead of in every date field.
 */
export const coercedDate = z.union([
  z.date(),
  z.string().pipe(z.coerce.date()),
]);
