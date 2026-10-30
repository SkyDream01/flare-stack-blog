import type { JSONContent } from "@tiptap/react";
import { PLAIN_TEXT, resolveCodeLanguage } from "@/lib/code-languages";
import { isPlainCodeHtml } from "@/lib/plain-code-html";

export function codeBlockHighlightKey(language: string, code: string) {
  return `${language || PLAIN_TEXT}\0${code}`;
}

function codeBlockText(node: JSONContent) {
  return node.content?.map((child) => child.text || "").join("") || "";
}

function codeBlockLang(node: JSONContent) {
  return String(node.attrs?.language || PLAIN_TEXT);
}

function codeBlockKey(node: JSONContent) {
  return codeBlockHighlightKey(codeBlockLang(node), codeBlockText(node));
}

// HTML rendered as plain text because the language had no grammar then must
// not outlive the language gaining one.
function isReusable(node: JSONContent, html: string) {
  return !(isPlainCodeHtml(html) && resolveCodeLanguage(codeBlockLang(node)));
}

function collectHighlightedHtml(doc: JSONContent | null | undefined) {
  const map = new Map<string, Array<string>>();

  function walk(node: JSONContent) {
    if (node.type === "codeBlock") {
      const html = node.attrs?.highlightedHtml;
      if (
        typeof html === "string" &&
        html.length > 0 &&
        isReusable(node, html)
      ) {
        const key = codeBlockKey(node);
        const list = map.get(key) ?? [];
        list.push(html);
        map.set(key, list);
      }
    }
    node.content?.forEach(walk);
  }

  if (doc) walk(doc);
  return map;
}

export function snapshotHighlightedHtmlByKey(
  doc: JSONContent | null | undefined,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const [key, list] of collectHighlightedHtml(doc)) {
    const html = list[0];
    if (html) map.set(key, html);
  }
  return map;
}

function takeHtml(map: Map<string, Array<string>>, key: string) {
  const list = map.get(key);
  if (!list || list.length === 0) return undefined;
  return list.shift();
}

export function applyCodeBlockHighlighting(
  draft: JSONContent | null,
  fromSnapshot: JSONContent | null | undefined,
): JSONContent | null {
  if (!draft) return null;

  const snapshotHtml = collectHighlightedHtml(fromSnapshot);
  const cloned = structuredClone(draft);

  function walk(node: JSONContent) {
    if (node.type === "codeBlock") {
      const attrs = { ...node.attrs };
      delete attrs.highlightedHtml;
      const html = takeHtml(snapshotHtml, codeBlockKey(node));
      node.attrs = html ? { ...attrs, highlightedHtml: html } : attrs;
    }
    node.content?.forEach(walk);
  }

  walk(cloned);
  return cloned;
}

/**
 * The body a Public Content Snapshot was built from: the snapshot's body
 * without the highlighted HTML publishing adds to each code block. A code
 * block that had no attributes before publishing gave it some only to carry
 * that HTML, so it loses them again.
 */
export function removeCodeBlockHighlighting(
  doc: JSONContent | null | undefined,
): JSONContent | null {
  if (!doc) return null;
  const cloned = structuredClone(doc);

  function walk(node: JSONContent) {
    if (
      node.type === "codeBlock" &&
      node.attrs &&
      "highlightedHtml" in node.attrs
    ) {
      const { highlightedHtml: _highlightedHtml, ...rest } = node.attrs;
      if (Object.keys(rest).length === 0) delete node.attrs;
      else node.attrs = rest;
    }
    node.content?.forEach(walk);
  }

  walk(cloned);
  return cloned;
}
