import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      // Imported per request: every page evaluates the route tree, and the
      // OpenAPI handler (with its schema converters) only serves /api.
      ANY: async ({ request, context }) => {
        const [{ openAPIHandler }, { createApiContext }] = await Promise.all([
          import("@/lib/orpc/openapi-handler"),
          import("@/lib/orpc/create-context"),
        ]);
        const { response } = await openAPIHandler.handle(request, {
          prefix: "/api",
          context: createApiContext(
            request.headers,
            context.env,
            context.executionCtx,
          ),
        });
        return response ?? new Response("Not Found", { status: 404 });
      },
    },
  },
});
