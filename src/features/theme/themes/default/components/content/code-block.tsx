import { Check, Copy } from "lucide-react";
import { memo, useState } from "react";
import { m } from "@/paraglide/messages";
import { CodeBlockContent } from "@/features/theme/components/code-block-content";
import { isPlainTextLanguage, resolveCodeLanguage } from "@/lib/code-languages";
import { plainCodeHtml } from "@/lib/plain-code-html";

interface CodeBlockProps {
  code: string;
  language: string | null;
  highlightedHtml?: string;
}

export const CodeBlock = memo(
  ({ code, language, highlightedHtml }: CodeBlockProps) => {
    const html = highlightedHtml || plainCodeHtml(code);

    const [copied, setCopied] = useState(false);

    // Helper to get display label
    const displayLanguage = isPlainTextLanguage(language)
      ? m.common_plain_text()
      : resolveCodeLanguage(language)?.label || language;

    const handleCopy = () => {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div className="my-12 group relative max-w-full">
        <div className="relative rounded-sm overflow-hidden border border-zinc-200/40 dark:border-zinc-800/40 hover:border-zinc-300/60 dark:hover:border-zinc-700/60 transition-colors duration-500">
          {/* Minimal Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-200/10 dark:border-zinc-800/10 bg-zinc-100 dark:bg-zinc-800 select-none rounded-t-sm">
            <div className="flex items-center gap-4">
              <span className="text-xs font-mono font-medium text-muted-foreground/80">
                {displayLanguage}
              </span>
            </div>

            <button
              onClick={handleCopy}
              aria-label={m.common_copy_code()}
              className="flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground transition-all duration-300"
            >
              {copied ? (
                <span className="animate-in fade-in slide-in-from-right-1 opacity-70">
                  {m.common_copied()}
                </span>
              ) : null}
              <div className="p-0.5 opacity-60 group-hover/btn:opacity-100 transition-opacity">
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </div>
            </button>
          </div>

          {/* Code Area */}
          <div className="relative p-0 overflow-x-auto custom-scrollbar rounded-b-sm">
            <div className="text-sm font-mono leading-relaxed transition-opacity duration-300">
              <CodeBlockContent
                code={code}
                language={language}
                highlightedHtml={html}
                className="[&>pre]:p-6 [&>pre]:m-0 [&>pre]:min-w-full [&>pre]:w-fit [&>pre]:rounded-b-sm [&>pre>code]:p-0"
              />
            </div>
          </div>
        </div>
      </div>
    );
  },
);
