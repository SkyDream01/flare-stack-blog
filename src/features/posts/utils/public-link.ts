import { isOpenableLinkHref } from "@/lib/links/openable-link-href";

/**
 * A post link's attributes on the public page and in feeds. The site sets
 * `target` and `rel` itself, whatever the body holds, and shows no `class`
 * from it, so a body can neither hand the opened page its opener nor restyle
 * the site. An address a post cannot show is left out, as the editor's link
 * mark leaves it out.
 */
export function publicLinkAttributes(attrs: Record<string, unknown>) {
  const { href, title } = attrs;
  return {
    href:
      typeof href === "string" && isOpenableLinkHref(href) ? href : undefined,
    title: typeof title === "string" && title ? title : undefined,
    target: "_blank",
    rel: "noopener noreferrer nofollow",
  };
}
