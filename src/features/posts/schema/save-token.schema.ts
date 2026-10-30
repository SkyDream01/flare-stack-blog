import { z } from "zod";

// A Post's saveToken as reads answer it and as writes state it. Writes to a
// Post from other features (setting its Tags) state it the same way.

export const SaveTokenSchema = z
  .string()
  .describe(
    "Opaque token that every save of the post's draft and every publish or unpublish replaces, including tags, category, cover and Post Revision restores; pinning keeps it. State it as saveToken when saving or publishing so the write is refused with 409 EDIT_CONFLICT if the post was saved since you read it.",
  );

export const StatedSaveTokenSchema = z
  .string()
  .optional()
  .describe(
    "The saveToken from your latest read or write of this post. If the post was saved since, nothing is written and the response is 409 EDIT_CONFLICT with the current token in data.saveToken: read the post again before deciding what to write. Omit it to write unconditionally.",
  );
