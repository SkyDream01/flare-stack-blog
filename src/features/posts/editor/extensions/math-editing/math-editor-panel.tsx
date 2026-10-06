import katex from "katex";
import type { Ref } from "react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import type { MathType } from "./state";

type Preview = { html: string } | { error: string } | null;

function renderPreview(latex: string, type: MathType): Preview {
  if (!latex.trim()) return null;
  try {
    return {
      html: katex.renderToString(latex, {
        throwOnError: true,
        displayMode: type === "block",
      }),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export interface MathEditorPanelProps {
  /** The LaTeX to start from. */
  latex: string;
  /** How the formula is shown now. */
  type: MathType;
  onApply: (latex: string, type: MathType) => void;
  onCancel: () => void;
  inputRef?: Ref<HTMLTextAreaElement>;
  className?: string;
}

/**
 * Edits a formula: a LaTeX input with a live KaTeX preview that shows LaTeX
 * errors, and an inline/block switch. Ctrl/Cmd+Enter applies, Escape
 * cancels.
 */
export function MathEditorPanel({
  latex,
  type,
  onApply,
  onCancel,
  inputRef,
  className,
}: MathEditorPanelProps) {
  const [value, setValue] = useState(latex);
  const [shownAs, setShownAs] = useState(type);
  const preview = useMemo(
    () => renderPreview(value, shownAs),
    [value, shownAs],
  );
  const apply = () => onApply(value, shownAs);

  return (
    <div
      data-math-editor=""
      className={cn("flex flex-col gap-2 text-left", className)}
    >
      <textarea
        ref={inputRef}
        aria-label="LaTeX"
        value={value}
        rows={3}
        spellCheck={false}
        placeholder={m.editor_formula_placeholder()}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Escape") {
            // Handled here, so an enclosing popover does not close again.
            event.preventDefault();
            onCancel();
          } else if (
            event.key === "Enter" &&
            (event.ctrlKey || event.metaKey)
          ) {
            event.preventDefault();
            apply();
          }
        }}
        className="w-full resize-y rounded-lg border border-(--fuwari-input-border) bg-(--fuwari-input-bg) p-2 font-mono text-sm fuwari-text-90 outline-none placeholder:fuwari-text-30 focus:border-(--fuwari-primary)"
      />
      <output
        aria-label={m.editor_formula_preview()}
        className={cn(
          "flex min-h-12 items-center justify-center overflow-x-auto rounded-lg p-2",
          preview && "error" in preview
            ? "bg-(--fuwari-danger-bg)"
            : "bg-(--fuwari-input-bg)",
        )}
      >
        {preview === null ? (
          <span className="text-sm fuwari-text-30">
            {m.editor_formula_preview_empty()}
          </span>
        ) : "error" in preview ? (
          <span className="text-sm wrap-break-word text-(--fuwari-danger-fg)">
            {preview.error}
          </span>
        ) : (
          <span
            className="max-w-full fuwari-text-90"
            dangerouslySetInnerHTML={{ __html: preview.html }}
          />
        )}
      </output>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {(["inline", "block"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={shownAs === option}
              onClick={() => setShownAs(option)}
              className={cn(
                "h-7 rounded-lg px-2.5 text-xs font-medium",
                shownAs === option
                  ? "fuwari-btn-primary"
                  : "fuwari-btn-regular",
              )}
            >
              {option === "inline"
                ? m.editor_formula_inline()
                : m.editor_formula_block()}
            </button>
          ))}
        </div>
        <span className="mr-auto hidden text-xs fuwari-text-50 sm:inline">
          {m.editor_formula_shortcut()}
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="fuwari-btn-regular h-7 rounded-lg px-2.5 text-xs font-medium"
        >
          {m.editor_formula_cancel()}
        </button>
        <button
          type="button"
          onClick={apply}
          className="fuwari-btn-primary h-7 rounded-lg px-2.5 text-xs font-medium"
        >
          {m.editor_formula_apply()}
        </button>
      </div>
    </div>
  );
}
