import { TableOfContents as TocIcon } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { useActiveTOC } from "@/hooks/use-active-toc";
import { useJumpToHeading } from "@/features/posts/components/content/use-jump-to-heading";
import type { TableOfContentsItem } from "@/features/posts/utils/toc";
import { cn, isSSR } from "@/lib/utils";
import { m } from "@/paraglide/messages";

type Theme = "default" | "cuckoo";

/** Compact, theme-aware TOC control for themes whose side TOC is hidden on small screens. */
export function CompactTableOfContents({
  headers,
  theme,
}: {
  headers: Array<TableOfContentsItem>;
  theme: Theme;
}) {
  const activeId = useActiveTOC(headers);
  const jumpToHeading = useJumpToHeading();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const minLevel = headers.length
    ? Math.min(...headers.map((heading) => heading.level))
    : 2;

  useEffect(() => {
    const update = () => {
      setShown(window.scrollY > 250);
      const button = buttonRef.current;
      const content = document.querySelector(
        theme === "cuckoo" ? ".cuckoo-custom-md" : ".default-post-content",
      );
      if (!button || !content) return;
      const rect = content.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      const progress =
        scrollable > 0 ? Math.min(1, Math.max(0, -rect.top / scrollable)) : 1;
      button.style.setProperty("--progress", String(progress));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [theme]);

  useEffect(() => {
    if (!shown) setOpen(false);
  }, [shown]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onMouseDown = (event: globalThis.MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const target =
      listRef.current?.querySelector<HTMLElement>("a[data-active]");
    (target ?? listRef.current?.querySelector<HTMLElement>("a"))?.focus();
  }, [open]);

  if (headers.length === 0 || isSSR) return null;

  const isCuckoo = theme === "cuckoo";
  const onSelect = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    setOpen(false);
    void jumpToHeading(id);
  };

  return createPortal(
    <div
      ref={rootRef}
      className={cn(
        "fixed right-4 z-50 transition-all duration-300",
        isCuckoo ? "lg:hidden" : "xl:hidden",
        shown
          ? "opacity-100 scale-100"
          : "opacity-0 scale-90 pointer-events-none",
      )}
      style={{
        bottom: "calc(1.5rem + env(safe-area-inset-bottom) + 4rem)",
      }}
    >
      {open ? (
        <div
          className={cn(
            "absolute bottom-full right-0 mb-2 max-h-[60vh] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto p-2 shadow-xl",
            isCuckoo
              ? "rounded-(--cuckoo-radius) border border-(--cuckoo-divider) bg-(--cuckoo-card-bg) text-(--cuckoo-text-90)"
              : "rounded-xl border border-border bg-popover text-popover-foreground",
          )}
        >
          <nav aria-label={m.post_toc()}>
            <div ref={listRef} className="flex flex-col">
              {headers.map((heading) => {
                const active = activeId === heading.id;
                return (
                  <a
                    key={heading.id}
                    href={`#${heading.id}`}
                    data-active={active || undefined}
                    aria-current={active ? "location" : undefined}
                    onClick={(event) => onSelect(event, heading.id)}
                    className={cn(
                      "min-h-10 rounded-lg px-3 py-2 text-sm leading-snug outline-none transition-colors focus-visible:ring-2",
                      isCuckoo
                        ? active
                          ? "bg-(--cuckoo-btn-regular-bg) font-semibold text-(--cuckoo-accent)"
                          : "cuckoo-text-75 hover:bg-(--cuckoo-btn-regular-bg)"
                        : active
                          ? "bg-accent font-medium text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
                    )}
                    style={{
                      paddingLeft: `${0.75 + Math.max(0, heading.level - minLevel) * 0.75}rem`,
                    }}
                  >
                    {heading.text}
                  </a>
                );
              })}
            </div>
          </nav>
        </div>
      ) : null}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={m.post_toc()}
        aria-expanded={open}
        className={cn(
          "post-progress-ring relative flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition active:scale-95",
          isCuckoo
            ? "cuckoo-card-base text-(--cuckoo-accent)"
            : "border border-border bg-background text-foreground hover:bg-accent",
        )}
        style={
          {
            "--post-progress-color": isCuckoo
              ? "var(--cuckoo-accent)"
              : "hsl(var(--primary))",
          } as CSSProperties
        }
      >
        <TocIcon aria-hidden className="h-5 w-5" />
      </button>
    </div>,
    document.body,
  );
}
