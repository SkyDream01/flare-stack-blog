import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

// Verification links in old emails still land here; sign-in is by code now.
export const Route = createFileRoute("/_public/_auth/verify-email")({
  validateSearch: z.object({
    redirectTo: z.string().optional().catch(undefined),
  }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/login", search: { redirectTo: search.redirectTo } });
  },
});
