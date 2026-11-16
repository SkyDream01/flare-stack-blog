import { Button } from "@/components/ui/button";
import type { PostsPageProps } from "@/features/theme/contract/pages";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { PostCard } from "../../components/post-card";
import { Reveal } from "../../components/reveal";

export function PostsPage({
  posts,
  tags,
  selectedTag,
  onTagClick,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: PostsPageProps) {
  return (
    <div>
      {/* 标签云筛选(对应原主题侧栏标签 chip) */}
      {tags.length > 0 && (
        <div className="cuckoo-card-base cuckoo-onload-animation mb-2 flex flex-wrap gap-2 p-3.5">
          <button
            type="button"
            onClick={() => onTagClick(undefined)}
            className={cn(
              "cuckoo-chip",
              !selectedTag && "!bg-(--cuckoo-primary) !text-white shadow-md",
            )}
          >
            {m.posts_all()}
          </button>
          {tags.map((tag) => (
            <button
              key={tag.name}
              type="button"
              onClick={() => onTagClick(tag.name)}
              className={cn(
                "cuckoo-chip",
                selectedTag === tag.name &&
                  "!bg-(--cuckoo-primary) !text-white shadow-md",
              )}
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}

      {posts.length > 0 ? (
        posts.map((post, index) => (
          <Reveal key={post.slug} delay={index * 55}>
            <PostCard post={post} />
          </Reveal>
        ))
      ) : (
        <div className="cuckoo-card-base cuckoo-text-50 my-5 px-8 py-12 text-center text-sm">
          {m.posts_no_posts()}
        </div>
      )}

      <div className="my-5 text-center">
        {hasNextPage ? (
          <Button
            variant="ghost"
            onClick={() => fetchNextPage()}
            loading={isFetchingNextPage}
            className="cuckoo-card-base cuckoo-card-hoverable cuckoo-text-75 h-auto px-4 pt-2.5 pb-1 text-sm transition-all hover:text-(--cuckoo-accent)"
          >
            {m.posts_load_more_cuckoo()}
          </Button>
        ) : posts.length > 0 ? (
          <div className="cuckoo-text-30 inline-block text-sm">
            {m.posts_end()}
          </div>
        ) : null}
      </div>
    </div>
  );
}
