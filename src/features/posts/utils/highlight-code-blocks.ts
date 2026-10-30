import type { JSONContent } from "@tiptap/react";
import { applyCodeBlockHighlighting } from "@/features/posts/utils/apply-code-block-highlighting";
import { HIGHLIGHT_BUDGET_CHARS } from "@/features/posts/utils/post-content-size";
import { PLAIN_TEXT } from "@/lib/code-languages";
import { plainCodeHtml } from "@/lib/plain-code-html";
import { highlight } from "@/lib/shiki";

export { HIGHLIGHT_BUDGET_CHARS };

function codeOf(node: JSONContent) {
  return node.content?.map((n) => n.text || "").join("") || "";
}

function needsHighlighting(node: JSONContent) {
  const existing = node.attrs?.highlightedHtml;
  return (
    node.type === "codeBlock" &&
    !(typeof existing === "string" && existing.length > 0)
  );
}

function codeBlocksIn(doc: JSONContent, found: Array<JSONContent> = []) {
  if (doc.type === "codeBlock") found.push(doc);
  doc.content?.forEach((child) => codeBlocksIn(child, found));
  return found;
}

async function highlightBlock(code: string, lang: string) {
  try {
    return await highlight(code, lang);
  } catch (e) {
    console.warn(
      JSON.stringify({
        event: "code_highlight_failed",
        lang,
        error: e instanceof Error ? e.message : String(e),
      }),
    );
    return plainCodeHtml(code);
  }
}

/**
 * Highlights, in document order, each code block that has no HTML yet while
 * its code fits in what is left of `HIGHLIGHT_BUDGET_CHARS`; a block that
 * does not fit gets plain HTML.
 */
async function highlightMissingCodeBlocks(
  doc: JSONContent,
): Promise<JSONContent> {
  let budget = HIGHLIGHT_BUDGET_CHARS;
  for (const node of codeBlocksIn(doc).filter(needsHighlighting)) {
    const code = codeOf(node);
    let html: string;
    if (code.length <= budget) {
      budget -= code.length;
      html = await highlightBlock(code, node.attrs?.language || PLAIN_TEXT);
    } else {
      html = plainCodeHtml(code);
    }
    node.attrs = { ...node.attrs, highlightedHtml: html };
  }
  return doc;
}

export async function highlightSnapshotContent(
  draft: JSONContent | null,
  fromSnapshot: JSONContent | null | undefined,
): Promise<JSONContent | null> {
  const reused = applyCodeBlockHighlighting(draft, fromSnapshot);
  if (!reused) return null;
  return highlightMissingCodeBlocks(reused);
}

/**
 * The snapshot body with each code block's own code standing in for the HTML
 * still to be highlighted. Highlighted HTML holds all of its code and never
 * less, so a snapshot over its size limit with this body is over it
 * highlighted too, and publishing can refuse it before highlighting anything.
 */
export function snapshotContentFloor(
  draft: JSONContent | null,
  fromSnapshot: JSONContent | null | undefined,
): JSONContent | null {
  const reused = applyCodeBlockHighlighting(draft, fromSnapshot);
  if (!reused) return null;
  for (const node of codeBlocksIn(reused).filter(needsHighlighting)) {
    node.attrs = { ...node.attrs, highlightedHtml: codeOf(node) };
  }
  return reused;
}
