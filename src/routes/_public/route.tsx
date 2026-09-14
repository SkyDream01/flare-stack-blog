import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import theme from "@theme";
import { useLogout } from "@/features/auth/hooks/use-logout";
import { getThemePreloadImages } from "@/features/theme/site-config.helpers";
import { authClient } from "@/lib/auth/auth.client";
import { CACHE_CONTROL } from "@/lib/constants";
import { clientEnv } from "@/lib/env/client.env";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_public")({
  loader: ({ context }) => ({
    preloadImages: getThemePreloadImages(context.siteConfig),
  }),
  component: PublicLayout,
  headers: () => {
    return CACHE_CONTROL.public;
  },
  head: ({ loaderData }) => {
    const env = clientEnv();
    return {
      links: (loaderData?.preloadImages ?? []).map((href) => ({
        rel: "preload" as const,
        as: "image",
        href,
      })),
      scripts: env.VITE_UMAMI_WEBSITE_ID
        ? [
            {
              src: "/stats.js",
              defer: true,
              "data-website-id": env.VITE_UMAMI_WEBSITE_ID,
            },
          ]
        : [],
    };
  },
});

function PublicLayout() {
  const navigate = useNavigate();
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
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

  // Global shortcut: Cmd/Ctrl + K to navigate to search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isToggle = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isToggle) {
        e.preventDefault();
        navigate({ to: "/search" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <>
      <theme.PublicLayout
        navOptions={navOptions}
        user={session?.user}
        isSessionLoading={isSessionPending}
        logout={logout}
      >
        <Outlet />
      </theme.PublicLayout>
      <theme.Toaster />
    </>
  );
}
