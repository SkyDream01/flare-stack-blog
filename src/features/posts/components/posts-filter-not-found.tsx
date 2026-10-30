import { Link } from "@tanstack/react-router";
import { Home, LayoutList } from "lucide-react";
import { NotFound } from "@/components/common/not-found";
import { StatusPage } from "@/components/common/status-page";
import { buttonClass } from "@/components/ui/button";
import { isMissingPublicFilter } from "@/features/posts/utils/post-public-search";
import { m } from "@/paraglide/messages";

/**
 * The not-found page of /posts: says which Tag or Category does not exist and
 * leads to all posts. Any other not-found keeps the generic page.
 */
export function PostsFilterNotFound({ data }: { data?: unknown }) {
  if (!isMissingPublicFilter(data)) return <NotFound />;
  const tag = data.kind === "tag";
  return (
    <StatusPage
      code="404"
      title={
        tag
          ? m.posts_tag_not_found_title({ name: data.name })
          : m.posts_category_not_found_title({ name: data.name })
      }
      description={
        tag ? m.posts_tag_not_found_desc() : m.posts_category_not_found_desc()
      }
      action={
        <>
          <Link
            to="/posts"
            className={buttonClass({ variant: "primary", size: "lg" })}
          >
            <LayoutList size={18} aria-hidden="true" />
            {m.posts_not_found_all()}
          </Link>
          <Link to="/" className={buttonClass({ size: "lg" })}>
            <Home size={18} aria-hidden="true" />
            {m.not_found_return()}
          </Link>
        </>
      }
    />
  );
}
