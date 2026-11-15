import { lazy } from "react";
import type { ThemeComponents } from "@/features/theme/contract/components";
import { config } from "./config";
import "./styles/index.css";
import { Toaster } from "./components/toaster";
import { getCuckooThemeStyle } from "./theme-style";
import { PublicLayout } from "./layouts/public-layout";

// Each route loads its own presentation; the shell never pulls every page in.
export default {
  config,
  getDocumentStyle: getCuckooThemeStyle,
  PublicLayout,
  Toaster,
  MomentPage: lazy(() =>
    import("./pages/moments").then((module) => ({
      default: module.MomentPage,
    })),
  ),
  MomentPageSkeleton: lazy(() =>
    import("./pages/moments").then((module) => ({
      default: module.MomentPageSkeleton,
    })),
  ),
  MomentsPage: lazy(() =>
    import("./pages/moments").then((module) => ({
      default: module.MomentsPage,
    })),
  ),
  MomentsPageSkeleton: lazy(() =>
    import("./pages/moments").then((module) => ({
      default: module.MomentsPageSkeleton,
    })),
  ),
  HomePage: lazy(() =>
    import("./pages/home").then((module) => ({ default: module.HomePage })),
  ),
  HomePageSkeleton: lazy(() =>
    import("./pages/home").then((module) => ({
      default: module.HomePageSkeleton,
    })),
  ),
  PostsPage: lazy(() =>
    import("./pages/posts").then((module) => ({ default: module.PostsPage })),
  ),
  PostsPageSkeleton: lazy(() =>
    import("./pages/posts").then((module) => ({
      default: module.PostsPageSkeleton,
    })),
  ),
  PostPage: lazy(() =>
    import("./pages/post").then((module) => ({ default: module.PostPage })),
  ),
  PostPageSkeleton: lazy(() =>
    import("./pages/post").then((module) => ({
      default: module.PostPageSkeleton,
    })),
  ),
  AuthLayout: lazy(() =>
    import("./layouts/auth-layout").then((module) => ({
      default: module.AuthLayout,
    })),
  ),
  UserLayout: lazy(() =>
    import("./layouts/user-layout").then((module) => ({
      default: module.UserLayout,
    })),
  ),
  FriendLinksPage: lazy(() =>
    import("./pages/friend-links").then((module) => ({
      default: module.FriendLinksPage,
    })),
  ),
  FriendLinksPageSkeleton: lazy(() =>
    import("./pages/friend-links").then((module) => ({
      default: module.FriendLinksPageSkeleton,
    })),
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
    import("./pages/auth/login").then((module) => ({
      default: module.LoginPage,
    })),
  ),
  ProfilePage: lazy(() =>
    import("./pages/user/profile").then((module) => ({
      default: module.ProfilePage,
    })),
  ),
} satisfies ThemeComponents;
