import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { MOTION, useMotionPresence } from "@/hooks/use-motion";

/** The small pill trigger shared by the dropdown menu and language picker. */
export const POPOVER_TRIGGER_CLASS =
  "flex items-center gap-1 rounded-lg bg-(--fuwari-primary)/10 px-2 py-0.5 font-mono text-xs font-bold uppercase text-(--fuwari-primary)";

/** Card surface for a popover portalled to the body. */
export const POPOVER_PANEL_CLASS =
  "fuwari-popover-motion z-80 rounded-xl bg-(--fuwari-card-bg) shadow-md ring-1 ring-(--fuwari-input-border)";

const GAP = 4;
const VIEWPORT_MARGIN = 8;

/**
 * Where a popover's open and close motion grows from: the anchor-side corner
 * on `edge`, for a popover placed `above` or below its anchor.
 */
export function popoverMotionOrigin(
  above: boolean,
  edge: "left" | "right",
): CSSProperties {
  return {
    transformOrigin: `${above ? "bottom" : "top"} ${edge}`,
    "--popover-offset": above ? "4px" : "-4px",
  } as CSSProperties;
}

/**
 * Anchors a fixed-position popover to its trigger's right edge (shifted right
 * when that would push it past the viewport's left edge), below it, or
 * above it when there is less than `maxHeight` room below and more above. The
 * popover follows the trigger on resize and scroll, and `onDismiss` runs on a
 * mousedown outside both. Render the popover only while `style` is set: it
 * stays set through the exit motion after `open` turns false.
 */
export function useAnchoredPopover({
  open,
  onDismiss,
  width,
  maxHeight,
}: {
  open: boolean;
  onDismiss: () => void;
  width: number;
  maxHeight: number;
}) {
  const present = useMotionPresence(open, MOTION.popover);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties | null>(null);
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;

  useLayoutEffect(() => {
    if (!present) {
      setStyle(null);
      return;
    }

    const update = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < maxHeight && rect.top > spaceBelow;
      setStyle({
        position: "fixed",
        // Right-aligned to the trigger, but never past the viewport's left.
        right: Math.min(
          window.innerWidth - rect.right,
          window.innerWidth - width - VIEWPORT_MARGIN,
        ),
        width,
        top: openUp ? undefined : rect.bottom + GAP,
        bottom: openUp ? window.innerHeight - rect.top + GAP : undefined,
        ...popoverMotionOrigin(openUp, "right"),
      });
    };

    // Scrolling inside the popover does not move the trigger.
    const onScroll = (event: Event) => {
      if (popoverRef.current?.contains(event.target as Node)) return;
      update();
    };

    update();
    window.addEventListener("resize", update);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", update);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [present, width, maxHeight]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      dismiss.current();
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  return { triggerRef, popoverRef, style: present ? style : null };
}
