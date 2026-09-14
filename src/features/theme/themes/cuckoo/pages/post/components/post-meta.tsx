import { ClientOnly, Link } from "@tanstack/react-router";
import { Calendar, Clock, Tag } from "lucide-react";
import type { PostItem } from "@/features/posts/schema/posts.schema";
import { formatDate } from "@/lib/utils";
import { m } from "@/paraglide/messages";

interface PostMetaProps {
  post: PostItem;
  className?: string;
}

/**
 * 文章元信息(对应原主题 post-card-media-covered 的副标题行):
 * 浏览量 | 发布日期 | 阅读时间 | 标签,白色文字悬浮于封面底部。
 */
export function PostMeta({ post, className }: PostMetaProps) {
  return (
    <div
      className={
        className ??
        "flex flex-wrap items-center gap-x-1 gap-y-1 text-sm text-white/75"
      }
    >
      <span className="inline-flex items-center gap-1">
        <Calendar size={14} />
        <ClientOnly fallback="-">{formatDate(post.publishedAt)}</ClientOnly>
      </span>
      <span className="opacity-60">|</span>
      <span className="inline-flex items-center gap-1">
        <Clock size={14} />
        {m.read_time({ count: post.readTimeInMinutes })}
      </span>
      {post.tags && post.tags.length > 0 && (
        <>
          <span className="opacity-60">|</span>
          <span className="inline-flex items-center gap-1">
            <Tag size={14} />
            {post.tags.map((tag, i) => (
              <span key={tag.name}>
                {i > 0 && <span className="opacity-60"> / </span>}
                <Link
                  to="/posts"
                  search={{ tagName: tag.name }}
                  className="hover:text-white"
                >
                  {tag.name}
                </Link>
              </span>
            ))}
          </span>
        </>
      )}
    </div>
  );
}
