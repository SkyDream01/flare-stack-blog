import { ClientOnly, Link, useRouteContext } from "@tanstack/react-router";
import { Calendar, Tag } from "lucide-react";
import type { PostItem } from "@/features/posts/schema/posts.schema";
import { coverBackgroundValue } from "@/features/theme/themes/cuckoo/components/cover";
import { formatDate } from "@/lib/utils";
import { m } from "@/paraglide/messages";

interface PostCardProps {
  post: PostItem;
  pinned?: boolean;
}

/**
 * 首页/列表文章卡片(对应原主题 .index-card):
 * 封面媒体卡,标题悬浮于底部,文字始终可见，鼠标悬停时图片轻微放大并柔化。
 */
export function PostCard({ post, pinned }: PostCardProps) {
  const { siteConfig } = useRouteContext({ from: "__root__" });
  const tagNames = (post.tags ?? []).map((t) => t.name);

  return (
    <Link
      to="/post/$slug"
      params={{ slug: post.slug }}
      className="cuckoo-card-base cuckoo-card-hoverable cuckoo-post-card group my-4 block sm:my-5"
    >
      <div className="relative flex min-h-72 w-full items-end overflow-hidden rounded-(--cuckoo-radius) sm:min-h-87.5">
        {/* 封面层(封面图 > 兜底图源 > slug 渐变) */}
        <div
          className="cuckoo-post-cover absolute inset-0 bg-cover bg-center transition-transform duration-300"
          style={{
            backgroundImage: coverBackgroundValue(
              siteConfig,
              post.slug,
              post.cover?.url,
            ),
          }}
        />
        {/* 悬停毛玻璃(对应原主题 .index-card-filter) */}
        <div className="cuckoo-post-filter absolute inset-0 transition-[backdrop-filter] duration-300" />
        {/* 底部渐变压暗(对应原主题 .mdui-card-media-covered) */}
        <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/45 to-black/10" />

        {/* 文字区随内容自然增高，避免长标题被裁切 */}
        <div className="relative w-full min-w-0 p-5 text-white sm:p-7">
          <h2 className="text-xl leading-snug font-medium wrap-anywhere text-balance sm:text-2xl [text-shadow:1px_1px_2px_rgb(0_0_0/0.4)]">
            {pinned && (
              <span className="mr-2 align-middle text-sm font-bold text-(--cuckoo-accent)">
                [{m.home_pinned_posts()}]
              </span>
            )}
            {post.title}
          </h2>

          {/* 元信息在触屏和键盘浏览时保持可见 */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/90 sm:text-sm [&_svg]:shrink-0">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Calendar size={14} />
              <ClientOnly fallback="-">
                {formatDate(post.publishedAt)}
              </ClientOnly>
            </span>
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Tag size={14} />
              <span className="line-clamp-2 wrap-anywhere">
                {tagNames.length > 0 ? tagNames.join(" / ") : m.post_no_tags()}
              </span>
            </span>
          </div>

          {/* 摘要 */}
          <div className="mt-3 line-clamp-2 text-sm leading-relaxed text-white/85 wrap-anywhere empty:hidden">
            {post.summary ?? ""}
          </div>
        </div>
      </div>
    </Link>
  );
}
