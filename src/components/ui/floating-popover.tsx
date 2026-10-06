import type { Placement, VirtualElement } from "@floating-ui/dom";
import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
} from "@floating-ui/dom";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { MOTION, useMotionPresence } from "@/hooks/use-motion";
import { cn } from "@/lib/utils";
import {
  POPOVER_PANEL_CLASS,
  popoverMotionOrigin,
} from "./use-anchored-popover";

/** What a floating popover sits beside: an element or a measured rectangle. */
export type FloatingAnchor = Element | VirtualElement;

export interface FloatingPopoverProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "style" | "children"
> {
  open: boolean;
  /** Keep it referentially stable while open: a new anchor re-measures. */
  anchor: FloatingAnchor | null;
  /** Escape anywhere, or a mousedown outside the popover and its anchor. */
  onDismiss: (reason: "escape" | "outside") => void;
  /** The preferred side; it flips when there is no room. */
  placement?: Placement;
  /** Focused once the popover is positioned and visible. */
  initialFocus?: () => HTMLElement | null;
  children: ReactNode;
}

const GAP = 6;
const VIEWPORT_PADDING = 8;

/**
 * A card portalled to the body and positioned beside `anchor` with fixed
 * positioning. It flips and shifts to stay in the viewport, follows the
 * anchor on scroll and resize, and animates in and out with the Fuwari
 * popover motion.
 */
export function FloatingPopover({
  open,
  anchor,
  onDismiss,
  placement = "bottom-start",
  initialFocus,
  className,
  children,
  ...rest
}: FloatingPopoverProps) {
  const present = useMotionPresence(open, MOTION.popover);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<CSSProperties | null>(null);

  // Stay beside the last anchor while animating out.
  const lastAnchor = useRef(anchor);
  if (anchor) lastAnchor.current = anchor;
  const reference = anchor ?? (present ? lastAnchor.current : null);

  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  const focusTarget = useRef(initialFocus);
  focusTarget.current = initialFocus;

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!present || !reference || !panel) {
      setPosition(null);
      return;
    }
    let active = true;
    const stop = autoUpdate(reference, panel, () => {
      void computePosition(reference, panel, {
        strategy: "fixed",
        placement,
        middleware: [
          offset(GAP),
          flip({ padding: VIEWPORT_PADDING }),
          shift({ padding: VIEWPORT_PADDING }),
        ],
      }).then(({ x, y, placement: placed }) => {
        if (!active) return;
        setPosition({
          position: "fixed",
          left: x,
          top: y,
          ...popoverMotionOrigin(
            placed.startsWith("top"),
            placed.endsWith("end") ? "right" : "left",
          ),
        });
      });
    });
    return () => {
      active = false;
      stop();
    };
  }, [present, reference, placement]);

  const positioned = position !== null;
  useEffect(() => {
    if (open && positioned) focusTarget.current?.()?.focus();
  }, [open, positioned]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      // A menu that handled Escape first keeps the popover open.
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      dismiss.current("escape");
    };
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (reference instanceof Element && reference.contains(target)) return;
      dismiss.current("outside");
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [open, reference]);

  if (!present || !reference) return null;

  return createPortal(
    <div
      {...rest}
      ref={panelRef}
      data-state={open ? "open" : "closing"}
      inert={!open}
      aria-hidden={!open || undefined}
      style={{
        ...(position ?? { position: "fixed", left: 0, top: 0 }),
        visibility: positioned ? undefined : "hidden",
      }}
      className={cn(POPOVER_PANEL_CLASS, className)}
    >
      {children}
    </div>,
    document.body,
  );
}
