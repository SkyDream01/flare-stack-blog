import type { SiteConfig } from "@/features/config/site-config.schema";
import { getHomeBackgroundPreloadImages } from "@/components/layout/preload-images";

export function getThemeAvatar(siteConfig: SiteConfig): string {
  return __THEME_NAME__ === "cuckoo"
    ? siteConfig.theme.cuckoo.avatar
    : siteConfig.avatar;
}

// if the theme doesn't have a preload image, return an empty array
export function getThemePreloadImages(siteConfig: SiteConfig): Array<string> {
  switch (__THEME_NAME__) {
    case "fuwari":
      return getHomeBackgroundPreloadImages(siteConfig);
    case "cuckoo":
      return siteConfig.theme.cuckoo.bg ? [siteConfig.theme.cuckoo.bg] : [];
    case "default":
      return [
        siteConfig.theme.default.background?.homeImage,
        siteConfig.theme.default.background?.globalImage,
      ].filter((image): image is string => Boolean(image));
    default:
      __THEME_NAME__ satisfies never;
      return [];
  }
}
