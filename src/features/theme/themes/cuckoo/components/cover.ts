import type { SiteConfig } from "@/features/config/site-config.schema";

/** Material 风格渐变(无封面图且未配置兜底图源时,按 slug 稳定取色) */
const COVER_GRADIENTS = [
  "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)",
  "linear-gradient(135deg, #6366f1 0%, #22d3ee 100%)",
  "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
  "linear-gradient(135deg, #10b981 0%, #0ea5e9 100%)",
  "linear-gradient(135deg, #a855f7 0%, #ec4899 100%)",
  "linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)",
];

export function gradientCoverFor(slug: string): string {
  let hash = 5381;
  for (let i = 0; i < slug.length; i++) {
    hash = ((hash << 5) + hash + slug.charCodeAt(i)) >>> 0;
  }
  hash = (hash ^ (slug.length << 8)) >>> 0;
  return COVER_GRADIENTS[hash % COVER_GRADIENTS.length];
}

/**
 * Post Cover 图片地址：文章封面优先，其次为配置的兜底图源。
 * 外部图源按 slug 区分请求，避免浏览器为所有文章复用同一张随机图。
 */
export function coverImageSource(
  siteConfig: SiteConfig,
  slug: string,
  coverImage: string | null | undefined,
): string | undefined {
  if (coverImage) {
    return coverImage;
  }

  const source = siteConfig.theme.cuckoo.defaultCover;
  if (source) {
    let url = source.includes("{slug}")
      ? source.replaceAll("{slug}", encodeURIComponent(slug))
      : source;
    if (!source.includes("{slug}") && /^https?:\/\//i.test(source)) {
      // Preserve source parameters verbatim and put the cache key before the fragment.
      const fragmentIndex = source.indexOf("#");
      const base =
        fragmentIndex === -1 ? source : source.slice(0, fragmentIndex);
      const fragment = fragmentIndex === -1 ? "" : source.slice(fragmentIndex);
      const separator = base.includes("?")
        ? /[?&]$/.test(base)
          ? ""
          : "&"
        : "?";
      url = `${base}${separator}_post=${encodeURIComponent(slug)}${fragment}`;
    }
    return url;
  }

  return undefined;
}

export function coverBackgroundValue(
  siteConfig: SiteConfig,
  slug: string,
  coverImage: string | null | undefined,
): string {
  const src = coverImageSource(siteConfig, slug, coverImage);
  return src ? `url("${src}")` : gradientCoverFor(slug);
}
