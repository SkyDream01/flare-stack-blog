import type { JSONContent } from "@tiptap/core";
import { parseMarkdown } from "@/features/posts/editor/markdown/parse-markdown";

const REMOTE_URL = /^(?:https?:)?\/\//i;

export interface PastedMarkdown {
  content: Array<JSONContent>;
  /** Images with a local path, kept as `![alt](path)` text. */
  localImageCount: number;
}

export function parsePastedMarkdown(markdown: string): PastedMarkdown {
  const { content, refusedImages } = parseMarkdown(markdown, {
    acceptsImage: (src) => REMOTE_URL.test(src),
    headings: "fit",
  });
  return { content, localImageCount: refusedImages.length };
}

const PARSED_EDITOR_MODES = new Set(["markdown", "plaintext"]);

/**
 * The Markdown to parse from a paste, or null to leave it to the default
 * handlers: HTML, files, code from VS Code, pastes inside a code block, and
 * Ctrl+Shift+V.
 */
export function getPastedMarkdown(
  clipboard: Pick<DataTransfer, "getData" | "types" | "files"> | null,
  { inCode, plainText }: { inCode: boolean; plainText: boolean },
): string | null {
  if (!clipboard || inCode || plainText) return null;
  if (clipboard.files.length > 0) return null;

  const text = clipboard.getData("text/plain");
  if (!text.trim()) return null;

  const vscode = clipboard.getData("vscode-editor-data");
  if (vscode) {
    let mode: unknown;
    try {
      mode = JSON.parse(vscode)?.mode;
    } catch {
      return null;
    }
    return typeof mode === "string" && PARSED_EDITOR_MODES.has(mode)
      ? text
      : null;
  }

  if (Array.from(clipboard.types).includes("text/html")) return null;
  return text;
}
