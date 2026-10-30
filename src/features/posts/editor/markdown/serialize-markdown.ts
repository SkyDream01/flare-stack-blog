import type { JSONContent } from "@tiptap/core";
import { getMarkdownManager } from "@/features/posts/editor/markdown/markdown-manager";

/**
 * Stands in for a `$` of plain text while serializing, so it comes out
 * escaped: Tiptap escapes text itself and would escape a backslash put in
 * front of it.
 */
const TEXT_DOLLAR = "\uE000";

function isCode(node: JSONContent) {
  return node.marks?.some((mark) => mark.type === "code") ?? false;
}

function markTextDollars(node: JSONContent): JSONContent {
  if (node.type === "codeBlock") return node;
  if (node.type === "text") {
    return isCode(node) || !node.text?.includes("$")
      ? node
      : { ...node, text: node.text.replaceAll("$", TEXT_DOLLAR) };
  }
  return node.content
    ? { ...node, content: node.content.map(markTextDollars) }
    : node;
}

/**
 * Editor content as Markdown that `parseMarkdown` reads back to the same
 * content, as far as Markdown can carry it.
 */
export function serializeMarkdown(doc: JSONContent): string {
  const markdown = getMarkdownManager().serialize(markTextDollars(doc));
  const trimmed = markdown.replaceAll(TEXT_DOLLAR, "\\$").trim();
  return trimmed ? `${trimmed}\n` : "";
}
