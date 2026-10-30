import { m } from "@/paraglide/messages";

/** What the Admin sees a post as: draft, live, or live with edits not yet live. */
export type PostState = "draft" | "published" | "published-changed";

export function postStateOf({
  published,
  hasUnpublishedChanges,
}: {
  published: boolean;
  hasUnpublishedChanges: boolean;
}): PostState {
  if (!published) return "draft";
  return hasUnpublishedChanges ? "published-changed" : "published";
}

/** The status wording shared by the post list and the editor header. */
export function postStateLabel(state: PostState) {
  switch (state) {
    case "draft":
      return m.admin_posts_status_draft();
    case "published":
      return m.admin_posts_status_published();
    case "published-changed":
      return m.admin_posts_status_published_changed();
  }
}

/** What publishing does from this state, as the publish button reads it. */
export function publishActionLabel(state: PostState) {
  switch (state) {
    case "draft":
      return m.editor_header_publish();
    case "published-changed":
      return m.editor_header_publish_changes();
    case "published":
      return m.editor_header_republish();
  }
}
