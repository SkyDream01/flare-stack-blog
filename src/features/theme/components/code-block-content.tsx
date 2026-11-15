import { lazy, Suspense } from "react";
import { isMermaidLanguage } from "@/lib/code-languages";
import { plainCodeHtml } from "@/lib/plain-code-html";

const ColourSchemeMermaidDiagram = lazy(() =>
  import("@/components/content/colour-scheme-mermaid-diagram").then(
    (module) => ({
      default: module.ColourSchemeMermaidDiagram,
    }),
  ),
);

/** Keep each theme's code frame while sharing source and diagram rendering. */
export function CodeBlockContent({
  code,
  language,
  highlightedHtml,
  className,
}: {
  code: string;
  language: string | null;
  highlightedHtml?: string;
  className: string;
}) {
  const fallback = (
    <div
      className={className}
      dangerouslySetInnerHTML={{
        __html: highlightedHtml || plainCodeHtml(code),
      }}
    />
  );
  if (!isMermaidLanguage(language)) return fallback;

  return (
    <Suspense fallback={fallback}>
      <ColourSchemeMermaidDiagram source={code} fallback={fallback} />
    </Suspense>
  );
}
