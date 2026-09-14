import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import theme from "@theme";
import { z } from "zod";
import { siteDomainQuery } from "@/features/config/queries";
import { getThemePreloadImages } from "@/features/theme/site-config.helpers";
import { popularPostsQuery, homePostsQuery } from "@/features/posts/queries";
import { buildCanonicalUrl, canonicalLink } from "@/lib/seo";

export const Route = createFileRoute("/_public/")({
  validateSearch: z.object({
    page: z.coerce
      .number()
      .int()
      .min(1)
      .max(1_000_000)
      .optional()
      .catch(undefined),
  }),
  loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
  loader: async ({ context, deps }) => {
    const [posts, domain] = await Promise.all([
      context.queryClient.ensureQueryData(homePostsQuery(deps.page)),
      context.queryClient.ensureQueryData(siteDomainQuery),
      context.queryClient.ensureQueryData(popularPostsQuery(3)),
    ]);

    if (posts.page !== deps.page) {
      throw redirect({
        to: "/",
        search: { page: posts.page === 1 ? undefined : posts.page },
        replace: true,
      });
    }
    return {
      canonicalHref: buildCanonicalUrl(domain, "/", {
        page: posts.page === 1 ? undefined : String(posts.page),
      }),
      preloadImages: getThemePreloadImages(context.siteConfig),
    };
  },
  head: ({ loaderData }) => ({
    links: [
      canonicalLink(loaderData?.canonicalHref ?? "/"),
      ...(loaderData?.preloadImages ?? []).map((href) => ({
        rel: "preload" as const,
        as: "image",
        href,
      })),
    ],
  }),
  pendingComponent: () => <theme.HomePageSkeleton />,
  component: HomeRoute,
});

function HomeRoute() {
  const { page = 1 } = Route.useSearch();
  const { data } = useSuspenseQuery(homePostsQuery(page));
  const { data: popularPosts } = useSuspenseQuery(popularPostsQuery(3));
  return (
    <theme.HomePage
      posts={data.items}
      pinnedPosts={data.items.filter((post) => Boolean(post.pinnedAt))}
      popularPosts={popularPosts}
      page={data.page}
      totalPages={data.totalPages}
    />
  );
}
