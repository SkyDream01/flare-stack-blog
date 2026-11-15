import { lazy, createElement } from "react";
import type { ThemeComponents } from "@/features/theme/contract/components";
import { config } from "./config";
import { LazyToaster as Toaster } from "@/components/layout/lazy-toaster";
import { getFuwariThemeStyle } from "@/components/layout/document-style";
import type { HomePageProps } from "@/features/theme/contract/pages";
import { PublicLayout } from "./layouts/public-layout";

// Each route loads its own presentation; the shell never pulls every page in.
export default {
  config,
  getDocumentStyle: getFuwariThemeStyle,
  PublicLayout,
  Toaster,
  MomentPage: lazy(() =>
    import("@/features/moments/components/moment-page").then((module) => ({
      default: module.MomentPage,
    })),
  ),
  MomentPageSkeleton: lazy(() =>
    import("@/features/moments/components/moments-page-skeleton").then(
      (module) => ({ default: module.MomentPageSkeleton }),
    ),
  ),
  MomentsPage: lazy(() =>
    import("@/features/moments/components/moments-page").then((module) => ({
      default: module.MomentsPage,
    })),
  ),
  MomentsPageSkeleton: lazy(() =>
    import("@/features/moments/components/moments-page-skeleton").then(
      (module) => ({ default: module.MomentsPageSkeleton }),
    ),
  ),
  HomePage: lazy(() =>
    import("@/features/posts/components/home-page").then(({ HomePage }) => ({
      default: (props: HomePageProps) =>
        createElement(HomePage, {
          ...props,
          page: props.page ?? 1,
          totalPages: props.totalPages ?? 1,
        }),
    })),
  ),
  HomePageSkeleton: lazy(() =>
    import("@/features/posts/components/home-page-skeleton").then((module) => ({
      default: module.HomePageSkeleton,
    })),
  ),
  PostsPage: lazy(() =>
    import("@/features/posts/components/posts-page").then((module) => ({
      default: module.PostsPage,
    })),
  ),
  PostsPageSkeleton: lazy(() =>
    import("@/features/posts/components/posts-page-skeleton").then(
      (module) => ({ default: module.PostsPageSkeleton }),
    ),
  ),
  PostPage: lazy(() =>
    import("@/features/posts/components/post-page").then((module) => ({
      default: module.PostPage,
    })),
  ),
  PostPageSkeleton: lazy(() =>
    import("@/features/posts/components/post-page-skeleton").then((module) => ({
      default: module.PostPageSkeleton,
    })),
  ),
  AuthLayout: lazy(() =>
    import("@/components/layout/auth-layout").then((module) => ({
      default: module.AuthLayout,
    })),
  ),
  UserLayout: lazy(() =>
    import("@/components/layout/user-layout").then((module) => ({
      default: module.UserLayout,
    })),
  ),
  FriendLinksPage: lazy(() =>
    import("@/features/friend-links/components/friend-links-page").then(
      (module) => ({ default: module.FriendLinksPage }),
    ),
  ),
  FriendLinksPageSkeleton: lazy(() =>
    import("@/features/friend-links/components/friend-links-page-skeleton").then(
      (module) => ({ default: module.FriendLinksPageSkeleton }),
    ),
  ),
  SearchPage: lazy(() =>
    import("./pages/search").then((module) => ({ default: module.SearchPage })),
  ),
  SubmitFriendLinkPage: lazy(() =>
    import("./pages/submit-friend-link").then((module) => ({
      default: module.SubmitFriendLinkPage,
    })),
  ),
  LoginPage: lazy(() =>
    import("@/features/auth/components/login-page").then((module) => ({
      default: module.LoginPage,
    })),
  ),
  ProfilePage: lazy(() =>
    import("@/features/auth/components/profile-page").then((module) => ({
      default: module.ProfilePage,
    })),
  ),
} satisfies ThemeComponents;
