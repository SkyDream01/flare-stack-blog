import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

// Passwords are gone, so this old entry point leads to the one sign-in page.
export const Route = createFileRoute("/_public/_auth/reset-link")({
  validateSearch: z.object({
    redirectTo: z.string().optional().catch(undefined),
  }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/login", search: { redirectTo: search.redirectTo } });
  },
});
