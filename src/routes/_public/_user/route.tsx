import { createFileRoute, Outlet } from "@tanstack/react-router";
import theme from "@theme";
import { ErrorPage } from "@/components/common/error-page";
import { useLogout } from "@/features/auth/hooks/use-logout";
import { m } from "@/paraglide/messages";
import { readSession } from "@/features/auth/queries";
import { CACHE_CONTROL } from "@/lib/constants";

export const Route = createFileRoute("/_public/_user")({
  loader: async ({ context }) => {
    const session = await readSession(context.queryClient);
    return { session };
  },
  component: UserGate,
  errorComponent: ErrorPage,
  headers: () => {
    return CACHE_CONTROL.private;
  },
});

function UserGate() {
  const { session } = Route.useLoaderData();
  const { logout } = useLogout();
  const navOptions = [
    { id: "home", label: m.nav_home(), to: "/" as const },
    { id: "posts", label: m.nav_posts(), to: "/posts" as const },
    {
      id: "friend-links",
      label: m.nav_friend_links(),
      to: "/friend-links" as const,
    },
  ];

  return (
    <theme.UserLayout
      isAuthenticated={!!session?.user}
      navOptions={navOptions}
      user={session?.user}
      isSessionLoading={false}
      logout={logout}
    >
      <Outlet />
    </theme.UserLayout>
  );
}
