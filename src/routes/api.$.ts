import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      // Imported per request: every page evaluates the route tree, and the
      // OpenAPI handler (with its schema converters) only serves /api.
      ANY: async ({ request, context }) => {
        const [{ handleApiRequest }, { createApiContext }] = await Promise.all([
          import("@/lib/orpc/openapi-handler"),
          import("@/lib/orpc/create-context"),
        ]);
        return handleApiRequest(
          request,
          createApiContext(request.headers, context.env, context.executionCtx),
        );
      },
    },
  },
});
