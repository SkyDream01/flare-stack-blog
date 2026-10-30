import { invalidate } from "@/features/cache/public-cache";
import { SuccessResponseSchema } from "@/lib/orpc/success-schema";
import { adminProcedure } from "@/lib/orpc/procedure";

const invalidateSite = adminProcedure
  .route({
    method: "POST",
    path: "/admin/cache/invalidate",
    summary: "Invalidate the public cache",
    tags: ["Admin Cache"],
  })
  .output(SuccessResponseSchema)
  .handler(async ({ context }) => {
    await invalidate.all(context);
    return { success: true };
  });

export default {
  invalidate: invalidateSite,
};
