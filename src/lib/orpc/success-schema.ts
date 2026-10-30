import { z } from "zod";

/** The body of an operation that has nothing to return but that it worked. */
export const SuccessResponseSchema = z.object({
  success: z.boolean().describe("True when the operation succeeded."),
});
