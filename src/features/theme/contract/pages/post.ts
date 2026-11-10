import type { PostWithToc } from "@/features/posts/schema/posts.schema";

export interface PostPageProps {
  post: Exclude<PostWithToc, null>;
  /** The Post's canonical address, as the route's head has it. */
  canonicalHref: string;
}
