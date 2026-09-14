import { Ellipsis } from "lucide-react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { MOTION, useMotionPresence } from "@/hooks/use-motion";
import "./comment-actions.css";

interface CommentActionsProps {
  ariaLabel: string;
  actions: Array<{
    label: string;
    onSelect: () => void;
    danger?: boolean;
  }>;
  disabled?: boolean;
}

export function CommentActions({
  ariaLabel,
  actions,
  disabled = false,
}: CommentActionsProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const isOpen = open && !disabled && actions.length > 0;
  const present = useMotionPresence(isOpen, MOTION.popover);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const initialFocus = useRef<"first" | "last">("first");
  const [position, setPosition] = useState<CSSProperties | null>(null);

  useEffect(() => {
    if (disabled || actions.length === 0) setOpen(false);
  }, [disabled, actions.length]);

  useLayoutEffect(() => {
    if (!present) {
      setPosition(null);
      return;
    }
    if (!isOpen) return;

    const update = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const margin = 8;
      const gap = 6;
      const width = Math.min(192, window.innerWidth - margin * 2);
      const height = menuRef.current?.scrollHeight ?? actions.length * 40 + 10;
      const below = window.innerHeight - rect.bottom - gap - margin;
      const above = rect.top - gap - margin;
      const openUp = below < height && above > below;
      setPosition({
        left: Math.max(
          margin,
          Math.min(rect.right - width, window.innerWidth - width - margin),
        ),
        width,
        top: openUp ? undefined : rect.bottom + gap,
        bottom: openUp ? window.innerHeight - rect.top + gap : undefined,
        maxHeight: Math.max(40, openUp ? above : below),
        transformOrigin: openUp ? "bottom right" : "top right",
        "--popover-offset": openUp ? "4px" : "-4px",
      } as CSSProperties);
    };

    update();
    window.addEventListener("resize", update);
    document.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      document.removeEventListener("scroll", update, true);
    };
  }, [present, isOpen, actions.length]);

  useEffect(() => {
    if (!isOpen) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [isOpen]);

  useEffect(() => {
    if (
      !isOpen ||
      !position ||
      menuRef.current?.contains(document.activeElement)
    )
      return;
    const items =
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
    const index =
      initialFocus.current === "last" ? (items?.length ?? 1) - 1 : 0;
    items?.[index]?.focus({ preventScroll: true });
  }, [isOpen, position]);

  const closeAndFocus = () => {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  };

  if (actions.length === 0) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="comment-actions-trigger"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={present ? id : undefined}
        disabled={disabled}
        onClick={() => {
          initialFocus.current = "first";
          setOpen((value) => !value);
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          initialFocus.current = event.key === "ArrowUp" ? "last" : "first";
          setOpen(true);
        }}
      >
        <Ellipsis size={18} aria-hidden="true" />
      </button>
      {present && position
        ? createPortal(
            <div
              ref={menuRef}
              id={id}
              role="menu"
              aria-label={ariaLabel}
              className="comment-actions-menu fuwari-popover-motion custom-scrollbar"
              data-state={isOpen ? "open" : "closing"}
              inert={!isOpen}
              aria-hidden={!isOpen}
              style={position}
              onBlur={(event) => {
                const next = event.relatedTarget;
                if (
                  !event.currentTarget.contains(next) &&
                  !triggerRef.current?.contains(next)
                ) {
                  setOpen(false);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  closeAndFocus();
                  return;
                }
                if (event.key === "Tab") {
                  // Let the browser continue from the trigger's position in the page.
                  closeAndFocus();
                  return;
                }
                if (
                  !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
                )
                  return;
                event.preventDefault();
                const items = Array.from(
                  event.currentTarget.querySelectorAll<HTMLButtonElement>(
                    '[role="menuitem"]',
                  ),
                );
                const current = items.indexOf(
                  document.activeElement as HTMLButtonElement,
                );
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? items.length - 1
                      : (current +
                          (event.key === "ArrowDown" ? 1 : -1) +
                          items.length) %
                        items.length;
                items[next]?.focus({ preventScroll: true });
              }}
            >
              {actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  className="comment-actions-item"
                  data-danger={action.danger || undefined}
                  onClick={() => {
                    // Confirmation dialogs must capture the persistent trigger, not this exiting item.
                    closeAndFocus();
                    action.onSelect();
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
