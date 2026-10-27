import { z } from "zod";
import type { Messages } from "@/lib/i18n";

/** The public name a User shows beside their Comments. */
export const createPublicNameSchema = (messages: Messages) =>
  z
    .string()
    .min(2, messages.profile_validation_name_min())
    .max(20, messages.profile_validation_name_max());
