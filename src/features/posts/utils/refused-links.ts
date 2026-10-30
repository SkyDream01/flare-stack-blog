import type { JSONContent } from "@tiptap/core";
import { isOpenableLinkHref } from "@/lib/links/openable-link-href";

/**
 * The link addresses in a post body that a post cannot show, such as
 * `javascript:` and `data:` links, each once, in reading order.
 */
export function refusedLinks(doc: JSONContent | null | undefined) {
  const refused = new Set<string>();
  const visit = (node: JSONContent) => {
    for (const mark of node.marks ?? []) {
      const href: unknown = mark.attrs?.href;
      if (mark.type === "link" && typeof href === "string") {
        if (!isOpenableLinkHref(href)) refused.add(href);
      }
    }
    node.content?.forEach(visit);
  };
  if (doc) visit(doc);
  return [...refused];
}
