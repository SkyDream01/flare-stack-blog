import type { JSONContent } from "@tiptap/core";
import { renderToHTMLString } from "@tiptap/static-renderer/pm/html-string";
import { schemaExtensions } from "@/features/posts/editor/schema";
import { publicLinkAttributes } from "@/features/posts/utils/public-link";
import {
  videoMetaOf,
  videoPageUrl,
  videoSourceOf,
} from "@/features/posts/utils/video-source";
import { escapeCodeHtml as escape } from "@/lib/plain-code-html";

/*
 * A post body as the HTML a feed reader shows (RSS content:encoded, Atom
 * content, JSON Feed content_html). A reader has no site around it, so
 * addresses are absolute, a video is a link to its page, and math is its
 * source in code. Links open as on the public page (`publicLinkAttributes`).
 */

function absolute(address: string, origin: string) {
  return address.startsWith("/") && !address.startsWith("//")
    ? `${origin}${address}`
    : address;
}

export function renderFeedHtml(
  content: JSONContent | null,
  origin: string,
): string {
  if (!content) return "";
  return renderToHTMLString({
    extensions: schemaExtensions,
    content,
    options: {
      nodeMapping: {
        image: ({ node }) => {
          const { src, alt } = node.attrs as {
            src?: string | null;
            alt?: string | null;
          };
          if (!src) return "";
          return `<img src="${escape(absolute(src, origin))}" alt="${escape(alt && alt !== "null" ? alt : "")}">`;
        },
        video: ({ node }) => {
          const source = videoSourceOf(node.attrs);
          if (!source) return "";
          const page = escape(videoPageUrl(source));
          const { title } = videoMetaOf(node.attrs);
          return `<p><a href="${page}">${title ? escape(title) : page}</a></p>`;
        },
        inlineMath: ({ node }) =>
          `<code>${escape(String(node.attrs.latex ?? ""))}</code>`,
        blockMath: ({ node }) =>
          `<pre><code>${escape(String(node.attrs.latex ?? ""))}</code></pre>`,
      },
      markMapping: {
        link: ({ mark, children }) => {
          const { href, title, target, rel } = publicLinkAttributes(mark.attrs);
          const attrs = [
            href !== undefined && `href="${escape(absolute(href, origin))}"`,
            title !== undefined && `title="${escape(title)}"`,
            `target="${target}"`,
            `rel="${rel}"`,
          ].filter(Boolean);
          return `<a ${attrs.join(" ")}>${[children].flat().join("")}</a>`;
        },
      },
    },
  });
}
