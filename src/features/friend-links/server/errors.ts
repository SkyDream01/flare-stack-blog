// Shared by the public and the Admin friend link procedures.
export const friendLinkErrors = {
  DUPLICATE_URL: { status: 409, message: "Friend link URL already exists." },
  INVALID_STATE: {
    status: 409,
    message:
      "Only a rejected application can be resubmitted. Refresh its status.",
  },
  NOT_FOUND: { status: 404, message: "Friend link not found." },
  NAME_REQUIRED: {
    status: 403,
    message: "Set a public name before submitting a friend link.",
  },
} as const;
