import { z } from "zod";
import { coercedDate } from "@/lib/orpc/dates";

export const MutedUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string().nullable(),
  mutedAt: coercedDate,
});

export const MuteUserInputSchema = z.strictObject({
  userId: z.string().min(1),
});

export const UnmuteUserInputSchema = z.strictObject({
  userId: z.string().min(1),
});

export type MutedUser = z.infer<typeof MutedUserSchema>;
export type MuteUserInput = z.infer<typeof MuteUserInputSchema>;
export type UnmuteUserInput = z.infer<typeof UnmuteUserInputSchema>;
