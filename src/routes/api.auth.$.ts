import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      // Better Auth's server code loads only for requests that reach it.
      ANY: async ({ request, context }) => {
        const { handleAuthRequest } =
          await import("@/lib/http/handle-auth-request");
        return handleAuthRequest(request, context.env);
      },
    },
  },
});
