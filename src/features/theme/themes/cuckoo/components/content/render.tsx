import type { JSONContent } from "@tiptap/react";
import { MathFormula } from "@/components/content/math-formula";
import { renderReact as renderPost } from "@/features/posts/components/content/render";
import { CodeBlock } from "./code-block";
import { ImageDisplay } from "./image-display";

export function renderReact(content: JSONContent) {
  return renderPost(
    content,
    {
      inline: (latex) => <MathFormula latex={latex} mode="inline" />,
      block: (latex) => <MathFormula latex={latex} mode="block" />,
    },
    { CodeBlock, ImageDisplay },
  );
}
